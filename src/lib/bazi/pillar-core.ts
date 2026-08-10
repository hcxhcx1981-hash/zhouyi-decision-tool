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

const APPLIED_RULE_IDS = Object.freeze([
  "INPUT-CIVIL-TIME-001",
  "INPUT-UNKNOWN-TIME-002",
  "TZ-IANA-001",
  "CAL-GREGORIAN-ONLY-001",
  "CAL-ALGORITHM-RANGE-002A",
  "CAL-BIRTH-INPUT-RANGE-002B",
  "CAL-JIEQI-INSTANT-003",
  "CAL-MINUTE-INTERVAL-005",
  "YEAR-LICHUN-001",
  "YEAR-CYCLE-003",
  "MONTH-JIE-001",
  "MONTH-FIVE-TIGER-002",
  "DAY-BASELINE-001",
  "DAY-CONTINUOUS-COUNT-002",
  "DAY-BOUNDARY-003",
  "HOUR-BRANCH-001",
  "HOUR-FIVE-RAT-002",
  "HOUR-ZI-DAY-COUPLING-003",
  "UNKNOWN-HOUR-001",
  "UNKNOWN-HOUR-SOLAR-TERM-DAY-002",
  "SOLAR-TERM-RUNTIME-DATASET-001",
]);

function auditFor(input: NormalizedBaziCoreInput, data: BaziCoreData): BaziCoreAudit {
  return {
    rulesProtocolId: data.rulesProtocolId,
    rulesVersion: data.rulesVersion,
    datasetId: data.datasetId,
    datasetVersion: data.datasetVersion,
    datasetSha256: data.datasetSha256,
    appliedRuleIds: [...APPLIED_RULE_IDS],
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

function initialBlockingCode(input: NormalizedBaziCoreInput): string | null {
  if (input.calendarType !== "GREGORIAN") return "LUNAR_INPUT_NOT_SUPPORTED_V0_1";
  if (!parseCivilDate(input.localDate)) return "INVALID_CIVIL_DATE";
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
  if (!input.locationName || input.timeResolutionStatus === "LOCATION_REQUIRED") {
    return "LOCATION_REQUIRED";
  }
  if (!input.ianaTimezone || input.timeResolutionStatus === "TIMEZONE_REQUIRED") {
    return "TIMEZONE_REQUIRED";
  }
  if (input.timeResolutionStatus === "LOCATION_TIMEZONE_MISMATCH") {
    return "LOCATION_TIMEZONE_MISMATCH";
  }
  if (input.timeResolutionStatus === "NONEXISTENT_LOCAL_TIME") {
    return "NONEXISTENT_LOCAL_TIME";
  }
  if (input.timeResolutionStatus === "AMBIGUOUS_LOCAL_TIME") {
    return "AMBIGUOUS_LOCAL_TIME";
  }
  if (input.timeResolutionStatus !== "READY") return "TIMEZONE_REQUIRED";
  if (input.timeKnown && parseLocalHour(input.localTime) === null) return "INVALID_CIVIL_TIME";
  return null;
}

export function calculateBaziPillars(
  input: NormalizedBaziCoreInput,
  data: BaziCoreData,
): BaziCoreResult {
  const audit = auditFor(input, data);
  const firstBlock = initialBlockingCode(input);
  if (firstBlock) return blocked(audit, firstBlock);

  const boundary = resolveSolarTermBoundaries(input, data);
  audit.matchedLichun = boundary.matchedLichun?.instant_utc ?? null;
  audit.matchedMonthBoundary = boundary.matchedMonthBoundary?.instant_utc ?? null;
  if (boundary.blockingCode) return blocked(audit, boundary.blockingCode);

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

  const yearPillar = yearPillarForLichunYear(lichun.year);
  const monthPillar = monthPillarForYearStem(
    yearPillar.stem,
    monthBoundary.month_branch_after_boundary,
  );
  const localHour = parseLocalHour(input.localTime);
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
