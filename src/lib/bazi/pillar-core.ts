// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { calculateCivilDay, parseCivilDate } from "./civil-day.ts";
import type {
  BaziCoreAudit,
  BaziCoreData,
  BaziCoreResult,
  NormalizedBaziCoreInput,
} from "./runtime-types";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { hourPillarForDayStem, monthPillarForYearStem, yearPillarForLichunYear } from "./sexagenary-cycle.ts";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { resolveSolarTermBoundaries } from "./solar-term-boundary.ts";

interface RuleTrace {
  readonly ids: string[];
  mark(ruleId: string): void;
}

function createRuleTrace(): RuleTrace {
  const ids: string[] = [];
  const seen = new Set<string>();
  return {
    ids,
    mark(ruleId) {
      if (!seen.has(ruleId)) {
        seen.add(ruleId);
        ids.push(ruleId);
      }
    },
  };
}

function auditFor(input: NormalizedBaziCoreInput, data: BaziCoreData, trace: RuleTrace): BaziCoreAudit {
  return {
    rulesProtocolId: data.rulesProtocolId,
    rulesVersion: data.rulesVersion,
    datasetId: data.datasetId,
    datasetVersion: data.datasetVersion,
    datasetSha256: data.datasetSha256,
    appliedRuleIds: trace.ids,
    matchedLichun: null,
    matchedMonthBoundary: null,
    dayAlgorithmAIndex: null,
    dayAlgorithmBIndex: null,
    timezoneResolverId: input.timezoneResolverId,
    timezoneDataVersion: input.timezoneDataVersion,
  };
}

function blocked(audit: BaziCoreAudit, blockingCode: string): BaziCoreResult {
  return {
    status: "BLOCKED",
    completeness: "NONE",
    yearPillar: null,
    monthPillar: null,
    dayPillar: null,
    hourPillar: null,
    blockingCode,
    warnings: [],
    audit,
  };
}

function parseLocalHour(localTime: string | null): number | null {
  if (localTime === null) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(localTime);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? hour : null;
}

function initialBlockingCode(input: NormalizedBaziCoreInput, trace: RuleTrace): string | null {
  trace.mark("CAL-GREGORIAN-ONLY-001");
  if (input.calendarType !== "GREGORIAN") return "LUNAR_INPUT_NOT_SUPPORTED_V0_1";
  if (!parseCivilDate(input.localDate)) return "INVALID_CIVIL_DATE";
  trace.mark(input.caseScope === "PRODUCT_INPUT" ? "CAL-BIRTH-INPUT-RANGE-002B" : "CAL-ALGORITHM-RANGE-002A");
  if (input.caseScope === "PRODUCT_INPUT" && input.localDate < "1970-01-01") {
    return "DATE_OUT_OF_SUPPORTED_RANGE";
  }
  if (
    input.caseScope === "ALGORITHM_VALIDATION" &&
    (input.localDate < "1970-01-01" || input.localDate > "2100-12-31")
  ) {
    return "DATE_OUT_OF_ALGORITHM_RANGE";
  }
  if (input.caseScope === "PRODUCT_INPUT" && input.localDate > input.referenceLocalDate) {
    return "FUTURE_BIRTH_DATE_NOT_ALLOWED";
  }
  trace.mark(input.timeKnown ? "INPUT-CIVIL-TIME-001" : "INPUT-UNKNOWN-TIME-002");
  if (!input.locationName || input.timeResolutionStatus === "LOCATION_REQUIRED") {
    return "LOCATION_REQUIRED";
  }
  trace.mark("TZ-IANA-001");
  if (!input.ianaTimezone || input.timeResolutionStatus === "TIMEZONE_REQUIRED") {
    return "TIMEZONE_REQUIRED";
  }
  if (input.timeResolutionStatus === "LOCATION_TIMEZONE_MISMATCH") {
    trace.mark("TZ-MAINLAND-002");
    return "LOCATION_TIMEZONE_MISMATCH";
  }
  if (input.timeResolutionStatus === "NONEXISTENT_LOCAL_TIME") {
    trace.mark("TZ-HISTORICAL-DST-003");
    return "NONEXISTENT_LOCAL_TIME";
  }
  if (input.timeResolutionStatus === "AMBIGUOUS_LOCAL_TIME") {
    trace.mark("TZ-HISTORICAL-DST-003");
    return "AMBIGUOUS_LOCAL_TIME";
  }
  if (input.timeResolutionStatus !== "READY") return "TIMEZONE_REQUIRED";
  if (input.timeKnown && parseLocalHour(input.localTime) === null) return "INVALID_CIVIL_TIME";
  return null;
}

function markBoundaryRules(
  input: NormalizedBaziCoreInput,
  data: BaziCoreData,
  trace: RuleTrace,
): void {
  trace.mark("SOLAR-TERM-RUNTIME-DATASET-001");
  trace.mark("CAL-JIEQI-INSTANT-003");
  if (input.timeKnown) {
    trace.mark("CAL-MINUTE-INTERVAL-005");
  } else {
    trace.mark("UNKNOWN-HOUR-001");
    trace.mark("UNKNOWN-HOUR-SOLAR-TERM-DAY-002");
  }
  const range = input.timeKnown ? input.minuteRangeUtc : input.localCivilDayRangeUtc;
  if (!range) return;
  const start = Date.parse(range.startUtc);
  const end = Date.parse(range.endUtcExclusive);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return;
  for (const record of data.solarTerms) {
    const instant = Date.parse(record.instant_utc);
    if (instant < start || instant >= end) continue;
    if (record.term_id === "LICHUN") trace.mark("YEAR-LICHUN-001");
    if (record.is_month_boundary_jie) trace.mark("MONTH-JIE-001");
  }
}

export function calculateBaziPillars(
  input: NormalizedBaziCoreInput,
  data: BaziCoreData,
): BaziCoreResult {
  const trace = createRuleTrace();
  const audit = auditFor(input, data, trace);
  const firstBlock = initialBlockingCode(input, trace);
  if (firstBlock) return blocked(audit, firstBlock);

  markBoundaryRules(input, data, trace);
  const boundary = resolveSolarTermBoundaries(input, data);
  audit.matchedLichun = boundary.matchedLichun?.instant_utc ?? null;
  audit.matchedMonthBoundary = boundary.matchedMonthBoundary?.instant_utc ?? null;
  if (boundary.blockingCode) return blocked(audit, boundary.blockingCode);

  trace.mark("YEAR-LICHUN-001");
  trace.mark("MONTH-JIE-001");

  trace.mark("DAY-BOUNDARY-003");
  trace.mark("DAY-BASELINE-001");
  trace.mark("DAY-CONTINUOUS-COUNT-002");
  const day = calculateCivilDay(input.localDate);
  if (!day) return blocked(audit, "INVALID_CIVIL_DATE");
  audit.dayAlgorithmAIndex = day.algorithmAIndex;
  audit.dayAlgorithmBIndex = day.algorithmBIndex;
  if (!day.algorithmsAgree) return blocked(audit, "DAY_ALGORITHM_CROSSCHECK_FAILED");

  const lichun = boundary.matchedLichun;
  const monthBoundary = boundary.matchedMonthBoundary;
  if (!lichun || !monthBoundary?.month_branch_after_boundary) {
    return blocked(audit, "SOLAR_TERM_DATA_UNAVAILABLE");
  }

  trace.mark("YEAR-CYCLE-003");
  const yearPillar = yearPillarForLichunYear(lichun.year);
  trace.mark("MONTH-FIVE-TIGER-002");
  const monthPillar = monthPillarForYearStem(
    yearPillar.stem,
    monthBoundary.month_branch_after_boundary,
  );
  const localHour = parseLocalHour(input.localTime);
  if (input.timeKnown && localHour !== null) {
    trace.mark("HOUR-BRANCH-001");
    trace.mark("HOUR-FIVE-RAT-002");
    if (localHour === 23 || localHour === 0) trace.mark("HOUR-ZI-DAY-COUPLING-003");
  }
  const hourPillar = input.timeKnown && localHour !== null
    ? hourPillarForDayStem(day.pillar.stem, localHour)
    : null;

  return {
    status: "READY",
    completeness: input.timeKnown ? "FOUR_PILLARS" : "THREE_PILLARS_ONLY",
    yearPillar,
    monthPillar,
    dayPillar: day.pillar,
    hourPillar,
    blockingCode: null,
    warnings: boundary.warnings,
    audit,
  };
}
