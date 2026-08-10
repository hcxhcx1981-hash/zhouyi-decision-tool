import type { LoadedLocationData, RawLocationSelection, ResolvedLocationBinding } from "./location-runtime-types";
import type { LoadedTimezoneData } from "./timezone-runtime-types";

export function resolveLocationSelection(
  selection: RawLocationSelection,
  locationData: LoadedLocationData,
  timezoneData: LoadedTimezoneData,
): ResolvedLocationBinding {
  const common = {
    registryId: locationData.registry.registry_id,
    registryVersion: locationData.registry.version,
    selectionMode: selection.mode,
  } as const;

  if (selection.mode === "REGISTERED_LOCATION") {
    const registered = selection.locationId ? locationData.locationsById.get(selection.locationId) : undefined;
    if (!registered || !timezoneData.zonesById.has(registered.zone_id)) {
      return {
        ...common,
        locationId: selection.locationId,
        locationName: null,
        ianaTimezone: null,
        locationTimezoneStatus: "UNKNOWN",
        sourceKind: "UNKNOWN_REGISTERED_LOCATION",
      };
    }
    return {
      ...common,
      locationId: registered.location_id,
      locationName: selection.locationName,
      ianaTimezone: registered.zone_id,
      locationTimezoneStatus: selection.claimedIanaTimezone === null || selection.claimedIanaTimezone === registered.zone_id ? "MATCH" : "MISMATCH",
      sourceKind: registered.source_kind,
    };
  }

  const zone = selection.claimedIanaTimezone;
  return {
    ...common,
    locationId: null,
    locationName: selection.locationName,
    ianaTimezone: zone && timezoneData.zonesById.has(zone) ? zone : null,
    locationTimezoneStatus: "UNKNOWN",
    sourceKind: "MANUAL_IANA_SELECTION",
  };
}
