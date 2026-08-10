import assert from "node:assert/strict";
import test from "node:test";

import { toRawBaziDeterministicInput } from "../src/lib/bazi/bazi-page-contract.ts";
import { validateBrowserRuntime } from "../scripts/validate-bazi-browser-runtime.mjs";

test("browser runtime matches the complete Node deterministic pipeline", async () => {
  const result = await validateBrowserRuntime();
  assert.equal(result.nodeBrowserEqual, 70);
  assert.equal(result.status, 70);
  assert.equal(result.timezoneChunks, 598);
  assert.equal(result.solarChunks, 133);
  assert.ok(result.typicalBytes < 300_000);
});

test("page contract requires caller-provided time, location selection, and reference instant", () => {
  const result = toRawBaziDeterministicInput({
    calendarType: "GREGORIAN",
    localDate: "2024-01-15",
    localTime: null,
    timeKnown: false,
    gender: "FEMALE",
    locationName: "display only",
    selectionMode: "MANUAL_IANA",
    registeredLocationId: null,
    manualIanaTimezone: "America/New_York",
    foldChoice: null,
    referenceInstantUtc: "2026-08-07T12:00:00Z",
  });
  assert.equal(result.localTime, null);
  assert.equal(result.locationSelection.claimedIanaTimezone, "America/New_York");
  assert.equal(result.referenceInstantUtc, "2026-08-07T12:00:00Z");
});
