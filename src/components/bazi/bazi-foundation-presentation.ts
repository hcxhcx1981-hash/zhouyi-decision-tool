import type { BaziCoreResult } from "../../lib/bazi/runtime-types.ts";
import type {
  BaziFoundationData,
  FiveElement,
  FoundationPillarInput,
  FoundationResult,
  PillarsFoundationResult,
  YinYang,
} from "../../lib/bazi/foundation-runtime-types.ts";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { derivePillarsFoundation, foundationPillarFromChinese } from "../../lib/bazi/foundation-engine.ts";

const YIN_YANG_LABELS: Readonly<Record<YinYang, string>> = {
  YIN: "阴",
  YANG: "阳",
};

const ELEMENT_LABELS: Readonly<Record<FiveElement, string>> = {
  WOOD: "木",
  FIRE: "火",
  EARTH: "土",
  METAL: "金",
  WATER: "水",
};

export function formatYinYang(value: YinYang): string {
  return YIN_YANG_LABELS[value];
}

export function formatFiveElement(value: FiveElement): string {
  return ELEMENT_LABELS[value];
}

function adaptPillar(
  data: BaziFoundationData,
  pillar: { readonly stem: string; readonly branch: string },
): FoundationResult<FoundationPillarInput> {
  return foundationPillarFromChinese(data, { stem: pillar.stem, branch: pillar.branch });
}

export function deriveReadyCoreFoundation(
  data: BaziFoundationData,
  coreResult: BaziCoreResult,
): FoundationResult<PillarsFoundationResult> | null {
  if (coreResult.status !== "READY") return null;
  const { yearPillar, monthPillar, dayPillar, hourPillar } = coreResult;
  if (!yearPillar || !monthPillar || !dayPillar) {
    throw new Error("FOUNDATION_DATA_INTEGRITY_ERROR");
  }
  const year = adaptPillar(data, yearPillar);
  if (!year.ok) return year;
  const month = adaptPillar(data, monthPillar);
  if (!month.ok) return month;
  const day = adaptPillar(data, dayPillar);
  if (!day.ok) return day;
  const hour = hourPillar ? adaptPillar(data, hourPillar) : null;
  if (hour && !hour.ok) return hour;
  return derivePillarsFoundation(data, {
    year: year.value,
    month: month.value,
    day: day.value,
    hour: hour?.value ?? null,
  });
}
