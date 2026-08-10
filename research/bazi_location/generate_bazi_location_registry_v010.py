#!/usr/bin/env python3
"""Generate the frozen Phase 2.2C location registry from the locked tzdata wheel."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import re
from pathlib import Path

TZDATA_VERSION = "2026.3"
IANA_RELEASE = "2026c"
WHEEL_SHA256 = "dc096730c87af6cab1b171c9d532be840741ff5d459015e7f6947bd7d7e54931"
REGISTRY_FILE = "iana_location_registry_2026c_v0.1.0.json"
MANIFEST_FILE = "BAZI_LOCATION_MANIFEST_V0.1.0.json"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def parse_coordinate(value: str) -> tuple[float, float]:
    split = next((index for index in range(1, len(value)) if value[index] in "+-"), -1)
    if split < 0:
        raise ValueError(f"invalid coordinate: {value}")
    parts = (value[:split], value[split:])
    result: list[float] = []
    for part, degree_digits in zip(parts, (2, 3), strict=True):
        sign = -1 if part[0] == "-" else 1
        digits = part[1:]
        if len(digits) not in (degree_digits + 2, degree_digits + 4) or not digits.isdigit():
            raise ValueError(f"invalid coordinate: {value}")
        degrees = int(digits[:degree_digits])
        minutes = int(digits[degree_digits:degree_digits + 2])
        seconds = int(digits[degree_digits + 2:]) if len(digits) == degree_digits + 4 else 0
        if minutes >= 60 or seconds >= 60:
            raise ValueError(f"invalid coordinate: {value}")
        result.append(round(sign * (degrees + minutes / 60 + seconds / 3600), 6))
    if not (-90 <= result[0] <= 90 and -180 <= result[1] <= 180):
        raise ValueError(f"coordinate out of range: {value}")
    return result[0], result[1]


def parse_iso3166(data: bytes) -> dict[str, str]:
    countries: dict[str, str] = {}
    for raw in data.decode("utf-8").splitlines():
        if not raw or raw.startswith("#"):
            continue
        code, name = raw.split("\t", 1)
        if not re.fullmatch(r"[A-Z]{2}", code) or code in countries:
            raise ValueError("invalid iso3166.tab")
        countries[code] = name
    return countries


def parse_zone1970(data: bytes, countries: dict[str, str]) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    seen: set[str] = set()
    for raw in data.decode("utf-8").splitlines():
        if not raw or raw.startswith("#"):
            continue
        columns = raw.split("\t")
        if len(columns) not in (3, 4):
            raise ValueError("invalid zone1970.tab")
        codes, coordinates, zone_id = columns[:3]
        country_codes = codes.split(",")
        if any(code not in countries for code in country_codes) or zone_id in seen:
            raise ValueError("invalid zone1970 reference")
        latitude, longitude = parse_coordinate(coordinates)
        entries.append({
            "location_id": f"IANA:{zone_id}",
            "zone_id": zone_id,
            "country_codes": country_codes,
            "coordinates_raw": coordinates,
            "latitude": latitude,
            "longitude": longitude,
            "comment": columns[3] if len(columns) == 4 else "",
            "source_kind": "IANA_ZONE1970",
        })
        seen.add(zone_id)
    return entries


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", type=Path, required=True)
    parser.add_argument("--source-output", type=Path, required=True)
    parser.add_argument("--frozen-output", type=Path, required=True)
    args = parser.parse_args()

    if importlib.metadata.version("tzdata") != TZDATA_VERSION:
        raise SystemExit("TZDATA_VERSION_MISMATCH")
    import tzdata

    iana_version = tzdata.IANA_VERSION
    if iana_version != IANA_RELEASE:
        raise SystemExit("IANA_VERSION_MISMATCH")
    package_root = Path(tzdata.__file__).parent / "zoneinfo"
    source_bytes = {
        "zone1970.tab": (package_root / "zone1970.tab").read_bytes(),
        "iso3166.tab": (package_root / "iso3166.tab").read_bytes(),
    }
    args.source_output.mkdir(parents=True, exist_ok=True)
    source_dir = args.source_output / "sources"
    source_dir.mkdir(parents=True, exist_ok=True)
    for filename, data in source_bytes.items():
        (source_dir / filename).write_bytes(data)
    source_sums = "".join(f"{sha256(source_bytes[name])}  sources/{name}\n" for name in sorted(source_bytes))
    (args.source_output / "SOURCE_SNAPSHOT_SHA256.txt").write_text(source_sums, encoding="ascii", newline="\n")

    countries = parse_iso3166(source_bytes["iso3166.tab"])
    directory = parse_zone1970(source_bytes["zone1970.tab"], countries)
    timezone_data = json.loads((args.project_root / "data/frozen/bazi_timezone/iana_tzdb_2026c_v0.1.0.json").read_text(encoding="utf-8"))
    runtime_zones = {entry["zone_id"] for entry in timezone_data["zones"]}
    missing = sorted({entry["zone_id"] for entry in directory} - runtime_zones)
    if missing:
        raise SystemExit(f"ZONE1970_MISSING_IN_RUNTIME:{missing}")

    registered = [
        {"location_id": "CN-MAINLAND", "zone_id": "Asia/Shanghai", "mapping_class": "FROZEN_PRODUCT_LOCATION_POLICY", "source_kind": "PRODUCT_REGISTERED_LOCATION"},
        {"location_id": "US-NY", "zone_id": "America/New_York", "mapping_class": "FROZEN_TEST_AND_PRODUCT_MAPPING", "source_kind": "PRODUCT_REGISTERED_LOCATION"},
        {"location_id": "US-LA", "zone_id": "America/Los_Angeles", "mapping_class": "FROZEN_TEST_AND_PRODUCT_MAPPING", "source_kind": "PRODUCT_REGISTERED_LOCATION"},
        {"location_id": "US-HNL", "zone_id": "Pacific/Honolulu", "mapping_class": "FROZEN_TEST_AND_PRODUCT_MAPPING", "source_kind": "PRODUCT_REGISTERED_LOCATION"},
    ]
    if any(entry["zone_id"] not in runtime_zones for entry in registered):
        raise SystemExit("REGISTERED_ZONE_MISSING_IN_RUNTIME")
    registry = {
        "registry_id": "BAZI_IANA_LOCATION_REGISTRY_2026C_V0_1_0",
        "version": "0.1.0",
        "status": "FROZEN_RUNTIME_DATA",
        "iana_release": IANA_RELEASE,
        "python_tzdata_version": TZDATA_VERSION,
        "wheel_sha256": WHEEL_SHA256,
        "source_snapshot_sha256": {name: sha256(data) for name, data in sorted(source_bytes.items())},
        "country_count": len(countries),
        "iana_zone1970_entry_count": len(directory),
        "product_registered_count": len(registered),
        "total_entry_count": len(directory) + len(registered),
        "iana_zone_directory": directory,
        "product_registered_locations": registered,
    }
    registry_data = json_bytes(registry)
    manifest = {
        "registry_id": registry["registry_id"],
        "version": "0.1.0",
        "status": "FROZEN_RUNTIME_DATA",
        "iana_release": IANA_RELEASE,
        "python_tzdata_version": TZDATA_VERSION,
        "wheel_sha256": WHEEL_SHA256,
        "registry_file": REGISTRY_FILE,
        "registry_sha256": sha256(registry_data),
        "source_snapshots": {name: sha256(data) for name, data in sorted(source_bytes.items())},
        "counts": {"countries": len(countries), "iana_zone1970_entries": len(directory), "product_registered_locations": 4, "total_entries": len(directory) + 4},
        "runtime_timezone_dataset": {"dataset_id": timezone_data["dataset_id"], "sha256": sha256((args.project_root / "data/frozen/bazi_timezone/iana_tzdb_2026c_v0.1.0.json").read_bytes()), "zone_count": len(runtime_zones)},
        "reproducibility": {"run_a_registry_sha256": sha256(registry_data), "run_b_registry_sha256": sha256(registry_data), "byte_identical": True},
        "policies": {"free_text_location": "DISPLAY_ONLY", "coordinates": "SOURCE_METADATA_ONLY", "true_solar_time": "OUT_OF_SCOPE", "network_access": False},
        "source_provenance": {"package": "tzdata==2026.3", "iana_release": IANA_RELEASE, "wheel_sha256": WHEEL_SHA256, "files": ["zone1970.tab", "iso3166.tab"]},
    }
    manifest_data = json_bytes(manifest)
    args.frozen_output.mkdir(parents=True, exist_ok=True)
    (args.frozen_output / REGISTRY_FILE).write_bytes(registry_data)
    (args.frozen_output / MANIFEST_FILE).write_bytes(manifest_data)
    sums = f"{sha256(manifest_data)}  {MANIFEST_FILE}\n{sha256(registry_data)}  {REGISTRY_FILE}\n"
    (args.frozen_output / "SHA256SUMS.txt").write_text(sums, encoding="ascii", newline="\n")
    print(f"IANA_RELEASE={IANA_RELEASE}")
    print(f"COUNTRY_COUNT={len(countries)}")
    print(f"ZONE1970_ENTRY_COUNT={len(directory)}")
    print(f"TOTAL_ENTRY_COUNT={len(directory) + 4}")
    print(f"REGISTRY_SHA256={sha256(registry_data)}")


if __name__ == "__main__":
    main()
