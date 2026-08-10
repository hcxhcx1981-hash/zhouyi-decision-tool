import type { BaziCaseScope, NormalizedBaziCoreInput } from "./runtime-types";

export type LocationTimezoneStatus = "MATCH" | "MISMATCH" | "UNKNOWN";

export interface RawBaziTimezoneInput {
  calendarType: "GREGORIAN" | "LUNAR";
  caseScope: BaziCaseScope;
  localDate: string;
  localTime: string | null;
  timeKnown: boolean;
  locationName: string | null;
  ianaTimezone: string | null;
  locationTimezoneStatus: LocationTimezoneStatus;
  foldChoice: "EARLIER" | "LATER" | null;
  referenceInstantUtc: string;
}

export interface FrozenTimezoneState {
  offset_seconds: number;
  is_dst: boolean;
  abbreviation: string;
}

export interface FrozenTimezoneTransition {
  instant_utc: string;
  offset_before_seconds: number;
  offset_after_seconds: number;
  is_dst_before: boolean;
  is_dst_after: boolean;
  abbreviation_before: string;
  abbreviation_after: string;
}

export interface FrozenTimezoneZone {
  zone_id: string;
  initial_state: FrozenTimezoneState;
  transitions: readonly FrozenTimezoneTransition[];
}

export interface FrozenTimezoneDataset {
  dataset_id: string;
  version: string;
  status: "FROZEN_RUNTIME_DATA";
  iana_release: string;
  python_tzdata_version: string;
  coverage: { start_utc: string; end_utc_exclusive: string };
  zone_count: number;
  transition_count: number;
  special_behavior_evidence: {
    international_date_line_jump: {
      zone_id: string;
      instant_utc: string;
      offset_change_seconds: number;
    };
  };
  zones: readonly FrozenTimezoneZone[];
}

export interface LoadedTimezoneData {
  dataset: FrozenTimezoneDataset;
  datasetSha256: string;
  zonesById: ReadonlyMap<string, FrozenTimezoneZone>;
}

export interface BaziTimezoneNormalizationResult {
  normalizedInput: NormalizedBaziCoreInput;
  resolvedOffsetSeconds: number | null;
  utcCandidateStarts: string[];
}
