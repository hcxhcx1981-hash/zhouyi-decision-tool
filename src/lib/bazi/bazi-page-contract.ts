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
