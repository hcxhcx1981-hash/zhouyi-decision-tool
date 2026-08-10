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

export interface LatestRequestGate {
  begin(): number;
  invalidate(): void;
  isCurrent(requestId: number): boolean;
}

export interface LatestRequestHandlers<T> {
  onSuccess(value: T): void;
  onError(error: unknown): void;
  onFinally(): void;
}

export const EMPTY_BAZI_PAGE_RESOLUTION: BaziPageResolutionState = {
  foldChoice: null,
  referenceInstantUtc: null,
};

export function resetBaziPageResolution(): BaziPageResolutionState {
  return { ...EMPTY_BAZI_PAGE_RESOLUTION };
}

export function beginBaziPageSubmission(clock: () => string): ResolvedBaziPageSubmission {
  return {
    foldChoice: null,
    referenceInstantUtc: clock().replace(/\.\d{3}Z$/, "Z"),
  };
}

export function createLatestRequestGate(): LatestRequestGate {
  let latestRequestId = 0;
  return {
    begin() {
      latestRequestId += 1;
      return latestRequestId;
    },
    invalidate() {
      latestRequestId += 1;
    },
    isCurrent(requestId) {
      return requestId === latestRequestId;
    },
  };
}

export async function settleLatestRequest<T>(
  gate: LatestRequestGate,
  requestId: number,
  task: Promise<T>,
  handlers: LatestRequestHandlers<T>,
): Promise<boolean> {
  try {
    const value = await task;
    if (!gate.isCurrent(requestId)) return false;
    handlers.onSuccess(value);
  } catch (error) {
    if (!gate.isCurrent(requestId)) return false;
    handlers.onError(error);
  } finally {
    if (gate.isCurrent(requestId)) handlers.onFinally();
  }
  return true;
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
