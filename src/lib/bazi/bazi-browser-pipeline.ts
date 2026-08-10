// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { calculateDeterministicBazi } from "./bazi-deterministic-pipeline.ts";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { toRawBaziDeterministicInput, type BaziPageDraft } from "./bazi-page-contract.ts";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { BaziBrowserRuntimeLoader } from "./browser-runtime-loader.ts";
import type { BrowserFetchImpl, BrowserTimezoneIndex } from "./browser-runtime-types.ts";

export interface BaziBrowserPipelineResult {
  result: ReturnType<typeof calculateDeterministicBazi>;
  loadedAssetPaths: readonly string[];
  loadedBytes: number;
}

export async function runBaziBrowserPipeline(
  draft: BaziPageDraft,
  options: { fetchImpl: BrowserFetchImpl; referenceInstantUtc: string },
): Promise<BaziBrowserPipelineResult> {
  const input = toRawBaziDeterministicInput({
    ...draft,
    referenceInstantUtc: options.referenceInstantUtc,
  });
  const loaded = await new BaziBrowserRuntimeLoader(options.fetchImpl).loadForInput(input);
  return {
    result: calculateDeterministicBazi(input, loaded.data),
    loadedAssetPaths: loaded.loadedAssetPaths,
    loadedBytes: loaded.loadedBytes,
  };
}

export async function loadVerifiedIanaZoneIds(fetchImpl: BrowserFetchImpl): Promise<readonly string[]> {
  let timezoneIndexBytes: Uint8Array | null = null;
  const capturingFetch: BrowserFetchImpl = async (path) => {
    const response = await fetchImpl(path);
    if (path !== "/bazi-runtime/v0.1/timezone/index.json" || !response.ok) return response;
    const bytes = new Uint8Array(await response.arrayBuffer());
    timezoneIndexBytes = bytes;
    return {
      ok: true,
      status: response.status,
      arrayBuffer: async () => bytes.slice().buffer,
    };
  };

  await new BaziBrowserRuntimeLoader(capturingFetch).loadForInput({
    calendarType: "GREGORIAN",
    caseScope: "PRODUCT_INPUT",
    localDate: "",
    localTime: null,
    timeKnown: false,
    foldChoice: null,
    referenceInstantUtc: "2000-01-01T00:00:00.000Z",
    locationSelection: {
      mode: "MANUAL_IANA",
      locationId: null,
      locationName: "IANA zone selector",
      claimedIanaTimezone: null,
    },
  });

  if (!timezoneIndexBytes) throw new Error("BROWSER_RUNTIME_TIMEZONE_INDEX_UNAVAILABLE");
  const index = JSON.parse(new TextDecoder().decode(timezoneIndexBytes)) as BrowserTimezoneIndex;
  return Object.freeze(index.zones.map((entry) => entry.zone_id).sort((a, b) => a.localeCompare(b)));
}

export const defaultBrowserFetch: BrowserFetchImpl = async (path) => fetch(path);
