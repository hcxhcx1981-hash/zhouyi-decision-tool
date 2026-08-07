from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


PROJECT = Path(__file__).resolve().parents[2]
FROZEN = PROJECT / "data" / "frozen" / "bazi"
RULES_010 = FROZEN / "bazi_calendar_rules_v0.1.0.json"
CASES_010 = FROZEN / "bazi_calendar_test_cases_v0.1.0.json"
SOLAR_010 = FROZEN / "solar_terms_1969_2101_v0.1.0.json"
MANIFEST_010 = FROZEN / "BAZI_FROZEN_MANIFEST_V0.1.0.json"
SUMS_010 = FROZEN / "SHA256SUMS.txt"
RULES_011 = FROZEN / "bazi_calendar_rules_v0.1.1.json"
CASES_011 = FROZEN / "bazi_calendar_test_cases_v0.1.1.json"
MANIFEST_011 = FROZEN / "BAZI_FROZEN_MANIFEST_V0.1.1.json"
SUMS_011 = FROZEN / "SHA256SUMS_V0.1.1.txt"

ORIGINAL_HASHES = {
    RULES_010.name: "24dad075ad478f2017e7519b2a9c375c2dcf0cb4cd5432c6b4291b8d40e8e3fa",
    CASES_010.name: "b04e2adfbc48affb3890e04ea7e3728711ed1220af005740e8e32ed41e21f0ad",
    SOLAR_010.name: "0e22ce7738ee0aedfb15056a3888959907a2e0b88b06ed2b54bce838fc5d5ea2",
    MANIFEST_010.name: "5dc276e7436f62dd8ec53dc334b2c04dc38d93e4adae384d502e2e5735392b09",
    SUMS_010.name: "e089bea4db7e3fab7c358e107b9b00ab1a8ab659e7fd7cf99ef0afcfe70b538f",
}
EXPECTED_CONFLICT_IDS = {
    "BZ-C012-LICHUN-BEFORE",
    "BZ-C014-JINGZHE-BEFORE",
    "BZ-C020-MANGZHONG-BEFORE",
    "BZ-C030-LIDONG-BEFORE",
    "BZ-C032-DAXUE-BEFORE",
    "BZ-C062-SAME-MINUTE-AMBIGUOUS",
}
EXPECTED_ADDED_IDS = {
    "BZ-C064-XIAOHAN-SAME-MINUTE",
    "BZ-C065-QINGMING-SAME-MINUTE",
    "BZ-C066-LIXIA-SAME-MINUTE",
    "BZ-C067-XIAOSHU-SAME-MINUTE",
    "BZ-C068-LIQIU-SAME-MINUTE",
    "BZ-C069-BAILU-SAME-MINUTE",
    "BZ-C070-HANLU-SAME-MINUTE",
}
EXPECTED_BOUNDARY_TERMS = {
    "XIAOHAN", "LICHUN", "JINGZHE", "QINGMING", "LIXIA", "MANGZHONG",
    "XIAOSHU", "LIQIU", "BAILU", "HANLU", "LIDONG", "DAXUE",
}


class Audit:
    def __init__(self) -> None:
        self.passes = 0
        self.failures: list[str] = []

    def check(self, name: str, ok: bool, detail: str = "") -> None:
        if ok:
            self.passes += 1
            print(f"[PASS] {name}" + (f" — {detail}" if detail else ""))
        else:
            self.failures.append(name + (f": {detail}" if detail else ""))
            print(f"[FAIL] {name}" + (f" — {detail}" if detail else ""))


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def stable(value: dict[str, Any]) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def collect_rules(value: Any) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    if isinstance(value, dict):
        if isinstance(value.get("rule_id"), str):
            result.append(value)
        for child in value.values():
            result.extend(collect_rules(child))
    elif isinstance(value, list):
        for child in value:
            result.extend(collect_rules(child))
    return result


def relevant_boundaries(solar: dict[str, Any]) -> list[tuple[datetime, dict[str, Any]]]:
    return [
        (
            datetime.strptime(record["instant_utc"], "%Y-%m-%dT%H:%M:%SZ").replace(
                tzinfo=timezone.utc
            ),
            record,
        )
        for record in solar["records"]
        if record.get("is_month_boundary_jie") is True
    ]


def case_boundary_hits(
    case: dict[str, Any], boundaries: list[tuple[datetime, dict[str, Any]]]
) -> list[dict[str, Any]]:
    value = case.get("input", {})
    local_date = value.get("local_date")
    local_time = value.get("local_time")
    zone_name = value.get("iana_timezone")
    if not (
        value.get("time_known") is True
        and isinstance(local_date, str)
        and not local_date.startswith("$")
        and isinstance(local_time, str)
        and isinstance(zone_name, str)
    ):
        return []
    try:
        local_start = datetime.fromisoformat(f"{local_date}T{local_time}:00").replace(
            tzinfo=ZoneInfo(zone_name)
        )
    except Exception:
        return []
    start = local_start.astimezone(timezone.utc)
    end = start + timedelta(minutes=1)
    return [record for instant, record in boundaries if start <= instant < end]


def minute_conflicts(
    cases: list[dict[str, Any]], boundaries: list[tuple[datetime, dict[str, Any]]]
) -> set[str]:
    result = set()
    for case in cases:
        actual = bool(case_boundary_hits(case, boundaries))
        expected = case.get("expected_blocking_code") == "SOLAR_TERM_SAME_MINUTE_AMBIGUOUS"
        if actual != expected:
            result.add(case["case_id"])
    return result


def main() -> int:
    audit = Audit()
    all_paths = (
        RULES_010, CASES_010, SOLAR_010, MANIFEST_010, SUMS_010,
        RULES_011, CASES_011, MANIFEST_011, SUMS_011,
    )
    audit.check("V0.1.0与V0.1.1必需文件存在", all(path.is_file() for path in all_paths))
    if not all(path.is_file() for path in all_paths):
        return 1

    original_changes = [
        name for name, expected in ORIGINAL_HASHES.items()
        if digest(FROZEN / name) != expected
    ]
    audit.check("V0.1.0五个文件逐字节不变", not original_changes, str(original_changes))

    json_paths = (RULES_011, CASES_011, MANIFEST_011)
    parsed: dict[Path, dict[str, Any]] = {}
    format_errors = []
    for path in json_paths:
        try:
            parsed[path] = load(path)
        except Exception as error:
            format_errors.append(f"{path.name}:{error}")
            continue
        raw = path.read_bytes()
        if raw.startswith(b"\xef\xbb\xbf") or b"\r" in raw or raw != stable(parsed[path]):
            format_errors.append(path.name)
    audit.check("V0.1.1 JSON可解析且为稳定UTF-8/LF", not format_errors, str(format_errors))
    if format_errors:
        return 1

    rules0, cases0, solar = load(RULES_010), load(CASES_010), load(SOLAR_010)
    rules1, cases1, manifest1 = (parsed[path] for path in json_paths)
    audit.check(
        "V0.1.1规则元数据正确",
        rules1.get("protocol_id") == "BAZI_CALENDAR_RULES_V0_1_1"
        and rules1.get("version") == "0.1.1"
        and rules1.get("status") == "FROZEN"
        and rules1.get("runtime_dataset_id") == "BAZI_SOLAR_TERMS_1969_2101_V0_1_0",
    )
    rule_map0 = {item["rule_id"]: item for item in collect_rules(rules0)}
    rule_map1 = {item["rule_id"]: item for item in collect_rules(rules1)}
    old_rule_changes = [
        rule_id for rule_id in rule_map0
        if rule_map1.get(rule_id) != rule_map0[rule_id]
    ]
    new_rule = rule_map1.get("CAL-MINUTE-INTERVAL-005", {})
    audit.check("V0.1.0既有24条规则语义不变", not old_rule_changes, str(old_rule_changes))
    audit.check(
        "仅新增冻结分钟半开区间规则",
        set(rule_map1) == set(rule_map0) | {"CAL-MINUTE-INTERVAL-005"}
        and new_rule.get("status") == "FROZEN"
        and "[HH:mm:00,下一分钟)" in new_rule.get("statement", "")
        and "SOLAR_TERM_SAME_MINUTE_AMBIGUOUS" in new_rule.get("blocking_behavior", ""),
    )
    statuses = Counter(rule.get("status") for rule in rule_map1.values())
    audit.check("V0.1.1规则25条且无未决状态", len(rule_map1) == 25 and statuses["FROZEN"] == 24 and statuses["OUT_OF_SCOPE_V0_1"] == 1)
    minute_policy = rules1.get("input_contract", {}).get("minute_interval_semantics", {})
    audit.check(
        "分钟区间禁止取整正式instant_utc",
        minute_policy.get("local_interval") == "[HH:mm:00, next local minute)"
        and "不得把正式instant_utc四舍五入" in minute_policy.get("non_rounding_rule", ""),
    )

    list0, list1 = cases0.get("cases", []), cases1.get("cases", [])
    ids0 = [case.get("case_id") for case in list0]
    ids1 = [case.get("case_id") for case in list1]
    audit.check("V0.1.1案例元数据正确", cases1.get("protocol_id") == "BAZI_CALENDAR_TEST_CASES_V0_1_1" and cases1.get("version") == "0.1.1" and cases1.get("rules_version") == "0.1.1" and cases1.get("dataset_version") == "0.1.0")
    audit.check("案例总数70且ID唯一", len(list1) == len(set(ids1)) == 70)
    audit.check("原63个case_id与input保持不变", ids1[:63] == ids0 and all(left.get("input") == right.get("input") for left, right in zip(list0, list1[:63])))
    audit.check("新增7个案例ID准确", set(ids1[63:]) == EXPECTED_ADDED_IDS)
    by0 = {case["case_id"]: case for case in list0}
    by1 = {case["case_id"]: case for case in list1}
    unchanged_case_errors = [
        case_id for case_id in ids0 if case_id not in EXPECTED_CONFLICT_IDS and by1[case_id] != by0[case_id]
    ]
    audit.check("除6个冲突外原57个案例对象不变", not unchanged_case_errors, str(unchanged_case_errors))
    patched_block_ids = EXPECTED_CONFLICT_IDS - {"BZ-C062-SAME-MINUTE-AMBIGUOUS"}
    audit.check(
        "5个区间包含节气的旧案例改为同分钟阻断",
        all(
            by1[case_id].get("expected_status") == "BLOCKED"
            and by1[case_id].get("expected_blocking_code") == "SOLAR_TERM_SAME_MINUTE_AMBIGUOUS"
            and "expected_pillars" not in by1[case_id]
            and "expected_warnings" not in by1[case_id]
            for case_id in patched_block_ids
        ),
    )
    c62 = by1["BZ-C062-SAME-MINUTE-AMBIGUOUS"]
    audit.check(
        "C062改为可唯一判定的立春后四柱并保留边界警告",
        c62.get("expected_blocking_code") is None
        and c62.get("expected_pillars") == {"year": "甲辰", "month": "丙寅", "day": "戊戌", "hour": "庚申"}
        and c62.get("expected_warnings") == ["BOUNDARY_SENSITIVE"],
    )

    boundaries = relevant_boundaries(solar)
    conflicts0 = minute_conflicts(list0, boundaries)
    conflicts1 = minute_conflicts(list1, boundaries)
    audit.check("V0.1.0只读冲突恰好6个", conflicts0 == EXPECTED_CONFLICT_IDS, str(sorted(conflicts0)))
    audit.check("V0.1.1分钟区间期望与instant_utc零冲突", not conflicts1, str(sorted(conflicts1)))
    same_minute_cases = []
    covered_terms = set()
    for case in list1:
        hits = case_boundary_hits(case, boundaries)
        if hits:
            same_minute_cases.append(case)
            covered_terms.update(record["term_id"] for record in hits)
    audit.check(
        "12个月界节同分钟全部阻断",
        len(same_minute_cases) == 12
        and covered_terms == EXPECTED_BOUNDARY_TERMS
        and all(case.get("expected_blocking_code") == "SOLAR_TERM_SAME_MINUTE_AMBIGUOUS" for case in same_minute_cases),
        f"cases={len(same_minute_cases)}, terms={sorted(covered_terms)}",
    )
    audit.check("正式节气仍为3192条", len(solar.get("records", [])) == 3192)
    audit.check("正式节气V0.1.0 SHA-256保持", digest(SOLAR_010) == ORIGINAL_HASHES[SOLAR_010.name])

    sums: dict[str, str] = {}
    sum_errors = []
    raw_sums = SUMS_011.read_bytes()
    if raw_sums.startswith(b"\xef\xbb\xbf") or b"\r" in raw_sums or not raw_sums.endswith(b"\n"):
        sum_errors.append("format")
    for line in raw_sums.decode("ascii").splitlines():
        value, name = line.split("  ", 1)
        if not re.fullmatch(r"[0-9a-f]{64}", value) or name in sums:
            sum_errors.append(name)
        sums[name] = value
    expected_sum_names = {MANIFEST_011.name, RULES_011.name, CASES_011.name, SOLAR_010.name}
    if set(sums) != expected_sum_names:
        sum_errors.append("file_set")
    for name, value in sums.items():
        if digest(FROZEN / name) != value:
            sum_errors.append(name)
    audit.check("V0.1.1 SHA256清单全部匹配", not sum_errors, str(sum_errors))

    manifest_entries = {entry.get("relative_path"): entry for entry in manifest1.get("files", [])}
    manifest_errors = []
    for relative_path, entry in manifest_entries.items():
        path = PROJECT / relative_path
        if not path.is_file() or entry.get("sha256") != digest(path) or entry.get("byte_size") != path.stat().st_size:
            manifest_errors.append(relative_path)
    audit.check("V0.1.1 Manifest文件哈希与大小匹配", not manifest_errors and len(manifest_entries) == 3, str(manifest_errors))
    audit.check(
        "Manifest声明复用V0.1.0节气且页面未接入",
        manifest1.get("version") == "0.1.1"
        and manifest1.get("runtime_contract", {}).get("solar_term_dataset_version") == "0.1.0"
        and manifest1.get("runtime_contract", {}).get("solar_term_instant_utc_changes") == 0
        and manifest1.get("runtime_contract", {}).get("application_integration_completed") is False
        and manifest1.get("runtime_contract", {}).get("page_not_implemented_remains") is True,
    )

    runtime_sources = list((PROJECT / "src").rglob("*.ts")) + list((PROJECT / "src").rglob("*.tsx"))
    runtime_references = [
        path.relative_to(PROJECT).as_posix() for path in runtime_sources
        if "bazi_calendar_rules_v0.1.1" in path.read_text(encoding="utf-8")
        or "bazi_calendar_test_cases_v0.1.1" in path.read_text(encoding="utf-8")
    ]
    form_source = (PROJECT / "src" / "lib" / "bazi" / "form.ts").read_text(encoding="utf-8")
    audit.check("src未接入V0.1.1数据", not runtime_references, str(runtime_references))
    audit.check("页面NOT_IMPLEMENTED保持", 'status: "NOT_IMPLEMENTED"' in form_source)

    print(f"V0_1_0_CONFLICTS={len(conflicts0)}")
    print("V0_1_0_CONFLICT_IDS=" + ",".join(sorted(conflicts0)))
    print(f"V0_1_1_CASES={len(list1)}")
    print(f"MONTH_BOUNDARY_SAME_MINUTE_BLOCKED={len(same_minute_cases)}/12")
    print(f"SOLAR_TERM_INSTANT_IDENTITY={len(solar.get('records', []))}/3192")
    print(f"RULES_V0_1_1_SHA256={digest(RULES_011)}")
    print(f"CASES_V0_1_1_SHA256={digest(CASES_011)}")
    print(f"RESULT={audit.passes} PASS / {len(audit.failures)} FAIL")
    if audit.failures:
        print("BAZI_MINUTE_BOUNDARY_PATCH_V0.1.1: FAIL")
        return 1
    print("BAZI_MINUTE_BOUNDARY_PATCH_V0.1.1: ALL PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
