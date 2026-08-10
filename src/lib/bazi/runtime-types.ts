export type BaziCaseScope = "PRODUCT_INPUT" | "ALGORITHM_VALIDATION";

export type TimeResolutionStatus =
  | "READY"
  | "LOCATION_REQUIRED"
  | "TIMEZONE_REQUIRED"
  | "LOCATION_TIMEZONE_MISMATCH"
  | "NONEXISTENT_LOCAL_TIME"
  | "AMBIGUOUS_LOCAL_TIME";

export interface UtcHalfOpenRange {
  startUtc: string;
  endUtcExclusive: string;
}

export interface NormalizedBaziCoreInput {
  calendarType: "GREGORIAN" | "LUNAR";
  caseScope: BaziCaseScope;
  localDate: string;
  localTime: string | null;
  timeKnown: boolean;
  locationName: string | null;
  ianaTimezone: string | null;
  timeResolutionStatus: TimeResolutionStatus;
  foldChoice: "EARLIER" | "LATER" | null;
  minuteRangeUtc: UtcHalfOpenRange | null;
  localCivilDayRangeUtc: UtcHalfOpenRange | null;
  referenceLocalDate: string;
  timezoneResolverId: string;
  timezoneDataVersion: string;
}

export interface BaziSolarTermRecord {
  year: number;
  term_id: string;
  term_name_zh: string;
  is_month_boundary_jie: boolean;
  is_zhongqi: boolean;
  month_branch_after_boundary: string | null;
  instant_utc: string;
}

export interface BaziCoreData {
  rulesProtocolId: string;
  rulesVersion: string;
  datasetId: string;
  datasetVersion: string;
  datasetSha256: string;
  solarTerms: readonly BaziSolarTermRecord[];
}

export type BaziCoreStatus = "READY" | "BLOCKED";
export type BaziCompleteness = "FOUR_PILLARS" | "THREE_PILLARS_ONLY" | "NONE";

export interface BaziPillar {
  stem: string;
  branch: string;
  text: string;
  cycleIndex: number;
}

export interface BaziCoreAudit {
  rulesProtocolId: string;
  rulesVersion: string;
  datasetId: string;
  datasetVersion: string;
  datasetSha256: string;
  appliedRuleIds: string[];
  matchedLichun: string | null;
  matchedMonthBoundary: string | null;
  dayAlgorithmAIndex: number | null;
  dayAlgorithmBIndex: number | null;
  timezoneResolverId: string;
  timezoneDataVersion: string;
}

export interface BaziCoreResult {
  status: BaziCoreStatus;
  completeness: BaziCompleteness;
  yearPillar: BaziPillar | null;
  monthPillar: BaziPillar | null;
  dayPillar: BaziPillar | null;
  hourPillar: BaziPillar | null;
  blockingCode: string | null;
  warnings: string[];
  audit: BaziCoreAudit;
}
