#!/usr/bin/env python3
"""Independently validate the frozen Phase 2.2C location registry."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RESEARCH = ROOT / "research/bazi_location"
FROZEN = ROOT / "data/frozen/bazi_location"
TIMEZONE = ROOT / "data/frozen/bazi_timezone/iana_tzdb_2026c_v0.1.0.json"
REGISTRY_NAME = "iana_location_registry_2026c_v0.1.0.json"
MANIFEST_NAME = "BAZI_LOCATION_MANIFEST_V0.1.0.json"
WHEEL_SHA = "dc096730c87af6cab1b171c9d532be840741ff5d459015e7f6947bd7d7e54931"
TIMEZONE_SHA = "a15f271214fb2b595856d93c365ed6beb6dfbfbb429d6b3c2fa0fc9b58d7c6c2"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def parse_sums(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for line in path.read_text(encoding="ascii").splitlines():
        hash_value, filename = line.split(maxsplit=1)
        result[filename] = hash_value
    return result


def coordinate(value: str) -> tuple[float, float]:
    split = next((i for i in range(1, len(value)) if value[i] in "+-"), -1)
    if split < 0:
        raise ValueError("INVALID_COORDINATES")
    result: list[float] = []
    for part, degree_digits in zip((value[:split], value[split:]), (2, 3), strict=True):
        digits = part[1:]
        if part[0] not in "+-" or len(digits) not in (degree_digits + 2, degree_digits + 4) or not digits.isdigit():
            raise ValueError("INVALID_COORDINATES")
        degrees = int(digits[:degree_digits])
        minutes = int(digits[degree_digits:degree_digits + 2])
        seconds = int(digits[degree_digits + 2:]) if len(digits) == degree_digits + 4 else 0
        if minutes >= 60 or seconds >= 60:
            raise ValueError("INVALID_COORDINATES")
        result.append(round((-1 if part[0] == "-" else 1) * (degrees + minutes / 60 + seconds / 3600), 6))
    if not (-90 <= result[0] <= 90 and -180 <= result[1] <= 180):
        raise ValueError("INVALID_COORDINATES")
    return result[0], result[1]


def main() -> None:
    checks: list[tuple[str, bool]] = []
    def check(name: str, condition: bool) -> None:
        checks.append((name, bool(condition)))
        if not condition:
            raise AssertionError(name)

    source_sums = parse_sums(RESEARCH / "SOURCE_SNAPSHOT_SHA256.txt")
    zone_path = RESEARCH / "sources/zone1970.tab"
    country_path = RESEARCH / "sources/iso3166.tab"
    check("SOURCE_SNAPSHOTS_EXIST", zone_path.is_file() and country_path.is_file())
    check("SOURCE_SHA_MATCH", source_sums == {"sources/iso3166.tab": digest(country_path), "sources/zone1970.tab": digest(zone_path)})

    frozen_sums = parse_sums(FROZEN / "SHA256SUMS.txt")
    registry_path = FROZEN / REGISTRY_NAME
    manifest_path = FROZEN / MANIFEST_NAME
    check("REGISTRY_SHA_MATCH", frozen_sums.get(REGISTRY_NAME) == digest(registry_path))
    check("MANIFEST_SHA_MATCH", frozen_sums.get(MANIFEST_NAME) == digest(manifest_path))
    check("NO_UNKNOWN_FROZEN_ASSET", {item.name for item in FROZEN.iterdir() if item.is_file()} == {REGISTRY_NAME, MANIFEST_NAME, "SHA256SUMS.txt"})

    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    timezone_bytes = TIMEZONE.read_bytes()
    timezone = json.loads(timezone_bytes)
    runtime_zones = {item["zone_id"] for item in timezone["zones"]}
    check("TIMEZONE_DATASET_SHA", hashlib.sha256(timezone_bytes).hexdigest() == TIMEZONE_SHA and len(runtime_zones) == 598)

    countries: dict[str, str] = {}
    for line in country_path.read_text(encoding="utf-8").splitlines():
        if line and not line.startswith("#"):
            code, name = line.split("\t", 1)
            check(f"COUNTRY_CODE_{code}", bool(re.fullmatch(r"[A-Z]{2}", code)) and code not in countries)
            countries[code] = name
    source_entries: list[tuple[list[str], str, str, str]] = []
    for line in zone_path.read_text(encoding="utf-8").splitlines():
        if line and not line.startswith("#"):
            columns = line.split("\t")
            check("ZONE1970_PARSE", len(columns) in (3, 4))
            source_entries.append((columns[0].split(","), columns[1], columns[2], columns[3] if len(columns) == 4 else ""))

    directory = registry["iana_zone_directory"]
    registered = registry["product_registered_locations"]
    check("SOURCE_COUNTRY_COUNT", registry["country_count"] == len(countries) == 249)
    check("SOURCE_ZONE_COUNT", registry["iana_zone1970_entry_count"] == len(source_entries) == len(directory))
    check("REGISTRY_TOTAL_COUNT", registry["total_entry_count"] == len(directory) + len(registered))
    invalid_country = invalid_coordinates = missing_runtime = 0
    for entry, source in zip(directory, source_entries, strict=True):
        codes, raw_coordinate, zone_id, comment = source
        if any(code not in countries for code in codes): invalid_country += 1
        try:
            lat, lon = coordinate(raw_coordinate)
            if entry["latitude"] != lat or entry["longitude"] != lon: invalid_coordinates += 1
        except ValueError:
            invalid_coordinates += 1
        if zone_id not in runtime_zones: missing_runtime += 1
        check("ZONE_SOURCE_IDENTITY", entry == {"location_id": f"IANA:{zone_id}", "zone_id": zone_id, "country_codes": codes, "coordinates_raw": raw_coordinate, "latitude": lat, "longitude": lon, "comment": comment, "source_kind": "IANA_ZONE1970"})
    zone_ids = [entry["zone_id"] for entry in directory]
    location_ids = [entry["location_id"] for entry in directory] + [entry["location_id"] for entry in registered]
    check("ALL_COUNTRY_CODES_VALID", invalid_country == 0)
    check("ALL_COORDINATES_VALID", invalid_coordinates == 0)
    check("ALL_ZONES_IN_RUNTIME", missing_runtime == 0)
    check("DUPLICATE_ZONE_ID_ZERO", len(zone_ids) == len(set(zone_ids)))
    check("DUPLICATE_LOCATION_ID_ZERO", len(location_ids) == len(set(location_ids)))

    expected = {
        "CN-MAINLAND": ("Asia/Shanghai", "FROZEN_PRODUCT_LOCATION_POLICY"),
        "US-NY": ("America/New_York", "FROZEN_TEST_AND_PRODUCT_MAPPING"),
        "US-LA": ("America/Los_Angeles", "FROZEN_TEST_AND_PRODUCT_MAPPING"),
        "US-HNL": ("Pacific/Honolulu", "FROZEN_TEST_AND_PRODUCT_MAPPING"),
    }
    actual = {entry["location_id"]: (entry["zone_id"], entry["mapping_class"]) for entry in registered}
    check("FOUR_REGISTERED_MAPPINGS", actual == expected and all(zone in runtime_zones for zone, _ in actual.values()))
    check("CN_MAINLAND_MAPPING", actual["CN-MAINLAND"] == expected["CN-MAINLAND"])
    check("VERSIONS_LOCKED", registry["iana_release"] == manifest["iana_release"] == "2026c" and registry["python_tzdata_version"] == manifest["python_tzdata_version"] == "2026.3")
    check("WHEEL_SHA_LOCKED", registry["wheel_sha256"] == manifest["wheel_sha256"] == WHEEL_SHA)
    check("MANIFEST_REGISTRY_BINDING", manifest["registry_sha256"] == digest(registry_path) and manifest["counts"] == {"countries": len(countries), "iana_zone1970_entries": len(directory), "product_registered_locations": 4, "total_entries": len(directory) + 4})
    check("REPRODUCIBILITY_RECORDED", manifest["reproducibility"] == {"run_a_registry_sha256": digest(registry_path), "run_b_registry_sha256": digest(registry_path), "byte_identical": True})
    check("SOURCE_PROVENANCE", manifest["source_provenance"]["files"] == ["zone1970.tab", "iso3166.tab"] and manifest["source_snapshots"] == {"iso3166.tab": digest(country_path), "zone1970.tab": digest(zone_path)})
    check("NO_INFERENCE_TABLE", set(registry) == {"registry_id", "version", "status", "iana_release", "python_tzdata_version", "wheel_sha256", "source_snapshot_sha256", "country_count", "iana_zone1970_entry_count", "product_registered_count", "total_entry_count", "iana_zone_directory", "product_registered_locations"})
    serialized = json.dumps(registry, ensure_ascii=False).lower()
    check("NO_USER_DATA", all(token not in serialized for token in ("birth_date", "birth_time", "user_id", "email", "phone")))
    check("POLICY_BOUNDARIES", manifest["policies"] == {"free_text_location": "DISPLAY_ONLY", "coordinates": "SOURCE_METADATA_ONLY", "true_solar_time": "OUT_OF_SCOPE", "network_access": False})

    print(f"VALIDATION={len(checks)}/{len(checks)} PASS")
    print(f"COUNTRY_COUNT={len(countries)}")
    print(f"ZONE1970_ZONE_COUNT={len(directory)}")
    print(f"REGISTRY_TOTAL_ENTRY_COUNT={len(directory) + len(registered)}")
    print(f"ZONE1970_MISSING_IN_RUNTIME={missing_runtime}")
    print(f"DUPLICATE_ZONE_ID={len(zone_ids) - len(set(zone_ids))}")
    print(f"DUPLICATE_LOCATION_ID={len(location_ids) - len(set(location_ids))}")
    print(f"INVALID_COUNTRY_CODE={invalid_country}")
    print(f"INVALID_COORDINATES={invalid_coordinates}")
    print(f"REGISTRY_SHA256={digest(registry_path)}")


if __name__ == "__main__":
    main()
