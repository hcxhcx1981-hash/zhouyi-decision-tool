#!/usr/bin/env python3
"""Validate the deterministic Phase 2.2A test-only normalization fixture."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/frozen/bazi/bazi_calendar_test_cases_v0.1.1.json"
FIXTURE = ROOT / "tests/fixtures/bazi_core_normalized_cases_v0.1.1.json"
SHA_FILE = Path(f"{FIXTURE}.sha256")
SOURCE_SHA = "51ec490be14b7c8b1a31c300d4f96e1808e70b5a6feeda68c25b07883f46ce4e"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    source_bytes = SOURCE.read_bytes()
    fixture_bytes = FIXTURE.read_bytes()
    source = json.loads(source_bytes.decode("utf-8"))
    fixture = json.loads(fixture_bytes.decode("utf-8"))
    digest = hashlib.sha256(fixture_bytes).hexdigest()
    recorded_digest, recorded_name = SHA_FILE.read_text(encoding="ascii").strip().split(maxsplit=1)

    require(hashlib.sha256(source_bytes).hexdigest() == SOURCE_SHA, "formal cases SHA changed")
    require(fixture["status"] == "TEST_ONLY_NOT_FOR_RUNTIME", "fixture runtime boundary missing")
    require(fixture["timezone_resolver_id"] == "TEST_PYTHON_ZONEINFO_FIXTURE", "resolver id mismatch")
    require(fixture["reference_local_date"] == "2026-08-07", "reference date mismatch")
    require(fixture["source_cases_sha256"] == SOURCE_SHA, "source SHA mismatch")
    require(fixture["case_count"] == 70 == len(fixture["cases"]), "fixture count mismatch")
    require(recorded_digest == digest, "fixture SHA mismatch")
    require(recorded_name == FIXTURE.name, "fixture SHA filename mismatch")

    source_by_id = {case["case_id"]: case for case in source["cases"]}
    fixture_by_id = {case["source_case_id"]: case for case in fixture["cases"]}
    require(set(source_by_id) == set(fixture_by_id), "fixture case ids differ from formal cases")
    for case_id, case in fixture_by_id.items():
        source_case = source_by_id[case_id]
        expected = {key: value for key, value in source_case.items() if key.startswith("expected_")}
        require(case["expected"] == expected, f"frozen expected changed: {case_id}")
        normalized = case["normalized_input"]
        require(normalized["timezoneResolverId"] == "TEST_PYTHON_ZONEINFO_FIXTURE", f"resolver mismatch: {case_id}")
        require(normalized["referenceLocalDate"] == "2026-08-07", f"reference mismatch: {case_id}")
        require("instantUtc" not in normalized, f"adapter leaked a guessed instant: {case_id}")

    print("PASS: normalized fixture 70/70; frozen expected modifications 0")
    print(f"SHA-256: {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
