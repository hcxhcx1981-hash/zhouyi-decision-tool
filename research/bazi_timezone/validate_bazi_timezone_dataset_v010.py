#!/usr/bin/env python3
"""Independently validate the frozen IANA 2026c timezone dataset."""

from __future__ import annotations

import bisect
import hashlib
import importlib.metadata
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import venv
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo, reset_tzpath

ROOT = Path(__file__).resolve().parents[2]
FROZEN = ROOT / "data/frozen/bazi_timezone"
DATA = FROZEN / "iana_tzdb_2026c_v0.1.0.json"
MANIFEST = FROZEN / "BAZI_TIMEZONE_MANIFEST_V0.1.0.json"
SUMS = FROZEN / "SHA256SUMS.txt"
LOCK = ROOT / "research/bazi_timezone/requirements-tzdata.lock.txt"
EXPECTED_DATA_SHA = "a15f271214fb2b595856d93c365ed6beb6dfbfbb429d6b3c2fa0fc9b58d7c6c2"
EXPECTED_WHEEL_SHA = "dc096730c87af6cab1b171c9d532be840741ff5d459015e7f6947bd7d7e54931"
START = datetime(1969, 1, 1, tzinfo=timezone.utc)
END = datetime(2102, 1, 1, tzinfo=timezone.utc)
UTC_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def stable(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def parse_utc(value: str) -> int:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo != timezone.utc or parsed.isoformat(timespec="seconds").replace("+00:00", "Z") != value:
        raise AssertionError(f"invalid UTC format: {value}")
    return int((parsed - UTC_EPOCH).total_seconds())


def zone_state(zone: ZoneInfo, timestamp: int) -> tuple[int, bool, str]:
    local = (UTC_EPOCH + timedelta(seconds=timestamp)).astimezone(zone)
    offset = local.utcoffset()
    dst = local.dst()
    if offset is None:
        raise AssertionError("missing offset")
    return int(offset.total_seconds()), bool(dst and dst.total_seconds()), local.tzname() or ""


def explicit_tzif_transitions(path: Path) -> list[int]:
    data = path.read_bytes()
    assert data[:4] == b"TZif"
    counts = struct.unpack(">6l", data[20:44])
    version = data[4:5]
    time_size = 4
    offset = 44
    if version in (b"2", b"3", b"4"):
        ttisgmtcnt, ttisstdcnt, leapcnt, timecnt, typecnt, charcnt = counts
        offset += timecnt * 5 + typecnt * 6 + charcnt + leapcnt * 8 + ttisstdcnt + ttisgmtcnt
        assert data[offset : offset + 4] == b"TZif"
        counts = struct.unpack(">6l", data[offset + 20 : offset + 44])
        offset += 44
        time_size = 8
    timecnt = counts[3]
    code = "q" if time_size == 8 else "l"
    return list(struct.unpack(f">{timecnt}{code}", data[offset : offset + timecnt * time_size])) if timecnt else []


def bootstrap_if_needed() -> int | None:
    try:
        import tzdata
        ready = importlib.metadata.version("tzdata") == "2026.3" and tzdata.IANA_VERSION == "2026c"
    except (ImportError, importlib.metadata.PackageNotFoundError):
        ready = False
    if ready:
        return None
    if os.environ.get("BAZI_TZDATA_VALIDATION_BOOTSTRAPPED") == "1":
        raise AssertionError("locked tzdata bootstrap did not provide 2026.3 / 2026c")
    temporary = Path(tempfile.mkdtemp(prefix="bazi-tzdata-validator-"))
    try:
        venv.EnvBuilder(with_pip=True).create(temporary)
        python = temporary / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
        subprocess.run(
            [str(python), "-m", "pip", "install", "--require-hashes", "--no-deps", "--no-cache-dir", "-r", str(LOCK)],
            check=True,
        )
        environment = dict(os.environ)
        environment["BAZI_TZDATA_VALIDATION_BOOTSTRAPPED"] = "1"
        return subprocess.run([str(python), str(Path(__file__).resolve())], env=environment).returncode
    finally:
        shutil.rmtree(temporary, ignore_errors=True)


def state_from_dataset(zone_record: dict, timestamp: int) -> tuple[int, bool, str]:
    instants = zone_record["_instants"]
    index = bisect.bisect_right(instants, timestamp) - 1
    if index < 0:
        initial = zone_record["initial_state"]
        return initial["offset_seconds"], initial["is_dst"], initial["abbreviation"]
    transition = zone_record["transitions"][index]
    return transition["offset_after_seconds"], transition["is_dst_after"], transition["abbreviation_after"]


def main() -> int:
    bootstrapped = bootstrap_if_needed()
    if bootstrapped is not None:
        return bootstrapped
    import tzdata

    package_root = Path(tzdata.__file__).resolve().parent
    reset_tzpath([str(package_root / "zoneinfo")])
    ZoneInfo.clear_cache()
    assert importlib.metadata.version("tzdata") == "2026.3"
    assert tzdata.IANA_VERSION == "2026c"
    distribution = importlib.metadata.distribution("tzdata")
    license_entry = next(item for item in distribution.files or [] if str(item).replace("\\", "/").endswith(".dist-info/licenses/LICENSE"))
    locked_license = Path(distribution.locate_file(license_entry)).read_text(encoding="utf-8").strip()
    notices = (ROOT / "research/bazi_timezone/THIRD_PARTY_NOTICES_TZDATA.md").read_text(encoding="utf-8")
    assert locked_license in notices
    assert LOCK.read_text(encoding="ascii").strip() == f"tzdata==2026.3 --hash=sha256:{EXPECTED_WHEEL_SHA}"
    assert sha256(DATA) == EXPECTED_DATA_SHA
    dataset = json.loads(DATA.read_text(encoding="utf-8"))
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert DATA.read_bytes() == stable(dataset)
    assert MANIFEST.read_bytes() == stable(manifest)
    sums = dict(line.split(maxsplit=1)[::-1] for line in SUMS.read_text(encoding="ascii").splitlines())
    assert sums[DATA.name] == sha256(DATA)
    assert sums[MANIFEST.name] == sha256(MANIFEST)
    assert manifest["data_sha256"] == sha256(DATA)
    assert manifest["wheel_sha256"] == EXPECTED_WHEEL_SHA
    assert manifest["reproducibility"] == {"run_a_sha256": EXPECTED_DATA_SHA, "run_b_sha256": EXPECTED_DATA_SHA, "byte_identical": True}
    assert manifest["runtime_policy"] == {"static_timezone_json_only": True, "network_access": False, "host_system_tzdb_dependency": False, "browser_intl_historical_offset": False}
    assert dataset["dataset_id"] == "BAZI_IANA_TZDB_2026C_V0_1_0"
    assert dataset["status"] == manifest["status"] == "FROZEN_RUNTIME_DATA"
    assert dataset["iana_release"] == manifest["iana_release"] == "2026c"
    assert dataset["python_tzdata_version"] == manifest["python_tzdata_version"] == "2026.3"
    assert dataset["coverage"] == {"start_utc": "1969-01-01T00:00:00Z", "end_utc_exclusive": "2102-01-01T00:00:00Z"}

    source_keys = sorted(line.strip() for line in (package_root / "zones").read_text(encoding="utf-8").splitlines() if line.strip())
    zones = dataset["zones"]
    assert [zone["zone_id"] for zone in zones] == source_keys
    assert dataset["zone_count"] == manifest["zone_count"] == len(zones) == 598
    required = {"Asia/Shanghai", "America/New_York", "America/Los_Angeles", "Pacific/Honolulu"}
    assert required.issubset(source_keys)

    start_ts = int((START - UTC_EPOCH).total_seconds())
    end_ts = int((END - UTC_EPOCH).total_seconds())
    transitions_checked = explicit_checked = gap_count = fold_count = duplicate_count = 0
    offsets: list[int] = []
    max_change = 0
    by_name = {}
    for record in zones:
        zone = ZoneInfo(record["zone_id"])
        initial = record["initial_state"]
        assert (initial["offset_seconds"], initial["is_dst"], initial["abbreviation"]) == zone_state(zone, start_ts)
        instants = [parse_utc(item["instant_utc"]) for item in record["transitions"]]
        assert instants == sorted(set(instants))
        assert all(start_ts < instant < end_ts for instant in instants)
        instant_set = set(instants)
        explicit = explicit_tzif_transitions(package_root / "zoneinfo" / Path(*record["zone_id"].split("/")))
        for instant in explicit:
            if start_ts < instant < end_ts and zone_state(zone, instant - 1) != zone_state(zone, instant):
                assert instant in instant_set
                explicit_checked += 1
        record["_instants"] = instants
        previous = (initial["offset_seconds"], initial["is_dst"], initial["abbreviation"])
        for instant, transition in zip(instants, record["transitions"]):
            before = (transition["offset_before_seconds"], transition["is_dst_before"], transition["abbreviation_before"])
            after = (transition["offset_after_seconds"], transition["is_dst_after"], transition["abbreviation_after"])
            assert previous == before
            assert zone_state(zone, instant - 1) == before
            assert zone_state(zone, instant) == after
            assert zone_state(zone, instant + 1) == after
            delta = after[0] - before[0]
            gap_count += delta > 0
            fold_count += delta < 0
            max_change = max(max_change, abs(delta))
            offsets.extend((before[0], after[0]))
            previous = after
            transitions_checked += 1
        offsets.append(initial["offset_seconds"])
        by_name[record["zone_id"]] = record

        for year in range(1969, 2102):
            for month in range(1, 13):
                instant = int((datetime(year, month, 1, 12, tzinfo=timezone.utc) - UTC_EPOCH).total_seconds())
                assert state_from_dataset(record, instant) == zone_state(zone, instant)

    stats = dataset["statistics"]
    assert transitions_checked == dataset["transition_count"] == manifest["transition_count"] == 55642
    assert duplicate_count == stats["duplicate_transition_count"] == 0
    assert gap_count == stats["gap_count"] == 27730
    assert fold_count == stats["fold_count"] == 27681
    assert min(offsets) == stats["minimum_offset_seconds"] == -43200
    assert max(offsets) == stats["maximum_offset_seconds"] == 50400
    assert max_change == stats["maximum_offset_change_seconds"] == 86400

    shanghai = by_name["Asia/Shanghai"]
    assert any(item["is_dst_before"] or item["is_dst_after"] for item in shanghai["transitions"])
    assert any(item["offset_after_seconds"] - item["offset_before_seconds"] == 3600 for item in by_name["America/New_York"]["transitions"])
    assert any(item["offset_after_seconds"] - item["offset_before_seconds"] == -3600 for item in by_name["America/New_York"]["transitions"])
    assert any(abs(item["offset_after_seconds"] - item["offset_before_seconds"]) not in (0, 3600) for zone in zones for item in zone["transitions"])
    assert any(abs(item["offset_after_seconds"] - item["offset_before_seconds"]) >= 86400 for zone in zones for item in zone["transitions"])
    assert any(not zone["initial_state"]["is_dst"] and all(not item["is_dst_before"] and not item["is_dst_after"] for item in zone["transitions"]) for zone in zones)

    print("TZDATA_PACKAGE=2026.3")
    print("IANA_RELEASE=2026c")
    print(f"ZONE_COUNT={len(zones)}")
    print(f"TRANSITION_REFERENCE_CHECKS={transitions_checked}/55642")
    print(f"EXPLICIT_TZIF_TRANSITIONS_PRESENT={explicit_checked}")
    print(f"FIXED_GRID_CHECKS={len(zones) * 133 * 12}")
    print(f"GAP_COUNT={gap_count}")
    print(f"FOLD_COUNT={fold_count}")
    print(f"DATASET_SHA256={sha256(DATA)}")
    print("BAZI_TIMEZONE_DATASET_V0.1.0: ALL PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
