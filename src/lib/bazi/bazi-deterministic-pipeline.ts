import type { BaziDeterministicPipelineData, BaziDeterministicPipelineResult, RawBaziDeterministicInput } from "./location-runtime-types";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { resolveLocationSelection } from "./location-resolver.ts";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { normalizeBaziTime } from "./bazi-time-normalizer.ts";
// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { calculateBaziPillars } from "./pillar-core.ts";

export function calculateDeterministicBazi(
  input: RawBaziDeterministicInput,
  data: BaziDeterministicPipelineData,
): BaziDeterministicPipelineResult {
  const binding = resolveLocationSelection(input.locationSelection, data.locationData, data.timezoneData);
  const timezoneAudit = normalizeBaziTime({
    calendarType: input.calendarType,
    caseScope: input.caseScope,
    localDate: input.localDate,
    localTime: input.localTime,
    timeKnown: input.timeKnown,
    locationName: binding.locationName,
    ianaTimezone: binding.ianaTimezone,
    locationTimezoneStatus: binding.locationTimezoneStatus,
    foldChoice: input.foldChoice,
    referenceInstantUtc: input.referenceInstantUtc,
  }, data.timezoneData);
  return {
    locationAudit: {
      locationRegistryId: binding.registryId,
      locationRegistryVersion: binding.registryVersion,
      locationSelectionMode: binding.selectionMode,
      locationId: binding.locationId,
      locationName: binding.locationName,
      locationTimezoneStatus: binding.locationTimezoneStatus,
      resolvedIanaTimezone: binding.ianaTimezone,
      sourceKind: binding.sourceKind,
    },
    timezoneAudit,
    coreResult: calculateBaziPillars(timezoneAudit.normalizedInput, data.baziData),
  };
}
