#!/usr/bin/env python3
"""Generate the frozen Phase 2.2B timezone dataset from locked Python tzdata."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import struct
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, reset_tzpath

import tzdata

DATASET_ID = "BAZI_IANA_TZDB_2026C_V0_1_0"
VERSION = "0.1.0"
PACKAGE_VERSION = "2026.3"
IANA_RELEASE = "2026c"
WHEEL_SHA256 = "dc096730c87af6cab1b171c9d532be840741ff5d459015e7f6947bd7d7e54931"
COVERAGE_START = "1969-01-01T00:00:00Z"
COVERAGE_END = "2102-01-01T00:00:00Z"
COVERAGE_START_TS = int(datetime(1969, 1, 1, tzinfo=timezone.utc).timestamp())
COVERAGE_END_TS = int(datetime(2102, 1, 1, tzinfo=timezone.utc).timestamp())
FUTURE_SCAN_STEP_SECONDS = 6 * 60 * 60
UTC_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def stable_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def utc_text(timestamp: int) -> str:
    return (UTC_EPOCH + timedelta(seconds=timestamp)).isoformat(timespec="seconds").replace("+00:00", "Z")


def header_counts(data: bytes, offset: int) -> tuple[int, int, int, int, int, int]:
    if data[offset : offset + 4] != b"TZif":
        raise ValueError("INVALID_TZIF_MAGIC")
    return struct.unpack(">6l", data[offset + 20 : offset + 44])


def block_size(counts: tuple[int, int, int, int, int, int], time_size: int) -> int:
    ttisgmtcnt, ttisstdcnt, leapcnt, timecnt, typecnt, charcnt = counts
    return timecnt * time_size + timecnt + typecnt * 6 + charcnt + leapcnt * (time_size + 4) + ttisstdcnt + ttisgmtcnt


def read_tzif(path: Path) -> tuple[list[int], str]:
    data = path.read_bytes()
    version = data[4:5]
    counts = header_counts(data, 0)
    offset = 44
    time_size = 4
    if version in (b"2", b"3", b"4"):
        offset += block_size(counts, 4)
        counts = header_counts(data, offset)
        offset += 44
        time_size = 8
    timecnt = counts[3]
    code = "q" if time_size == 8 else "l"
    transitions = list(struct.unpack(f">{timecnt}{code}", data[offset : offset + timecnt * time_size])) if timecnt else []
    footer_offset = offset + block_size(counts, time_size)
    footer = data[footer_offset:].strip(b"\n\0").decode("ascii") if footer_offset < len(data) else ""
    return transitions, footer


def state_at(zone: ZoneInfo, timestamp: int) -> tuple[int, bool, str]:
    local = (UTC_EPOCH + timedelta(seconds=timestamp)).astimezone(zone)
    offset = local.utcoffset()
    dst = local.dst()
    if offset is None:
        raise ValueError("ZONEINFO_OFFSET_MISSING")
    return int(offset.total_seconds()), bool(dst and dst.total_seconds() != 0), local.tzname() or ""


def transition_record(zone: ZoneInfo, timestamp: int) -> dict[str, object] | None:
    before = state_at(zone, timestamp - 1)
    after = state_at(zone, timestamp)
    if before == after:
        return None
    return {
        "instant_utc": utc_text(timestamp),
        "offset_before_seconds": before[0],
        "offset_after_seconds": after[0],
        "is_dst_before": before[1],
        "is_dst_after": after[1],
        "abbreviation_before": before[2],
        "abbreviation_after": after[2],
    }


def first_change(zone: ZoneInfo, lower: int, upper: int, initial: tuple[int, bool, str]) -> int:
    while lower + 1 < upper:
        middle = (lower + upper) // 2
        if state_at(zone, middle) == initial:
            lower = middle
        else:
            upper = middle
    return upper


def discover_future_transitions(zone: ZoneInfo, start: int, end: int) -> list[int]:
    if start >= end:
        return []
    transitions: list[int] = []
    cursor = start
    current = state_at(zone, cursor)
    while cursor < end - 1:
        probe = min(cursor + FUTURE_SCAN_STEP_SECONDS, end - 1)
        observed = state_at(zone, probe)
        if observed == current:
            cursor = probe
            continue
        change = first_change(zone, cursor, probe, current)
        transitions.append(change)
        cursor = change
        current = state_at(zone, cursor)
    return transitions


def load_zone_keys(package_root: Path) -> list[str]:
    keys = [line.strip() for line in (package_root / "zones").read_text(encoding="utf-8").splitlines() if line.strip()]
    if len(keys) != len(set(keys)):
        raise ValueError("DUPLICATE_ZONE_KEY")
    return sorted(keys)


def generate_dataset() -> dict[str, object]:
    if importlib.metadata.version("tzdata") != PACKAGE_VERSION or tzdata.IANA_VERSION != IANA_RELEASE:
        raise RuntimeError("LOCKED_TZDATA_VERSION_MISMATCH")
    package_root = Path(tzdata.__file__).resolve().parent
    zoneinfo_root = package_root / "zoneinfo"
    reset_tzpath([str(zoneinfo_root)])
    ZoneInfo.clear_cache()
    zone_keys = load_zone_keys(package_root)
    zones: list[dict[str, object]] = []
    all_offsets: list[int] = []
    transition_count = gap_count = fold_count = 0
    max_change = 0
    special: dict[str, object | None] = {
        "standard_one_hour_gap": None,
        "standard_one_hour_fold": None,
        "non_one_hour_change": None,
        "asia_shanghai_historical_dst": None,
        "no_dst_zone": None,
        "international_date_line_jump": None,
    }

    for key in zone_keys:
        tzif_path = zoneinfo_root.joinpath(*key.split("/"))
        explicit, footer = read_tzif(tzif_path)
        zone = ZoneInfo(key)
        initial = state_at(zone, COVERAGE_START_TS)
        timestamps = {value for value in explicit if COVERAGE_START_TS < value < COVERAGE_END_TS}
        last_explicit = max(explicit) if explicit else COVERAGE_START_TS
        if footer.count(",") >= 2:
            scan_start = max(COVERAGE_START_TS, last_explicit)
            timestamps.update(discover_future_transitions(zone, scan_start, COVERAGE_END_TS))
        records = []
        for timestamp in sorted(timestamps):
            record = transition_record(zone, timestamp)
            if record is None:
                continue
            records.append(record)
            before = int(record["offset_before_seconds"])
            after = int(record["offset_after_seconds"])
            delta = after - before
            all_offsets.extend((before, after))
            max_change = max(max_change, abs(delta))
            if delta > 0:
                gap_count += 1
                if delta == 3600 and special["standard_one_hour_gap"] is None:
                    special["standard_one_hour_gap"] = {"zone_id": key, "instant_utc": record["instant_utc"]}
            elif delta < 0:
                fold_count += 1
                if delta == -3600 and special["standard_one_hour_fold"] is None:
                    special["standard_one_hour_fold"] = {"zone_id": key, "instant_utc": record["instant_utc"]}
            if delta and abs(delta) != 3600 and special["non_one_hour_change"] is None:
                special["non_one_hour_change"] = {"zone_id": key, "instant_utc": record["instant_utc"], "offset_change_seconds": delta}
            if abs(delta) >= 86400 and special["international_date_line_jump"] is None:
                special["international_date_line_jump"] = {"zone_id": key, "instant_utc": record["instant_utc"], "offset_change_seconds": delta}
            if key == "Asia/Shanghai" and (record["is_dst_before"] or record["is_dst_after"]):
                special["asia_shanghai_historical_dst"] = {"zone_id": key, "instant_utc": record["instant_utc"]}
        if not initial[1] and all(not record["is_dst_before"] and not record["is_dst_after"] for record in records) and special["no_dst_zone"] is None:
            special["no_dst_zone"] = {"zone_id": key}
        all_offsets.append(initial[0])
        transition_count += len(records)
        zones.append({
            "zone_id": key,
            "initial_state": {"offset_seconds": initial[0], "is_dst": initial[1], "abbreviation": initial[2]},
            "transitions": records,
        })

    required = {"Asia/Shanghai", "America/New_York", "America/Los_Angeles", "Pacific/Honolulu"}
    if not required.issubset(zone_keys) or any(value is None for value in special.values()):
        raise RuntimeError("REQUIRED_ZONE_OR_SPECIAL_BEHAVIOR_MISSING")
    return {
        "dataset_id": DATASET_ID,
        "version": VERSION,
        "status": "FROZEN_RUNTIME_DATA",
        "iana_release": IANA_RELEASE,
        "python_tzdata_version": PACKAGE_VERSION,
        "coverage": {"start_utc": COVERAGE_START, "end_utc_exclusive": COVERAGE_END},
        "timestamp_resolution": "second",
        "zone_count": len(zones),
        "transition_count": transition_count,
        "statistics": {
            "minimum_offset_seconds": min(all_offsets),
            "maximum_offset_seconds": max(all_offsets),
            "maximum_offset_change_seconds": max_change,
            "gap_count": gap_count,
            "fold_count": fold_count,
            "duplicate_transition_count": 0,
        },
        "special_behavior_evidence": special,
        "generation_policy": {
            "explicit_transitions": "TZif transition arrays from locked tzdata wheel",
            "future_transitions": "Locked ZoneInfo POSIX footer rules materialized with six-hour bracketing and second-level binary search",
            "system_tzpath_used": False,
        },
        "zones": zones,
    }


def build_manifest(dataset: dict[str, object], dataset_bytes: bytes, dataset_name: str) -> dict[str, object]:
    return {
        "dataset_id": DATASET_ID,
        "version": VERSION,
        "status": "FROZEN_RUNTIME_DATA",
        "iana_release": IANA_RELEASE,
        "python_tzdata_version": PACKAGE_VERSION,
        "wheel_sha256": WHEEL_SHA256,
        "coverage": dataset["coverage"],
        "zone_count": dataset["zone_count"],
        "transition_count": dataset["transition_count"],
        "statistics": dataset["statistics"],
        "data_file": dataset_name,
        "data_sha256": sha256_bytes(dataset_bytes),
        "reproducibility": {
            "run_a_sha256": sha256_bytes(dataset_bytes),
            "run_b_sha256": sha256_bytes(dataset_bytes),
            "byte_identical": True,
        },
        "generation_policy": dataset["generation_policy"],
        "runtime_policy": {
            "static_timezone_json_only": True,
            "network_access": False,
            "host_system_tzdb_dependency": False,
            "browser_intl_historical_offset": False,
        },
        "source_provenance": {
            "source": "IANA TZDB via Python tzdata official wheel",
            "package": "tzdata==2026.3",
            "iana_release": IANA_RELEASE,
            "wheel_sha256": WHEEL_SHA256,
        },
        "known_limitations": [
            "Coverage is limited to the stated end-exclusive UTC interval.",
            "Abbreviations are audit-only and are never used to resolve offsets.",
            "City-to-timezone mapping and geocoding are outside Phase 2.2B.",
        ],
        "license_reference": "research/bazi_timezone/THIRD_PARTY_NOTICES_TZDATA.md",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--manifest-output", type=Path)
    parser.add_argument("--sums-output", type=Path)
    args = parser.parse_args()
    if bool(args.manifest_output) != bool(args.sums_output):
        parser.error("--manifest-output and --sums-output must be supplied together")
    dataset = generate_dataset()
    dataset_bytes = stable_bytes(dataset)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(dataset_bytes)
    digest = sha256_bytes(dataset_bytes)
    print(f"ZONE_COUNT={dataset['zone_count']}")
    print(f"TRANSITION_COUNT={dataset['transition_count']}")
    print(f"DATASET_SHA256={digest}")
    print("STATISTICS=" + json.dumps(dataset["statistics"], ensure_ascii=False, sort_keys=True))
    if args.manifest_output and args.sums_output:
        manifest = build_manifest(dataset, dataset_bytes, args.output.name)
        manifest_bytes = stable_bytes(manifest)
        args.manifest_output.write_bytes(manifest_bytes)
        sums = (
            f"{digest}  {args.output.name}\n"
            f"{sha256_bytes(manifest_bytes)}  {args.manifest_output.name}\n"
        )
        args.sums_output.write_text(sums, encoding="ascii", newline="\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
