#!/usr/bin/env python3
"""Build the deterministic, test-only normalized input fixture for Phase 2.2A."""

from __future__ import annotations

import hashlib
import importlib.metadata
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import TZPATH, ZoneInfo, ZoneInfoNotFoundError

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/frozen/bazi/bazi_calendar_test_cases_v0.1.1.json"
OUTPUT = ROOT / "tests/fixtures/bazi_core_normalized_cases_v0.1.1.json"
SHA_OUTPUT = Path(f"{OUTPUT}.sha256")
REFERENCE_DATE = date(2026, 8, 7)
RESOLVER_ID = "TEST_PYTHON_ZONEINFO_FIXTURE"
LOCATION_TIMEZONES = {
    "CN-MAINLAND": "Asia/Shanghai",
    "US-NY": "America/New_York",
    "US-LA": "America/Los_Angeles",
    "US-HNL": "Pacific/Honolulu",
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def timezone_data_version() -> str:
    try:
        return f"tzdata-{importlib.metadata.version('tzdata')}"
    except importlib.metadata.PackageNotFoundError:
        return "system-zoneinfo"


def expand_date(value: str | None) -> str:
    if value == "$CURRENT_LOCAL_DATE":
        return REFERENCE_DATE.isoformat()
    if value == "$CURRENT_LOCAL_DATE_PLUS_1_DAY":
        return (REFERENCE_DATE + timedelta(days=1)).isoformat()
    return value or ""


def parse_date(value: str) -> date | None:
    try:
        parsed = date.fromisoformat(value)
        return parsed if parsed.isoformat() == value else None
    except ValueError:
        return None


def parse_time(value: str | None) -> tuple[int, int] | None:
    if value is None:
        return None
    try:
        parsed = datetime.strptime(value, "%H:%M")
        return parsed.hour, parsed.minute
    except ValueError:
        return None


def valid_candidates(naive: datetime, zone: ZoneInfo) -> list[datetime]:
    candidates: list[datetime] = []
    utc_values: set[datetime] = set()
    for fold in (0, 1):
        local = naive.replace(tzinfo=zone, fold=fold)
        utc = local.astimezone(timezone.utc)
        roundtrip = utc.astimezone(zone)
        if roundtrip.replace(tzinfo=None) == naive and roundtrip.fold == fold and utc not in utc_values:
            candidates.append(local)
            utc_values.add(utc)
    return sorted(candidates, key=lambda item: item.astimezone(timezone.utc))


def expected_from_case(case: dict) -> dict:
    return {key: value for key, value in case.items() if key.startswith("expected_")}


def normalize_case(case: dict, tz_version: str) -> dict:
    source_input = case["input"]
    calendar_type = source_input["calendar_type"]
    local_date = expand_date(source_input.get("local_date"))
    local_time = source_input.get("local_time")
    time_known = source_input["time_known"]
    location_name = source_input.get("location_name")
    timezone_name = source_input.get("iana_timezone")
    location_id = source_input.get("location_id")
    fold_choice = source_input.get("fold_choice")
    status = "READY"
    minute_range = None
    day_range = None
    resolved_utc_offset = None

    if not location_name:
        status = "LOCATION_REQUIRED"
    elif not timezone_name:
        status = "TIMEZONE_REQUIRED"
    elif location_id and LOCATION_TIMEZONES.get(location_id) != timezone_name:
        status = "LOCATION_TIMEZONE_MISMATCH"

    zone = None
    if status == "READY":
        try:
            zone = ZoneInfo(timezone_name)
        except ZoneInfoNotFoundError:
            status = "TIMEZONE_REQUIRED"

    parsed_date = parse_date(local_date)
    parsed_time = parse_time(local_time)
    if status == "READY" and zone and parsed_date:
        start_naive = datetime.combine(parsed_date, datetime.min.time())
        end_naive = start_naive + timedelta(days=1)
        start_candidates = valid_candidates(start_naive, zone)
        end_candidates = valid_candidates(end_naive, zone)
        if start_candidates and end_candidates:
            day_range = {
                "startUtc": iso_utc(start_candidates[0]),
                "endUtcExclusive": iso_utc(end_candidates[0]),
            }

        if time_known and parsed_time:
            naive = datetime(parsed_date.year, parsed_date.month, parsed_date.day, *parsed_time)
            candidates = valid_candidates(naive, zone)
            if not candidates:
                status = "NONEXISTENT_LOCAL_TIME"
            elif len(candidates) > 1 and fold_choice not in ("EARLIER", "LATER"):
                status = "AMBIGUOUS_LOCAL_TIME"
            else:
                chosen = candidates[-1] if fold_choice == "LATER" else candidates[0]
                start_utc = chosen.astimezone(timezone.utc)
                offset = chosen.utcoffset()
                if offset is not None:
                    total_minutes = int(offset.total_seconds() // 60)
                    sign = "+" if total_minutes >= 0 else "-"
                    absolute = abs(total_minutes)
                    resolved_utc_offset = f"{sign}{absolute // 60:02d}:{absolute % 60:02d}"
                minute_range = {
                    "startUtc": iso_utc(start_utc),
                    "endUtcExclusive": iso_utc(start_utc + timedelta(minutes=1)),
                }

    normalized = {
        "calendarType": calendar_type,
        "caseScope": case["case_scope"],
        "localDate": local_date,
        "localTime": local_time,
        "timeKnown": time_known,
        "locationName": location_name,
        "ianaTimezone": timezone_name,
        "timeResolutionStatus": status,
        "foldChoice": fold_choice,
        "minuteRangeUtc": minute_range,
        "localCivilDayRangeUtc": day_range,
        "referenceLocalDate": REFERENCE_DATE.isoformat(),
        "timezoneResolverId": RESOLVER_ID,
        "timezoneDataVersion": tz_version,
    }
    return {
        "source_case_id": case["case_id"],
        "normalized_input": normalized,
        "normalization_evidence": {"resolved_utc_offset": resolved_utc_offset},
        "expected": expected_from_case(case),
    }


def main() -> int:
    source_bytes = SOURCE.read_bytes()
    source = json.loads(source_bytes.decode("utf-8"))
    tz_version = timezone_data_version()
    fixture = {
        "fixture_id": "BAZI_CORE_NORMALIZED_CASES_V0_1_1",
        "version": "0.1.1",
        "status": "TEST_ONLY_NOT_FOR_RUNTIME",
        "source_cases_sha256": sha256_bytes(source_bytes),
        "reference_local_date": REFERENCE_DATE.isoformat(),
        "timezone_resolver_id": RESOLVER_ID,
        "timezone_data_version": tz_version,
        "python_version": sys.version.split()[0],
        "zoneinfo_tzpath": [str(path) for path in TZPATH],
        "case_count": len(source["cases"]),
        "cases": [normalize_case(case, tz_version) for case in source["cases"]],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    output_bytes = (json.dumps(fixture, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    OUTPUT.write_bytes(output_bytes)
    digest = sha256_bytes(output_bytes)
    SHA_OUTPUT.write_text(f"{digest}  {OUTPUT.name}\n", encoding="ascii", newline="\n")
    print(f"PASS: built {len(fixture['cases'])} test-only normalized cases")
    print(f"SHA-256: {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
