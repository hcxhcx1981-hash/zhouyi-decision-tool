import type { TimeResolutionStatus } from "./runtime-types";
import type {
  BaziTimezoneNormalizationResult,
  LoadedTimezoneData,
  RawBaziTimezoneInput,
} from "./timezone-runtime-types";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { hasFrozenTimezone, resolveKnownLocalMinute, resolveLocalCivilDay, resolveReferenceLocalDate } from "./timezone-resolver.ts";

const RESOLVER_ID = "FROZEN_IANA_TZDB_2026C_V0_1_0";
const DATA_VERSION = "IANA_2026c_TZDATA_2026.3_DATASET_0.1.0";

export function normalizeBaziTime(
  input: RawBaziTimezoneInput,
  data: LoadedTimezoneData,
): BaziTimezoneNormalizationResult {
  let status: TimeResolutionStatus = "READY";
  const zoneAvailable = Boolean(input.ianaTimezone && hasFrozenTimezone(data, input.ianaTimezone));
  if (!input.locationName) status = "LOCATION_REQUIRED";
  else if (!zoneAvailable) status = "TIMEZONE_REQUIRED";
  else if (input.locationTimezoneStatus === "MISMATCH") status = "LOCATION_TIMEZONE_MISMATCH";

  let referenceLocalDate = input.referenceInstantUtc.slice(0, 10);
  if (zoneAvailable && input.ianaTimezone) {
    referenceLocalDate = resolveReferenceLocalDate(data, input.ianaTimezone, input.referenceInstantUtc);
  }

  let minuteRangeUtc = null;
  let localCivilDayRangeUtc = null;
  let resolvedOffsetSeconds: number | null = null;
  let utcCandidateStarts: string[] = [];
  if (status === "READY" && input.ianaTimezone) {
    const day = resolveLocalCivilDay(data, input.ianaTimezone, input.localDate);
    localCivilDayRangeUtc = day.localCivilDayRangeUtc;
    if (!input.timeKnown) {
      if (day.status !== "READY") status = "NONEXISTENT_LOCAL_TIME";
    } else if (input.localTime !== null) {
      const minute = resolveKnownLocalMinute(
        data,
        input.ianaTimezone,
        input.localDate,
        input.localTime,
        input.foldChoice,
      );
      status = minute.status;
      minuteRangeUtc = minute.minuteRangeUtc;
      resolvedOffsetSeconds = minute.resolvedOffsetSeconds;
      utcCandidateStarts = minute.utcCandidateStarts;
    }
  }

  return {
    normalizedInput: {
      calendarType: input.calendarType,
      caseScope: input.caseScope,
      localDate: input.localDate,
      localTime: input.localTime,
      timeKnown: input.timeKnown,
      locationName: input.locationName,
      ianaTimezone: input.ianaTimezone,
      timeResolutionStatus: status,
      foldChoice: input.foldChoice,
      minuteRangeUtc,
      localCivilDayRangeUtc,
      referenceLocalDate,
      timezoneResolverId: RESOLVER_ID,
      timezoneDataVersion: DATA_VERSION,
    },
    resolvedOffsetSeconds,
    utcCandidateStarts,
  };
}
