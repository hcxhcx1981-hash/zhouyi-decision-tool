import type { LocationSelectionMode, RawBaziDeterministicInput } from "./location-runtime-types";

export type BaziPageGender = "MALE" | "FEMALE";

export interface BaziPageDraft {
  calendarType: "GREGORIAN" | "LUNAR";
  localDate: string;
  localTime: string | null;
  timeKnown: boolean;
  gender: BaziPageGender;
  locationName: string | null;
  selectionMode: LocationSelectionMode;
  registeredLocationId: string | null;
  manualIanaTimezone: string | null;
  foldChoice: "EARLIER" | "LATER" | null;
  referenceInstantUtc: string;
}

export interface BaziPageResolutionState {
  foldChoice: "EARLIER" | "LATER" | null;
  referenceInstantUtc: string | null;
}

export interface ResolvedBaziPageSubmission {
  foldChoice: "EARLIER" | "LATER" | null;
  referenceInstantUtc: string;
}

export const EMPTY_BAZI_PAGE_RESOLUTION: BaziPageResolutionState = {
  foldChoice: null,
  referenceInstantUtc: null,
};

export function resetBaziPageResolution(): BaziPageResolutionState {
  return { ...EMPTY_BAZI_PAGE_RESOLUTION };
}

export function beginBaziPageSubmission(
  state: BaziPageResolutionState,
  clock: () => string,
): ResolvedBaziPageSubmission {
  const generatedReference = state.referenceInstantUtc ?? clock();
  return {
    foldChoice: state.foldChoice,
    referenceInstantUtc: generatedReference.replace(/\.\d{3}Z$/, "Z"),
  };
}

export function toRawBaziDeterministicInput(draft: BaziPageDraft): RawBaziDeterministicInput {
  return {
    calendarType: draft.calendarType,
    caseScope: "PRODUCT_INPUT",
    localDate: draft.localDate,
    localTime: draft.timeKnown ? draft.localTime : null,
    timeKnown: draft.timeKnown,
    foldChoice: draft.foldChoice,
    referenceInstantUtc: draft.referenceInstantUtc,
    locationSelection: {
      mode: draft.selectionMode,
      locationId: draft.selectionMode === "REGISTERED_LOCATION" ? draft.registeredLocationId : null,
      locationName: draft.locationName,
      claimedIanaTimezone: draft.selectionMode === "MANUAL_IANA" ? draft.manualIanaTimezone : null,
    },
  };
}
