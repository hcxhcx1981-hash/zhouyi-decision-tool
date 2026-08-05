from __future__ import annotations

import calendar
import json
import sys
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


RESEARCH = Path(__file__).resolve().parent
RULES_PATH = RESEARCH / "bazi_calendar_rules_candidate_v0.1.json"
CASES_PATH = RESEARCH / "bazi_calendar_test_cases_candidate_v0.1.json"
FIXTURE_PATH = RESEARCH / "solar_term_test_fixture_v0.1.json"

STEMS = "甲乙丙丁戊己庚辛壬癸"
BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
JIE_TO_BRANCH = {
    "立春": "寅", "惊蛰": "卯", "清明": "辰", "立夏": "巳",
    "芒种": "午", "小暑": "未", "立秋": "申", "白露": "酉",
    "寒露": "戌", "立冬": "亥", "大雪": "子", "小寒": "丑",
}
SAFE_MONTH_BOUNDARIES = {
    1: (7, "丑"), 2: (6, "寅"), 3: (7, "卯"), 4: (6, "辰"),
    5: (7, "巳"), 6: (7, "午"), 7: (8, "未"), 8: (9, "申"),
    9: (9, "酉"), 10: (10, "戌"), 11: (9, "亥"), 12: (9, "子"),
}
PREVIOUS_BRANCH = {
    "丑": "子", "寅": "丑", "卯": "寅", "辰": "卯",
    "巳": "辰", "午": "巳", "未": "午", "申": "未",
    "酉": "申", "戌": "酉", "亥": "戌", "子": "亥",
}


@dataclass
class Result:
    pillars: dict[str, str | None] | None = None
    blocking_code: str | None = None
    warnings: tuple[str, ...] = ()
    assertions: dict[str, Any] | None = None


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def gregorian_ordinal_a(year: int, month: int, day: int) -> int:
    """Pure integer Gregorian ordinal; 0001-01-01 is day 1."""
    prior_year = year - 1
    days = 365 * prior_year + prior_year // 4 - prior_year // 100 + prior_year // 400
    days_before_month = (367 * month - 362) // 12
    if month > 2:
        days_before_month -= 1 if calendar.isleap(year) else 2
    return days + days_before_month + day


def julian_day_number_b(year: int, month: int, day: int) -> int:
    """Independent Fliegel-Van Flandern Gregorian-to-JDN integer algorithm."""
    a = (14 - month) // 12
    y = year + 4800 - a
    m = month + 12 * a - 3
    return day + (153 * m + 2) // 5 + 365 * y + y // 4 - y // 100 + y // 400 - 32045


BASE_DATE = date(1949, 10, 1)
BASE_ORDINAL_A = gregorian_ordinal_a(1949, 10, 1)
BASE_JDN_B = julian_day_number_b(1949, 10, 1)


def day_index(value: date) -> int:
    delta_a = gregorian_ordinal_a(value.year, value.month, value.day) - BASE_ORDINAL_A
    delta_b = julian_day_number_b(value.year, value.month, value.day) - BASE_JDN_B
    if delta_a != delta_b:
        raise RuntimeError("DAY_ALGORITHM_CROSSCHECK_FAILED")
    return delta_a % 60


def ganzhi(index: int) -> str:
    return STEMS[index % 10] + BRANCHES[index % 12]


def parse_fixture(records: list[dict[str, Any]]) -> list[tuple[str, datetime]]:
    parsed: list[tuple[str, datetime]] = []
    for record in records:
        instant = datetime.fromisoformat(record["instant"].replace("Z", "+00:00"))
        if instant.tzinfo is None:
            raise ValueError("fixture instant必须带时区")
        parsed.append((record["solar_term"], instant.astimezone(timezone.utc)))
    return parsed


def resolve_date(raw: str, zone: ZoneInfo) -> date:
    today = datetime.now(zone).date()
    if raw == "$CURRENT_LOCAL_DATE":
        return today
    if raw == "$CURRENT_LOCAL_DATE_PLUS_1_DAY":
        return today + timedelta(days=1)
    return date.fromisoformat(raw)


def classify_local_time(naive: datetime, zone: ZoneInfo) -> tuple[str, datetime | None]:
    candidates: list[datetime] = []
    offsets = set()
    for fold in (0, 1):
        aware = naive.replace(tzinfo=zone, fold=fold)
        roundtrip = aware.astimezone(timezone.utc).astimezone(zone).replace(tzinfo=None)
        if roundtrip == naive:
            candidates.append(aware)
            offsets.add(aware.utcoffset())
    if not candidates:
        return "GAP", None
    if len(offsets) > 1:
        return "FOLD", None
    return "VALID", candidates[0]


def term_local_values(fixtures: list[tuple[str, datetime]], zone: ZoneInfo) -> list[tuple[str, datetime]]:
    return [(term, instant.astimezone(zone)) for term, instant in fixtures]


def exact_boundary_status(
    local_dt: datetime, local_terms: list[tuple[str, datetime]]
) -> tuple[str | None, tuple[str, ...]]:
    for term, boundary in local_terms:
        if term not in JIE_TO_BRANCH:
            continue
        if local_dt.replace(second=0, microsecond=0) == boundary.replace(second=0, microsecond=0):
            return "SOLAR_TERM_SAME_MINUTE_AMBIGUOUS", ()
        if abs((local_dt - boundary).total_seconds()) <= 120:
            return None, ("BOUNDARY_SENSITIVE",)
    return None, ()


def year_number_for_pillar(local_date: date, local_dt: datetime | None, local_terms: list[tuple[str, datetime]]) -> int:
    lichun = next((instant for term, instant in local_terms if term == "立春" and instant.year == local_date.year), None)
    if lichun is not None:
        after = local_dt >= lichun if local_dt is not None else local_date > lichun.date()
        return local_date.year if after else local_date.year - 1
    if local_date.month == 1 or (local_date.month == 2 and local_date.day <= 2):
        return local_date.year - 1
    if local_date.month > 2 or (local_date.month == 2 and local_date.day >= 6):
        return local_date.year
    raise RuntimeError("SOLAR_TERM_DATA_UNAVAILABLE")


def safe_month_branch(local_date: date) -> str:
    threshold, after_branch = SAFE_MONTH_BOUNDARIES[local_date.month]
    if local_date.day >= threshold:
        return after_branch
    if local_date.day <= threshold - 2:
        return PREVIOUS_BRANCH[after_branch]
    raise RuntimeError("SOLAR_TERM_DATA_UNAVAILABLE")


def month_branch_for_pillar(local_date: date, local_dt: datetime | None, local_terms: list[tuple[str, datetime]]) -> str:
    usable: list[tuple[str, datetime]] = []
    upcoming: list[tuple[str, datetime]] = []
    for term, instant in local_terms:
        if term not in JIE_TO_BRANCH:
            continue
        if local_dt is not None:
            if instant <= local_dt:
                usable.append((term, instant))
            else:
                upcoming.append((term, instant))
        elif instant.date() < local_date:
            usable.append((term, instant))
        else:
            upcoming.append((term, instant))
    if usable:
        term, _ = max(usable, key=lambda item: item[1])
        latest = max(usable, key=lambda item: item[1])[1]
        if (local_date - latest.date()).days <= 45:
            return JIE_TO_BRANCH[term]
    if upcoming:
        term, nearest = min(upcoming, key=lambda item: item[1])
        if (nearest.date() - local_date).days <= 2:
            return PREVIOUS_BRANCH[JIE_TO_BRANCH[term]]
    return safe_month_branch(local_date)


def year_pillar(year_number: int) -> str:
    return ganzhi((year_number - 1984) % 60)


def month_pillar(year_ganzhi: str, branch: str) -> str:
    branch_order = "寅卯辰巳午未申酉戌亥子丑"
    ordinal = branch_order.index(branch)
    year_stem_index = STEMS.index(year_ganzhi[0])
    yin_stem_index = (year_stem_index % 5) * 2 + 2
    return STEMS[(yin_stem_index + ordinal) % 10] + branch


def hour_pillar(day_ganzhi: str, local_time: time) -> str:
    branch_index = ((local_time.hour + 1) // 2) % 12
    day_stem_index = STEMS.index(day_ganzhi[0])
    zi_stem_index = (day_stem_index % 5) * 2
    return STEMS[(zi_stem_index + branch_index) % 10] + BRANCHES[branch_index]


def compute_case(
    case: dict[str, Any], rules: dict[str, Any], fixtures: list[tuple[str, datetime]]
) -> Result:
    value = case["input"]
    if value.get("calendar_type") != "GREGORIAN":
        return Result(blocking_code="LUNAR_INPUT_NOT_SUPPORTED_V0_1")
    if not value.get("location_name"):
        return Result(blocking_code="LOCATION_REQUIRED")
    zone_name = value.get("iana_timezone")
    if not zone_name:
        return Result(blocking_code="TIMEZONE_REQUIRED")
    try:
        zone = ZoneInfo(zone_name)
    except ZoneInfoNotFoundError:
        return Result(blocking_code="TIMEZONE_REQUIRED")

    location_id = value.get("location_id")
    registry = rules["location_timezone_registry_protocol"]["sample_test_mappings"]
    if location_id and registry.get(location_id) != zone_name:
        return Result(blocking_code="LOCATION_TIMEZONE_MISMATCH")

    raw_date = value.get("local_date")
    try:
        local_date = resolve_date(raw_date, zone)
    except (TypeError, ValueError):
        return Result(blocking_code="INVALID_CIVIL_DATE")

    scope = case["case_scope"]
    if scope == "ALGORITHM_VALIDATION":
        if not date(1970, 1, 1) <= local_date <= date(2100, 12, 31):
            return Result(blocking_code="DATE_OUT_OF_ALGORITHM_RANGE")
    else:
        if local_date < date(1970, 1, 1):
            return Result(blocking_code="DATE_OUT_OF_SUPPORTED_RANGE")
        if local_date > datetime.now(zone).date():
            return Result(blocking_code="FUTURE_BIRTH_DATE_NOT_ALLOWED")

    time_known = value.get("time_known") is True
    local_dt: datetime | None = None
    aware: datetime | None = None
    if time_known:
        try:
            hour, minute = map(int, value["local_time"].split(":"))
            local_dt = datetime.combine(local_date, time(hour, minute))
        except (AttributeError, TypeError, ValueError):
            return Result(blocking_code="INVALID_CIVIL_TIME")
        time_status, aware = classify_local_time(local_dt, zone)
        if time_status == "GAP":
            return Result(blocking_code="NONEXISTENT_LOCAL_TIME")
        if time_status == "FOLD" and value.get("fold_choice") not in {"EARLIER", "LATER"}:
            return Result(blocking_code="AMBIGUOUS_LOCAL_TIME")
        if time_status == "FOLD":
            fold = 0 if value["fold_choice"] == "EARLIER" else 1
            aware = local_dt.replace(tzinfo=zone, fold=fold)

    local_terms = term_local_values(fixtures, zone)
    if not time_known:
        has_jie = any(term in JIE_TO_BRANCH and instant.date() == local_date for term, instant in local_terms)
        if has_jie:
            return Result(blocking_code="SOLAR_TERM_TIME_REQUIRED")

    warnings: tuple[str, ...] = ()
    if aware is not None:
        blocking, warnings = exact_boundary_status(aware, local_terms)
        if blocking:
            return Result(blocking_code=blocking)

    day_ganzhi = ganzhi(day_index(local_date))
    assertions: dict[str, Any] = {
        "civil_date_valid": True,
        "day_pillar": day_ganzhi,
        "gregorian_leap_year": calendar.isleap(local_date.year),
        "birth_date_allowed": scope == "PRODUCT_INPUT" and local_date <= datetime.now(zone).date(),
    }
    if aware is not None:
        total_minutes = int(aware.utcoffset().total_seconds() // 60)
        sign = "+" if total_minutes >= 0 else "-"
        total_minutes = abs(total_minutes)
        assertions["utc_offset"] = f"{sign}{total_minutes // 60:02d}:{total_minutes % 60:02d}"

    if "expected_pillars" not in case:
        return Result(warnings=warnings, assertions=assertions)

    try:
        year_ganzhi = year_pillar(year_number_for_pillar(local_date, aware, local_terms))
        month_ganzhi = month_pillar(year_ganzhi, month_branch_for_pillar(local_date, aware, local_terms))
    except RuntimeError as error:
        return Result(blocking_code=str(error))
    pillars = {
        "year": year_ganzhi,
        "month": month_ganzhi,
        "day": day_ganzhi,
        "hour": hour_pillar(day_ganzhi, local_dt.time()) if local_dt else None,
    }
    return Result(pillars=pillars, warnings=warnings, assertions=assertions)


def crosscheck_all_days() -> tuple[int, list[str]]:
    current = date(1970, 1, 1)
    end = date(2100, 12, 31)
    checked = 0
    mismatches: list[str] = []
    while current <= end:
        a = gregorian_ordinal_a(current.year, current.month, current.day) - BASE_ORDINAL_A
        b = julian_day_number_b(current.year, current.month, current.day) - BASE_JDN_B
        if a != b:
            mismatches.append(current.isoformat())
        checked += 1
        current += timedelta(days=1)
    return checked, mismatches


def main() -> int:
    rules = load_json(RULES_PATH)
    suite = load_json(CASES_PATH)
    fixture_data = load_json(FIXTURE_PATH)
    fixtures = parse_fixture(fixture_data["records"])

    failures: list[str] = []
    pillar_total = pillar_matches = 0
    blocked_total = blocked_matches = 0
    warning_matches = 0
    results: dict[str, Result] = {}

    for case in suite["cases"]:
        result = compute_case(case, rules, fixtures)
        results[case["case_id"]] = result
        expected_block = case.get("expected_blocking_code")
        if expected_block is not None:
            blocked_total += 1
            if result.blocking_code == expected_block:
                blocked_matches += 1
            else:
                failures.append(f"{case['case_id']}: block expected={expected_block} actual={result.blocking_code}")
        elif result.blocking_code is not None:
            failures.append(f"{case['case_id']}: unexpected block={result.blocking_code}")

        if "expected_pillars" in case:
            pillar_total += 1
            if result.pillars == case["expected_pillars"]:
                pillar_matches += 1
            else:
                failures.append(f"{case['case_id']}: pillars expected={case['expected_pillars']} actual={result.pillars}")

        expected_warnings = tuple(case.get("expected_warnings", []))
        if result.warnings == expected_warnings:
            warning_matches += 1
        else:
            failures.append(f"{case['case_id']}: warnings expected={expected_warnings} actual={result.warnings}")

        for key, expected in case.get("expected_assertions", {}).items():
            if key == "days_since_previous_case":
                previous = results.get("BZ-C053-2100-FEB-28")
                actual = 1 if previous and day_index(resolve_date(case["input"]["local_date"], ZoneInfo(case["input"]["iana_timezone"]))) - day_index(date(2100, 2, 28)) == 1 else None
            else:
                actual = (result.assertions or {}).get(key)
            if actual != expected:
                failures.append(f"{case['case_id']}: assertion {key} expected={expected} actual={actual}")

    day_count, day_mismatches = crosscheck_all_days()
    if day_mismatches:
        failures.append(f"DAY_ALGORITHM_CROSSCHECK_FAILED: {day_mismatches[:10]}")

    print(f"RECOMPUTE_CASES={len(suite['cases'])}")
    print(f"PILLAR_MATCHES={pillar_matches}/{pillar_total}")
    print(f"BLOCK_MATCHES={blocked_matches}/{blocked_total}")
    print(f"WARNING_MATCHES={warning_matches}/{len(suite['cases'])}")
    print(f"DAY_ALGORITHM_CROSSCHECK={day_count - len(day_mismatches)}/{day_count}")
    non_leap_ok = (
        results["BZ-C053-2100-FEB-28"].assertions.get("gregorian_leap_year") is False
        and results["BZ-C054-2100-MAR-01"].assertions.get("gregorian_leap_year") is False
    )
    china_dst_ok = (
        results["BZ-C055-CHINA-HISTORICAL-DST"].assertions.get("utc_offset") == "+09:00"
        and results["BZ-C056-CHINA-DST-GAP"].blocking_code == "NONEXISTENT_LOCAL_TIME"
    )
    print(f"CHECK_2100_NON_LEAP={'PASS' if non_leap_ok else 'FAIL'}")
    print(f"CHECK_CHINA_HISTORICAL_DST={'PASS' if china_dst_ok else 'FAIL'}")
    if not non_leap_ok:
        failures.append("BZ-C053/BZ-C054: 2100非闰年检查失败")
    if not china_dst_ok:
        failures.append("BZ-C055/BZ-C056: 中国历史夏令时检查失败")
    print(f"MISMATCH_CASE_IDS={','.join(sorted({item.split(':', 1)[0] for item in failures})) or 'NONE'}")
    if failures:
        for failure in failures:
            print(f"FAIL: {failure}")
        return 1
    print("BAZI EXPECTATION RECOMPUTE PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
