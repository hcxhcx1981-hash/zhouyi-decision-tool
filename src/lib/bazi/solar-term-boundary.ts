import type {
  BaziCoreData,
  BaziSolarTermRecord,
  NormalizedBaziCoreInput,
  UtcHalfOpenRange,
} from "./runtime-types";

export interface SolarTermBoundaryResolution {
  blockingCode: "SOLAR_TERM_DATA_UNAVAILABLE" | "SOLAR_TERM_TIME_REQUIRED" | "SOLAR_TERM_SAME_MINUTE_AMBIGUOUS" | null;
  warnings: string[];
  matchedLichun: BaziSolarTermRecord | null;
  matchedMonthBoundary: BaziSolarTermRecord | null;
}

interface ParsedRange {
  start: number;
  end: number;
}

function parseRange(range: UtcHalfOpenRange | null): ParsedRange | null {
  if (!range) return null;
  const start = Date.parse(range.startUtc);
  const end = Date.parse(range.endUtcExclusive);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

function isBoundary(record: BaziSolarTermRecord): boolean {
  return record.term_id === "LICHUN" || record.is_month_boundary_jie;
}

function latestAtOrBefore(
  records: readonly BaziSolarTermRecord[],
  instant: number,
  predicate: (record: BaziSolarTermRecord) => boolean,
): BaziSolarTermRecord | null {
  let latest: BaziSolarTermRecord | null = null;
  for (const record of records) {
    const timestamp = Date.parse(record.instant_utc);
    if (timestamp <= instant && predicate(record)) latest = record;
    if (timestamp > instant) break;
  }
  return latest;
}

function boundaryDistance(range: ParsedRange, instant: number): number {
  if (instant < range.start) return range.start - instant;
  if (instant >= range.end) return instant - range.end;
  return 0;
}

export function resolveSolarTermBoundaries(
  input: NormalizedBaziCoreInput,
  data: BaziCoreData,
): SolarTermBoundaryResolution {
  const records = data.solarTerms;
  const minuteRange = parseRange(input.minuteRangeUtc);
  const dayRange = parseRange(input.localCivilDayRangeUtc);
  const comparisonRange = input.timeKnown ? minuteRange : dayRange;

  if (!comparisonRange) {
    return {
      blockingCode: "SOLAR_TERM_DATA_UNAVAILABLE",
      warnings: [],
      matchedLichun: null,
      matchedMonthBoundary: null,
    };
  }

  const boundaryRecords = records.filter(isBoundary);
  const insideRange = boundaryRecords.filter((record) => {
    const instant = Date.parse(record.instant_utc);
    return instant >= comparisonRange.start && instant < comparisonRange.end;
  });

  if (insideRange.length > 0) {
    return {
      blockingCode: input.timeKnown
        ? "SOLAR_TERM_SAME_MINUTE_AMBIGUOUS"
        : "SOLAR_TERM_TIME_REQUIRED",
      warnings: [],
      matchedLichun: null,
      matchedMonthBoundary: null,
    };
  }

  const comparisonInstant = comparisonRange.start;
  const matchedLichun = latestAtOrBefore(
    records,
    comparisonInstant,
    (record) => record.term_id === "LICHUN",
  );
  const matchedMonthBoundary = latestAtOrBefore(
    records,
    comparisonInstant,
    (record) => record.is_month_boundary_jie,
  );

  if (!matchedLichun || !matchedMonthBoundary || !matchedMonthBoundary.month_branch_after_boundary) {
    return {
      blockingCode: "SOLAR_TERM_DATA_UNAVAILABLE",
      warnings: [],
      matchedLichun,
      matchedMonthBoundary,
    };
  }

  const warnings = input.timeKnown && boundaryRecords.some((record) => {
    const instant = Date.parse(record.instant_utc);
    return boundaryDistance(comparisonRange, instant) <= 120_000;
  }) ? ["BOUNDARY_SENSITIVE"] : [];

  return { blockingCode: null, warnings, matchedLichun, matchedMonthBoundary };
}
