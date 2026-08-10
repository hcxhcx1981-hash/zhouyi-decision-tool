from __future__ import annotations

import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT = Path(__file__).resolve().parents[2]
RESEARCH = PROJECT / "research" / "bazi"
FROZEN = PROJECT / "data" / "frozen" / "bazi"
RULES = FROZEN / "bazi_calendar_rules_v0.1.0.json"
CASES = FROZEN / "bazi_calendar_test_cases_v0.1.0.json"
SOLAR = FROZEN / "solar_terms_1969_2101_v0.1.0.json"
MANIFEST = FROZEN / "BAZI_FROZEN_MANIFEST_V0.1.0.json"
SUMS = FROZEN / "SHA256SUMS.txt"
RULES_C = RESEARCH / "bazi_calendar_rules_candidate_v0.1.json"
CASES_C = RESEARCH / "bazi_calendar_test_cases_candidate_v0.1.json"
SOLAR_C = RESEARCH / "solar_terms_1969_2101.candidate.json"
SOLAR_C_SUM = RESEARCH / "solar_terms_1969_2101.candidate.json.sha256"
MATRIX = RESEARCH / "solar_term_validation_matrix_v0.1.json"
LOCK = RESEARCH / "requirements-solar-term-generator.lock.txt"
NOTICES = RESEARCH / "THIRD_PARTY_NOTICES_SOLAR_TERM.md"

SOURCE_COMMIT = "a0e6c91"
VERSION = "0.1.0"
DATASET_ID = "BAZI_SOLAR_TERMS_1969_2101_V0_1_0"
WHEEL_SHA256 = "232ba7dd2bbf42225c48be6721b676e8c6c079dbd4588d2781dfa68adcb6f67f"
SOLAR_C_SHA256 = "21f71221a6390d2ce6091a3668f28b2736478dbcee62c695f11573ecbd95f5f7"
LOCK_LINE = f"astronomy-engine==2.1.19 --hash=sha256:{WHEEL_SHA256}"
ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
EXPECTED_FILES = {
    "bazi_calendar_rules_v0.1.0.json",
    "bazi_calendar_test_cases_v0.1.0.json",
    "solar_terms_1969_2101_v0.1.0.json",
    "BAZI_FROZEN_MANIFEST_V0.1.0.json",
    "SHA256SUMS.txt",
}
VERSIONED_FROZEN_ASSET_PATTERNS = (
    re.compile(r"^bazi_calendar_rules_v\d+\.\d+\.\d+\.json$"),
    re.compile(r"^bazi_calendar_test_cases_v\d+\.\d+\.\d+\.json$"),
    re.compile(r"^solar_terms_\d{4}_\d{4}_v\d+\.\d+\.\d+\.json$"),
    re.compile(r"^BAZI_FROZEN_MANIFEST_V\d+\.\d+\.\d+\.json$"),
    re.compile(r"^SHA256SUMS_V\d+\.\d+\.\d+\.txt$"),
)


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


def load(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def stable(value: dict[str, Any]) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


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


def rule_map(value: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {rule["rule_id"]: rule for rule in collect_rules(value)}


def parse_utc(value: str) -> datetime:
    return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)


def inspect_frozen_asset_names(directory: Path) -> tuple[set[str], set[str]]:
    names = {path.name for path in directory.iterdir()} if directory.is_dir() else set()
    missing = EXPECTED_FILES - names
    unknown = {
        name
        for name in names - EXPECTED_FILES
        if not any(pattern.fullmatch(name) for pattern in VERSIONED_FROZEN_ASSET_PATTERNS)
    }
    return missing, unknown


def expected_promoted_rules(candidate: dict[str, Any]) -> dict[str, Any]:
    body = json.loads(json.dumps(candidate, ensure_ascii=False))
    ref = body.pop("final_freeze_reference")
    for key in ("protocol_id", "version", "status", "decision_authority"):
        body.pop(key, None)
    for rule in collect_rules(body):
        if rule["status"] == "PROPOSED_FREEZE":
            rule["status"] = "FROZEN"
        if rule["rule_id"] == "SOLAR-TERM-RUNTIME-DATASET-001":
            rule["blocking_behavior"] = None
    body["blocking_conditions"] = [
        item for item in body["blocking_conditions"]
        if item.get("code") != "SOLAR_TERM_RUNTIME_DATASET_NOT_FROZEN"
    ]
    return {
        "protocol_id": "BAZI_CALENDAR_RULES_V0_1_0",
        "version": VERSION,
        "status": "FROZEN",
        "frozen_from_commit": SOURCE_COMMIT,
        "frozen_at": ref["frozen_at_utc"],
        "runtime_dataset_id": DATASET_ID,
        "decision_authority": "ChatGPT最终冻结裁决（Phase 2.1.3）",
        **body,
    }


def main() -> int:
    audit = Audit()
    missing_assets, unknown_assets = inspect_frozen_asset_names(FROZEN)
    audit.check("V0.1.0必需正式资产完整", not missing_assets, f"missing={sorted(missing_assets)}")
    audit.check(
        "正式目录无未知/非法资产",
        not unknown_assets,
        "UNKNOWN_FROZEN_ASSET=" + repr(sorted(unknown_assets)),
    )
    if missing_assets:
        return 1

    json_paths = (RULES, CASES, SOLAR, MANIFEST)
    parsed: dict[Path, dict[str, Any]] = {}
    parse_errors = []
    format_errors = []
    for path in json_paths:
        try:
            parsed[path] = load(path)
        except Exception as error:
            parse_errors.append((path.name, str(error)))
            continue
        raw = path.read_bytes()
        if raw.startswith(b"\xef\xbb\xbf") or b"\r" in raw or raw != stable(parsed[path]) or not raw.endswith(b"\n") or raw.endswith(b"\n\n"):
            format_errors.append(path.name)
    audit.check("四个正式JSON可解析", not parse_errors, str(parse_errors[:2]))
    audit.check("UTF-8无BOM且稳定LF序列化", not format_errors, str(format_errors))
    if parse_errors:
        return 1

    rules, cases, solar, manifest = (parsed[path] for path in json_paths)
    rules_c, cases_c, solar_c, matrix = (load(path) for path in (RULES_C, CASES_C, SOLAR_C, MATRIX))

    sums: dict[str, str] = {}
    sum_errors = []
    try:
        raw = SUMS.read_bytes()
        if raw.startswith(b"\xef\xbb\xbf") or b"\r" in raw or not raw.endswith(b"\n"):
            sum_errors.append("format")
        for line in raw.decode("ascii").splitlines():
            value, name = line.split("  ", 1)
            if name in sums or not re.fullmatch(r"[0-9a-f]{64}", value):
                sum_errors.append(name)
            sums[name] = value
        if list(sums) != sorted(EXPECTED_FILES - {SUMS.name}):
            sum_errors.append("order_or_names")
        for name, value in sums.items():
            if digest(FROZEN / name) != value:
                sum_errors.append(name)
    except Exception as error:
        sum_errors.append(str(error))
    audit.check("SHA256SUMS全部重新计算匹配", not sum_errors, str(sum_errors[:3]))
    audit.check("SHA256SUMS不包含自身", SUMS.name not in sums)

    entries = manifest.get("files", [])
    entry_map: dict[str, dict[str, Any]] = {}
    manifest_errors = []
    for entry in entries:
        rel = entry.get("relative_path")
        if not isinstance(rel, str) or rel in entry_map:
            manifest_errors.append((rel, "invalid_or_duplicate"))
            continue
        entry_map[rel] = entry
        path = PROJECT / Path(rel)
        if not path.is_file() or entry.get("sha256") != digest(path) or entry.get("byte_size") != path.stat().st_size:
            manifest_errors.append((rel, "missing_hash_or_size"))
    expected_entry_paths = {
        RULES.relative_to(PROJECT).as_posix(), CASES.relative_to(PROJECT).as_posix(), SOLAR.relative_to(PROJECT).as_posix(),
        NOTICES.relative_to(PROJECT).as_posix(), LOCK.relative_to(PROJECT).as_posix(),
    }
    if set(entry_map) != expected_entry_paths:
        manifest_errors.append(("files", "set_mismatch"))
    audit.check("Manifest五项哈希和大小全部匹配", not manifest_errors, str(manifest_errors[:3]))
    overlap_errors = [
        rel for rel, entry in entry_map.items()
        if rel.startswith("data/frozen/bazi/") and sums.get(Path(rel).name) != entry.get("sha256")
    ]
    audit.check("Manifest与SHA256SUMS共同哈希一致", not overlap_errors, str(overlap_errors))

    audit.check("规则protocol_id正确", rules.get("protocol_id") == "BAZI_CALENDAR_RULES_V0_1_0")
    audit.check("规则version为0.1.0", rules.get("version") == VERSION)
    audit.check("规则status为FROZEN", rules.get("status") == "FROZEN")
    audit.check("规则来源commit和数据集ID正确", rules.get("frozen_from_commit") == SOURCE_COMMIT and rules.get("runtime_dataset_id") == DATASET_ID)
    candidate_rules, frozen_rules = rule_map(rules_c), rule_map(rules)
    counts = Counter(rule.get("status") for rule in frozen_rules.values())
    promoted_count = sum(rule.get("status") == "PROPOSED_FREEZE" for rule in candidate_rules.values())
    audit.check("规则ID与候选一致", set(candidate_rules) == set(frozen_rules) and len(frozen_rules) == 24)
    audit.check("FROZEN规则数量符合晋级", counts["FROZEN"] == promoted_count == 23, f"count={counts['FROZEN']}")
    audit.check("UNRESOLVED为0", counts["UNRESOLVED"] == 0)
    audit.check("REQUIRES_MORE_EVIDENCE为0", counts["REQUIRES_MORE_EVIDENCE"] == 0)
    audit.check("OUT_OF_SCOPE未激活", counts["OUT_OF_SCOPE_V0_1"] == 1)
    target = frozen_rules.get("SOLAR-TERM-RUNTIME-DATASET-001", {})
    audit.check("SOLAR-TERM-RUNTIME-DATASET-001为FROZEN", target.get("status") == "FROZEN")
    audit.check("数据未冻结阻断已解除", "blocking_behavior" in target and target.get("blocking_behavior") is None)
    other_block_changes = [
        rule_id for rule_id, candidate in candidate_rules.items()
        if rule_id != "SOLAR-TERM-RUNTIME-DATASET-001" and frozen_rules.get(rule_id, {}).get("blocking_behavior") != candidate.get("blocking_behavior")
    ]
    audit.check("其他未实现业务阻断未解除", not other_block_changes, str(other_block_changes))
    expected_conditions = [item for item in rules_c["blocking_conditions"] if item.get("code") != "SOLAR_TERM_RUNTIME_DATASET_NOT_FROZEN"]
    audit.check("仅移除数据未冻结顶层阻断", rules.get("blocking_conditions") == expected_conditions)
    policy_ids = {"YEAR-LICHUN-001", "MONTH-JIE-001", "DAY-BOUNDARY-003", "HOUR-ZI-DAY-COUPLING-003"}
    audit.check("日界立春月界保持PRODUCT_TRADITION_POLICY", all(frozen_rules.get(rule_id, {}).get("rule_class") == "PRODUCT_TRADITION_POLICY" for rule_id in policy_ids))
    rules_semantic_ok = rules == expected_promoted_rules(rules_c)
    audit.check("规则除授权晋级外无语义变化", rules_semantic_ok)

    records, records_c = solar.get("records", []), solar_c.get("records", [])
    audit.check("正式节气元数据正确", solar.get("dataset_id") == DATASET_ID and solar.get("version") == VERSION and solar.get("status") == "FROZEN_RUNTIME_DATA")
    audit.check("正式节气3192条", len(records) == 3192)
    years = sorted({record.get("year") for record in records})
    audit.check("正式节气133年", years == list(range(1969, 2102)), f"years={len(years)}")
    grouped: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        grouped[record.get("year")].append(record)
    audit.check("每年正好24条", all(len(grouped[year]) == 24 for year in range(1969, 2102)))
    utc_values = [record.get("instant_utc") for record in records]
    valid_utc = [value for value in utc_values if isinstance(value, str) and ISO_RE.fullmatch(value)]
    audit.check("UTC 3192/3192", len(valid_utc) == 3192)

    def matches(field: str) -> int:
        return sum(left.get(field) == right.get(field) for left, right in zip(records_c, records))

    instant_match = matches("instant_utc")
    term_match = matches("term_id")
    longitude_match = matches("solar_longitude_degrees")
    boundary_match = sum(left.get("is_month_boundary_jie") == right.get("is_month_boundary_jie") and left.get("is_zhongqi") == right.get("is_zhongqi") for left, right in zip(records_c, records))
    branch_match = matches("month_branch_after_boundary")
    records_exact = len(records_c) == len(records) == 3192 and records_c == records
    audit.check("候选/正式instant_utc 3192/3192", instant_match == 3192)
    audit.check("候选/正式term_id 3192/3192", term_match == 3192)
    audit.check("候选/正式黄经3192/3192", longitude_match == 3192)
    audit.check("候选/正式节中气角色3192/3192", boundary_match == 3192)
    audit.check("候选/正式月支映射3192/3192", branch_match == 3192)
    audit.check("正式单条records全部字段不变", records_exact)
    times = [parse_utc(value) for value in valid_utc] if len(valid_utc) == 3192 else []
    duplicates = len(times) - len(set(times))
    order_errors = sum(right <= left for left, right in zip(times, times[1:]))
    audit.check("重复时间0", duplicates == 0)
    audit.check("顺序错误0", order_errors == 0)
    formal_map = {(record["year"], record["term_id"]): record["instant_utc"] for record in records}
    matrix_rows = matrix.get("records", [])
    matrix_match = sum(formal_map.get((row["year"], row["term_id"])) == row["generated_instant_utc"] for row in matrix_rows)
    audit.check("456矩阵一致", len(matrix_rows) == matrix_match == 456)
    audit.check("timestamp_resolution为second", solar.get("timestamp_resolution") == "second" and sum(record.get("timestamp_resolution") == "second" for record in records) == 3192)
    audit.check("second_level_accuracy_claim=false", solar.get("second_level_accuracy_claim") is False)
    audit.check("verification_status未夸大", matches("verification_status") == 3192)
    audit.check("生成器外推限制存在", solar.get("external_extrapolation_ranges") == ["1969-2008", "2028-2101"] and any("无官方分钟级逐点核验" in item for item in solar.get("known_limitations", [])))

    frozen_cases, candidate_cases = cases.get("cases", []), cases_c.get("cases", [])
    audit.check("正式案例元数据正确", cases.get("protocol_id") == "BAZI_CALENDAR_TEST_CASES_V0_1_0" and cases.get("version") == VERSION and cases.get("status") == "FROZEN_REGRESSION_SUITE")
    audit.check("正式案例63个", len(frozen_cases) == 63)
    audit.check("case_id完全一致", [item.get("case_id") for item in frozen_cases] == [item.get("case_id") for item in candidate_cases])
    audit.check("input完全一致", [item.get("input") for item in frozen_cases] == [item.get("input") for item in candidate_cases])
    audit.check("expected_pillars完全一致", [item.get("expected_pillars") for item in frozen_cases] == [item.get("expected_pillars") for item in candidate_cases])
    audit.check("expected_blocking_code完全一致", [item.get("expected_blocking_code") for item in frozen_cases] == [item.get("expected_blocking_code") for item in candidate_cases])
    audit.check("expected_warnings完全一致", [item.get("expected_warnings") for item in frozen_cases] == [item.get("expected_warnings") for item in candidate_cases])
    case_semantic_ok = frozen_cases == candidate_cases
    audit.check("63个案例对象语义一致", case_semantic_ok)

    lock_lines = LOCK.read_text(encoding="ascii").splitlines() if LOCK.is_file() else []
    notices = NOTICES.read_text(encoding="utf-8") if NOTICES.is_file() else ""
    audit.check("wheel版本2.1.19", lock_lines == [LOCK_LINE] and "astronomy-engine==2.1.19" in lock_lines[0])
    audit.check("wheel SHA-256正确", lock_lines == [LOCK_LINE] and WHEEL_SHA256 in lock_lines[0])
    audit.check("MIT声明存在", "MIT License" in notices and "Permission is hereby granted" in notices and "Copyright (c) 2019-2022 Don Cross" in notices)
    audit.check("source research commit正确", manifest.get("source_research_commit") == SOURCE_COMMIT and manifest.get("frozen_from_commit") == SOURCE_COMMIT)
    candidate_hash = digest(SOLAR_C)
    audit.check("candidate SHA-256正确", candidate_hash == SOLAR_C_SHA256 and SOLAR_C_SUM.read_text(encoding="ascii").strip() == f"{candidate_hash}  {SOLAR_C.name}" and manifest.get("source_chain", {}).get("candidate_dataset_sha256") == candidate_hash)
    limitations = manifest.get("known_limitations", [])
    audit.check("Manifest外推限制存在", any("1969—2008及2028—2101" in item for item in limitations))
    runtime = manifest.get("runtime_contract", {})
    audit.check("runtime只读不联网不运行天文算法", runtime.get("read_only_static_json") is True and runtime.get("network_required") is False and runtime.get("astronomy_algorithm_at_runtime") is False)
    audit.check("Manifest声明应用尚未接入", runtime.get("application_integration_completed") is False and runtime.get("page_not_implemented_remains") is True)

    unauthorized = 0 if rules_semantic_ok and records_exact and case_semantic_ok else 1
    print(f"candidate_to_frozen_instant_match: {instant_match}/3192")
    print(f"candidate_to_frozen_term_id_match: {term_match}/3192")
    print(f"candidate_to_frozen_longitude_match: {longitude_match}/3192")
    print(f"candidate_to_frozen_boundary_role_match: {boundary_match}/3192")
    print(f"candidate_to_frozen_month_branch_match: {branch_match}/3192")
    print(f"regression_case_semantic_match: {63 if case_semantic_ok else 0}/63")
    print(f"official_matrix_match: {matrix_match}/456")
    print(f"rules_semantic_promotion_count: {promoted_count}")
    print(f"unauthorized_semantic_changes: {unauthorized}")
    print(f"FROZEN_RULES={counts['FROZEN']}")
    print(f"OUT_OF_SCOPE_RULES={counts['OUT_OF_SCOPE_V0_1']}")
    print(f"UNRESOLVED_RULES={counts['UNRESOLVED']}")
    print(f"REQUIRES_MORE_EVIDENCE_RULES={counts['REQUIRES_MORE_EVIDENCE']}")
    print(f"RESULT={audit.passes} PASS / {len(audit.failures)} FAIL")
    if audit.failures or unauthorized:
        print("FROZEN_RELEASE_VALIDATION: FAIL")
        return 1
    print("FROZEN_RELEASE_VALIDATION: ALL PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
