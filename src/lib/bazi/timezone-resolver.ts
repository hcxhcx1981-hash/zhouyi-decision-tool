// @ts-expect-error Node's strip-types test runner requires the explicit TypeScript extension.
import { parseCivilDate } from "./civil-day.ts";
import type { FrozenTimezoneZone, LoadedTimezoneData } from "./timezone-runtime-types";
import type { UtcHalfOpenRange } from "./runtime-types";

interface UtcInterval {
  startMs: number;
  endMs: number;
  offsetSeconds: number;
}

export interface KnownTimeResolution {
  status: "READY" | "NONEXISTENT_LOCAL_TIME" | "AMBIGUOUS_LOCAL_TIME";
  minuteRangeUtc: UtcHalfOpenRange | null;
  resolvedOffsetSeconds: number | null;
  utcCandidateStarts: string[];
}

export interface CivilDayResolution {
  status: "READY" | "NONEXISTENT_LOCAL_TIME";
  localCivilDayRangeUtc: UtcHalfOpenRange | null;
}

function strictUtcMs(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) {
    throw new Error("TIMEZONE_DATA_INTEGRITY_ERROR");
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error("TIMEZONE_DATA_INTEGRITY_ERROR");
  return parsed;
}

function utcText(value: number): string {
  return new Date(value).toISOString().replace(".000Z", "Z");
}

function localEpochMs(localDate: string, localTime = "00:00"): number | null {
  const date = parseCivilDate(localDate);
  const match = /^(\d{2}):(\d{2})$/.exec(localTime);
  if (!date || !match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return Date.UTC(date.year, date.month - 1, date.day, hour, minute);
}

function intervalsFor(zone: FrozenTimezoneZone, data: LoadedTimezoneData): UtcInterval[] {
  const coverageStart = strictUtcMs(data.dataset.coverage.start_utc);
  const coverageEnd = strictUtcMs(data.dataset.coverage.end_utc_exclusive);
  const intervals: UtcInterval[] = [];
  let startMs = coverageStart;
  let offsetSeconds = zone.initial_state.offset_seconds;
  for (const transition of zone.transitions) {
    const instant = strictUtcMs(transition.instant_utc);
    if (instant <= startMs || transition.offset_before_seconds !== offsetSeconds) {
      throw new Error("TIMEZONE_DATA_INTEGRITY_ERROR");
    }
    intervals.push({ startMs, endMs: instant, offsetSeconds });
    startMs = instant;
    offsetSeconds = transition.offset_after_seconds;
  }
  intervals.push({ startMs, endMs: coverageEnd, offsetSeconds });
  return intervals;
}

function findZone(data: LoadedTimezoneData, zoneId: string): FrozenTimezoneZone | null {
  return data.zonesById.get(zoneId) ?? null;
}

export function hasFrozenTimezone(data: LoadedTimezoneData, zoneId: string): boolean {
  return findZone(data, zoneId) !== null;
}

export function resolveKnownLocalMinute(
  data: LoadedTimezoneData,
  zoneId: string,
  localDate: string,
  localTime: string,
  foldChoice: "EARLIER" | "LATER" | null,
): KnownTimeResolution {
  const zone = findZone(data, zoneId);
  const localStart = localEpochMs(localDate, localTime);
  if (!zone || localStart === null) {
    return { status: "NONEXISTENT_LOCAL_TIME", minuteRangeUtc: null, resolvedOffsetSeconds: null, utcCandidateStarts: [] };
  }
  const localEnd = localStart + 60_000;
  const segments = intervalsFor(zone, data).flatMap((interval) => {
    const mappedLocalStart = interval.startMs + interval.offsetSeconds * 1000;
    const mappedLocalEnd = interval.endMs + interval.offsetSeconds * 1000;
    const overlapStart = Math.max(localStart, mappedLocalStart);
    const overlapEnd = Math.min(localEnd, mappedLocalEnd);
    return overlapStart < overlapEnd
      ? [{
          utcStart: overlapStart - interval.offsetSeconds * 1000,
          utcEnd: overlapEnd - interval.offsetSeconds * 1000,
          offsetSeconds: interval.offsetSeconds,
        }]
      : [];
  }).sort((left, right) => left.utcStart - right.utcStart || left.utcEnd - right.utcEnd);
  const candidates = segments.reduce<typeof segments>((merged, segment) => {
    const previous = merged.at(-1);
    if (
      previous &&
      previous.offsetSeconds === segment.offsetSeconds &&
      segment.utcStart <= previous.utcEnd
    ) {
      previous.utcEnd = Math.max(previous.utcEnd, segment.utcEnd);
    } else {
      merged.push({ ...segment });
    }
    return merged;
  }, []);

  if (candidates.length === 0) {
    return { status: "NONEXISTENT_LOCAL_TIME", minuteRangeUtc: null, resolvedOffsetSeconds: null, utcCandidateStarts: [] };
  }
  if (candidates.length > 2) throw new Error("TIMEZONE_DATA_INTEGRITY_ERROR");
  const utcCandidateStarts = candidates.map((candidate) => utcText(candidate.utcStart));
  if (candidates.length === 2 && foldChoice === null) {
    return { status: "AMBIGUOUS_LOCAL_TIME", minuteRangeUtc: null, resolvedOffsetSeconds: null, utcCandidateStarts };
  }
  const selected = candidates.length === 1 || foldChoice !== "LATER" ? candidates[0] : candidates[1];
  return {
    status: "READY",
    minuteRangeUtc: { startUtc: utcText(selected.utcStart), endUtcExclusive: utcText(selected.utcEnd) },
    resolvedOffsetSeconds: selected.offsetSeconds,
    utcCandidateStarts,
  };
}

export function resolveLocalCivilDay(
  data: LoadedTimezoneData,
  zoneId: string,
  localDate: string,
): CivilDayResolution {
  const zone = findZone(data, zoneId);
  const localStart = localEpochMs(localDate);
  if (!zone || localStart === null) {
    return { status: "NONEXISTENT_LOCAL_TIME", localCivilDayRangeUtc: null };
  }
  const localEnd = localStart + 86_400_000;
  const segments = intervalsFor(zone, data).flatMap((interval) => {
    const mappedLocalStart = interval.startMs + interval.offsetSeconds * 1000;
    const mappedLocalEnd = interval.endMs + interval.offsetSeconds * 1000;
    const overlapStart = Math.max(localStart, mappedLocalStart);
    const overlapEnd = Math.min(localEnd, mappedLocalEnd);
    return overlapStart < overlapEnd
      ? [{ startMs: overlapStart - interval.offsetSeconds * 1000, endMs: overlapEnd - interval.offsetSeconds * 1000 }]
      : [];
  }).sort((left, right) => left.startMs - right.startMs);
  if (segments.length === 0) {
    return { status: "NONEXISTENT_LOCAL_TIME", localCivilDayRangeUtc: null };
  }
  const startMs = segments[0].startMs;
  let endMs = segments[0].endMs;
  for (const segment of segments.slice(1)) {
    if (segment.startMs > endMs) throw new Error("TIMEZONE_DATA_INTEGRITY_ERROR");
    endMs = Math.max(endMs, segment.endMs);
  }
  return { status: "READY", localCivilDayRangeUtc: { startUtc: utcText(startMs), endUtcExclusive: utcText(endMs) } };
}

export function resolveReferenceLocalDate(
  data: LoadedTimezoneData,
  zoneId: string,
  referenceInstantUtc: string,
): string {
  const zone = findZone(data, zoneId);
  const instant = strictUtcMs(referenceInstantUtc);
  if (!zone) throw new Error("TIMEZONE_REQUIRED");
  const interval = intervalsFor(zone, data).find((candidate) => instant >= candidate.startMs && instant < candidate.endMs);
  if (!interval) throw new Error("TIMEZONE_DATA_INTEGRITY_ERROR");
  return new Date(instant + interval.offsetSeconds * 1000).toISOString().slice(0, 10);
}
