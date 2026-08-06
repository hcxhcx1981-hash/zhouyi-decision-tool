from __future__ import annotations

import argparse
import copy
import hashlib
import json
import sys
from pathlib import Path
from typing import Any


PROJECT = Path(__file__).resolve().parents[2]
RESEARCH = PROJECT / "research" / "bazi"
OUTPUT = PROJECT / "data" / "frozen" / "bazi"

RULES_SOURCE = RESEARCH / "bazi_calendar_rules_candidate_v0.1.json"
CASES_SOURCE = RESEARCH / "bazi_calendar_test_cases_candidate_v0.1.json"
SOLAR_SOURCE = RESEARCH / "solar_terms_1969_2101.candidate.json"
SOLAR_SOURCE_SUM = RESEARCH / "solar_terms_1969_2101.candidate.json.sha256"
NOTICES = RESEARCH / "THIRD_PARTY_NOTICES_SOLAR_TERM.md"
LOCK = RESEARCH / "requirements-solar-term-generator.lock.txt"

RULES_OUT = OUTPUT / "bazi_calendar_rules_v0.1.0.json"
CASES_OUT = OUTPUT / "bazi_calendar_test_cases_v0.1.0.json"
SOLAR_OUT = OUTPUT / "solar_terms_1969_2101_v0.1.0.json"
MANIFEST_OUT = OUTPUT / "BAZI_FROZEN_MANIFEST_V0.1.0.json"
SUMS_OUT = OUTPUT / "SHA256SUMS.txt"

SOURCE_COMMIT = "a0e6c91"
VERSION = "0.1.0"
DATASET_ID = "BAZI_SOLAR_TERMS_1969_2101_V0_1_0"
WHEEL_SHA256 = "232ba7dd2bbf42225c48be6721b676e8c6c079dbd4588d2781dfa68adcb6f67f"
SOLAR_SOURCE_SHA256 = "21f71221a6390d2ce6091a3668f28b2736478dbcee62c695f11573ecbd95f5f7"


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def json_bytes(value: dict[str, Any]) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def digest_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def digest_file(path: Path) -> str:
    return digest_bytes(path.read_bytes())


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


def promote_rules(source: dict[str, Any], frozen_at: str) -> dict[str, Any]:
    source_rules = collect_rules(source)
    statuses = [rule.get("status") for rule in source_rules]
    if len(source_rules) != 24 or statuses.count("PROPOSED_FREEZE") != 23:
        raise ValueError("候选规则必须为24条，其中23条PROPOSED_FREEZE")
    if statuses.count("OUT_OF_SCOPE_V0_1") != 1:
        raise ValueError("OUT_OF_SCOPE_V0_1必须为1条")
    if any(item in {"UNRESOLVED", "REQUIRES_MORE_EVIDENCE"} for item in statuses):
        raise ValueError("候选规则仍含未解决状态")

    body = copy.deepcopy(source)
    for key in ("protocol_id", "version", "status", "decision_authority", "final_freeze_reference"):
        body.pop(key, None)
    for rule in collect_rules(body):
        if rule["status"] == "PROPOSED_FREEZE":
            rule["status"] = "FROZEN"
        elif rule["status"] != "OUT_OF_SCOPE_V0_1":
            raise ValueError(f"非法晋级状态: {rule['rule_id']}={rule['status']}")
        if rule["rule_id"] == "SOLAR-TERM-RUNTIME-DATASET-001":
            rule["blocking_behavior"] = None

    before = body["blocking_conditions"]
    body["blocking_conditions"] = [
        item for item in before if item.get("code") != "SOLAR_TERM_RUNTIME_DATASET_NOT_FROZEN"
    ]
    if len(body["blocking_conditions"]) != len(before) - 1:
        raise ValueError("数据未冻结阻断必须唯一移除")

    return {
        "protocol_id": "BAZI_CALENDAR_RULES_V0_1_0",
        "version": VERSION,
        "status": "FROZEN",
        "frozen_from_commit": SOURCE_COMMIT,
        "frozen_at": frozen_at,
        "runtime_dataset_id": DATASET_ID,
        "decision_authority": "ChatGPT最终冻结裁决（Phase 2.1.3）",
        **body,
    }


def promote_cases(source: dict[str, Any], frozen_at: str) -> dict[str, Any]:
    cases = source.get("cases", [])
    if len(cases) != 63 or len({case.get("case_id") for case in cases}) != 63:
        raise ValueError("候选案例必须为63个且case_id唯一")
    return {
        "protocol_id": "BAZI_CALENDAR_TEST_CASES_V0_1_0",
        "version": VERSION,
        "status": "FROZEN_REGRESSION_SUITE",
        "frozen_from_commit": SOURCE_COMMIT,
        "frozen_at": frozen_at,
        "rules_version": VERSION,
        "dataset_version": VERSION,
        "pillars_order": copy.deepcopy(source["pillars_order"]),
        "fixtures_are_anonymous": source["fixtures_are_anonymous"],
        "cases": copy.deepcopy(cases),
    }


def promote_solar(source: dict[str, Any], frozen_at: str) -> dict[str, Any]:
    records = source.get("records", [])
    precision = source.get("precision_policy", {})
    if len(records) != 3192 or source.get("status") != "CANDIDATE_NOT_FOR_RUNTIME":
        raise ValueError("候选节气状态或记录数量不符")
    if source.get("verification_status") != "PENDING_FULL_AUDIT":
        raise ValueError("候选核验状态不符")
    if precision.get("timestamp_resolution") != "second" or precision.get("second_level_accuracy_claim") is not False:
        raise ValueError("候选精度协议不符")
    return {
        "dataset_id": DATASET_ID,
        "version": VERSION,
        "status": "FROZEN_RUNTIME_DATA",
        "frozen_from_commit": SOURCE_COMMIT,
        "frozen_at": frozen_at,
        "coverage": copy.deepcopy(source["coverage"]),
        "record_count": 3192,
        "time_standard": "UTC",
        "generator": copy.deepcopy(source["generator"]),
        "wheel_sha256": WHEEL_SHA256,
        "timestamp_resolution": "second",
        "second_level_accuracy_claim": False,
        "official_crosscheck": {
            "source_id": "SRC-NAOJ-SOLAR-TERM",
            "coverage": "2009-2027",
            "record_count": 456,
            "resolution": "minute",
        },
        "external_extrapolation_ranges": ["1969-2008", "2028-2101"],
        "runtime_policy": {
            "read_only_static_json": True,
            "network_required": False,
            "astronomy_algorithm_at_runtime": False,
        },
        "precision_policy": copy.deepcopy(precision),
        "term_registry_version": source["term_registry_version"],
        "known_limitations": [
            "1969—2008及2028—2101无官方分钟级逐点核验，属于固定生成器外推范围。",
            "时间戳保存到整秒只表示保存分辨率，不声称具有官方秒级准确度。",
            "官方逐条交叉核验源只提供分钟显示。",
        ],
        "records": copy.deepcopy(records),
    }


def file_entry(
    relative_path: str,
    role: str,
    payload: bytes,
    count_key: str,
    count: int,
    source_path: Path,
    source_hash: str,
    identity: str,
) -> dict[str, Any]:
    return {
        "relative_path": relative_path,
        "file_role": role,
        "sha256": digest_bytes(payload),
        "byte_size": len(payload),
        count_key: count,
        "source_candidate_path": source_path.relative_to(PROJECT).as_posix(),
        "source_candidate_sha256": source_hash,
        "semantic_identity_check": identity,
    }


def build_outputs() -> dict[Path, bytes]:
    rules_source = load_json(RULES_SOURCE)
    cases_source = load_json(CASES_SOURCE)
    solar_source = load_json(SOLAR_SOURCE)
    freeze_ref = rules_source.get("final_freeze_reference", {})
    frozen_at = freeze_ref.get("frozen_at_utc")
    if freeze_ref.get("source_research_commit") != SOURCE_COMMIT or not isinstance(frozen_at, str):
        raise ValueError("final_freeze_reference缺失或基线不符")

    solar_source_hash = digest_file(SOLAR_SOURCE)
    if solar_source_hash != SOLAR_SOURCE_SHA256:
        raise ValueError("候选节气SHA-256不符")
    if SOLAR_SOURCE_SUM.read_text(encoding="ascii").strip() != f"{solar_source_hash}  {SOLAR_SOURCE.name}":
        raise ValueError("候选节气独立哈希文件不匹配")

    rules_bytes = json_bytes(promote_rules(rules_source, frozen_at))
    cases_bytes = json_bytes(promote_cases(cases_source, frozen_at))
    solar_bytes = json_bytes(promote_solar(solar_source, frozen_at))
    rules_hash = digest_file(RULES_SOURCE)
    cases_hash = digest_file(CASES_SOURCE)

    entries = [
        file_entry(RULES_OUT.relative_to(PROJECT).as_posix(), "FROZEN_CALENDAR_RULES", rules_bytes, "rule_count", 24, RULES_SOURCE, rules_hash, "23 PROPOSED_FREEZE→FROZEN；1 OUT_OF_SCOPE保留；仅解除数据未冻结阻断"),
        file_entry(CASES_OUT.relative_to(PROJECT).as_posix(), "FROZEN_REGRESSION_SUITE", cases_bytes, "case_count", 63, CASES_SOURCE, cases_hash, "63/63案例对象完全一致"),
        file_entry(SOLAR_OUT.relative_to(PROJECT).as_posix(), "FROZEN_SOLAR_TERM_RUNTIME_DATA", solar_bytes, "record_count", 3192, SOLAR_SOURCE, solar_source_hash, "3192/3192记录语义一致，仅顶层正式元数据变化"),
    ]
    for path, role in ((NOTICES, "THIRD_PARTY_LICENSE_NOTICE"), (LOCK, "GENERATOR_DEPENDENCY_LOCK")):
        payload = path.read_bytes()
        entries.append(file_entry(path.relative_to(PROJECT).as_posix(), role, payload, "record_count", 1, path, digest_bytes(payload), "SOURCE_FILE_REFERENCED_BY_SHA256"))

    manifest = {
        "manifest_id": "BAZI_FROZEN_MANIFEST_V0_1_0",
        "version": VERSION,
        "status": "FROZEN_RELEASE_MANIFEST",
        "frozen_from_commit": SOURCE_COMMIT,
        "source_research_commit": SOURCE_COMMIT,
        "generated_at_utc": frozen_at,
        "files": entries,
        "dependency_lock": {
            "relative_path": LOCK.relative_to(PROJECT).as_posix(),
            "package": "astronomy-engine",
            "version": "2.1.19",
            "wheel_sha256": WHEEL_SHA256,
            "lock_file_sha256": digest_file(LOCK),
        },
        "source_chain": {
            "generator": "Astronomy Engine 2.1.19",
            "official_minute_crosscheck": "NAOJ 2009—2027，共456条",
            "research_auxiliary_source": "HKO（仅研究辅助核验）",
            "candidate_dataset_sha256": solar_source_hash,
        },
        "known_limitations": [
            "1969—2008及2028—2101无官方分钟级逐点核验。",
            "秒级只表示保存分辨率，不声称官方秒级准确度。",
            "V0.1不支持农历输入。",
            "V0.1不支持真太阳时。",
            "00:00日界属于产品选定流派口径，不宣称为所有流派唯一答案。",
            "节气同分钟歧义需要阻断。",
            "未知时辰遇节令切换日需要阻断。",
        ],
        "runtime_contract": {
            "read_only_static_json": True,
            "network_required": False,
            "astronomy_algorithm_at_runtime": False,
            "application_integration_completed": False,
            "page_not_implemented_remains": True,
        },
        "audit_summary": {
            "solar_term_records": 3192,
            "candidate_to_frozen_instant_match": "3192/3192",
            "official_matrix_match": "456/456",
            "regression_case_semantic_match": "63/63",
            "rules_semantic_promotion_count": 23,
            "unauthorized_semantic_changes": 0,
        },
    }
    manifest_bytes = json_bytes(manifest)
    outputs = {
        RULES_OUT: rules_bytes,
        CASES_OUT: cases_bytes,
        SOLAR_OUT: solar_bytes,
        MANIFEST_OUT: manifest_bytes,
    }
    sums = [
        f"{digest_bytes(payload)}  {path.name}"
        for path, payload in sorted(outputs.items(), key=lambda item: item[0].name)
    ]
    outputs[SUMS_OUT] = ("\n".join(sums) + "\n").encode("ascii")
    return outputs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="确定性晋级八字历法规则、案例与节气数据为V0.1.0正式冻结资产。")
    parser.add_argument("--replace-identical-freeze", action="store_true", help="仅允许逐字节一致的既有冻结文件重写。")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        outputs = build_outputs()
        expected_names = {path.name for path in outputs}
        existing_names = {path.name for path in OUTPUT.iterdir()} if OUTPUT.is_dir() else set()
        extras = existing_names - expected_names
        if extras:
            raise RuntimeError(f"正式目录含未授权文件: {sorted(extras)}")
        existing = [path for path in outputs if path.exists()]
        if existing and not args.replace_identical_freeze:
            raise RuntimeError("正式冻结文件已存在；默认禁止覆盖")
        if args.replace_identical_freeze:
            if len(existing) != len(outputs):
                raise RuntimeError("replace要求五个正式文件全部存在")
            mismatches = [path.name for path, payload in outputs.items() if path.read_bytes() != payload]
            if mismatches:
                raise RuntimeError(f"既有冻结内容不一致，禁止替换: {mismatches}")
        OUTPUT.mkdir(parents=True, exist_ok=True)
        for path, payload in outputs.items():
            path.write_bytes(payload)
    except Exception as error:
        print(f"PROMOTION_FAIL: {error}", file=sys.stderr)
        return 1
    print(f"PROMOTION_OUTPUT={OUTPUT}")
    print("RULES_PROMOTED=23")
    print("OUT_OF_SCOPE_PRESERVED=1")
    print("REGRESSION_CASES=63")
    print("SOLAR_TERM_RECORDS=3192")
    print("SOLAR_TERM_DATASET_BLOCK_REMOVED=1")
    print("PROMOTION_PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
