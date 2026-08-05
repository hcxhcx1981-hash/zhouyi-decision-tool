from __future__ import annotations

import json
import subprocess
from collections import Counter
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[2]
RESEARCH = Path(__file__).resolve().parent
RULES_PATH = RESEARCH / "bazi_calendar_rules_candidate_v0.1.json"
CASES_PATH = RESEARCH / "bazi_calendar_test_cases_candidate_v0.1.json"
SOURCES_PATH = RESEARCH / "bazi_source_registry_v0.1.json"
REPORT_PATH = RESEARCH / "BAZI_CALENDAR_AND_FOUR_PILLARS_RESEARCH_V0.1.md"

REQUIRED_RULE_FIELDS = {
    "rule_id",
    "statement",
    "status",
    "source_ids",
    "confidence",
    "implementation_notes",
    "blocking_behavior",
}
ALLOWED_RULE_STATUSES = {
    "PROPOSED_FREEZE",
    "UNRESOLVED",
    "OUT_OF_SCOPE_V0_1",
    "REQUIRES_MORE_EVIDENCE",
}
ALLOWED_CONFLICT_STATUSES = ALLOWED_RULE_STATUSES
EXPECTED_CASE_STATUSES = {
    "PROPOSED_EXPECTATION",
    "BLOCKED",
    "REQUIRES_MANUAL_VERIFICATION",
}


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def walk(value: Any) -> Iterable[Any]:
    yield value
    if isinstance(value, dict):
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def collect_rules(value: Any) -> list[dict[str, Any]]:
    return [
        item
        for item in walk(value)
        if isinstance(item, dict) and "rule_id" in item
    ]


def collect_source_references(value: Any) -> set[str]:
    references: set[str] = set()
    for item in walk(value):
        if not isinstance(item, dict):
            continue
        for key in ("source_ids", "source_a_ids", "source_b_ids"):
            source_ids = item.get(key, [])
            if isinstance(source_ids, list):
                references.update(source_ids)
        source_id = item.get("source_id")
        if isinstance(source_id, str) and item.keys() == {"source_id"}:
            references.add(source_id)
    return references


def assert_git_scope() -> None:
    result = subprocess.run(
        ["git", "status", "--porcelain=v1", "-uall"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    changed = [line[3:].replace("\\", "/") for line in result.stdout.splitlines()]
    outside = [path for path in changed if not path.startswith("research/bazi/")]
    assert not outside, f"发现研究目录外改动: {outside}"


def main() -> None:
    rules = load_json(RULES_PATH)
    cases = load_json(CASES_PATH)
    registry = load_json(SOURCES_PATH)

    assert REPORT_PATH.is_file(), "研究报告缺失"
    assert rules["status"] == "RESEARCH_CANDIDATE"
    assert cases["status"] == "RESEARCH_CANDIDATE"
    assert cases["fixtures_are_anonymous"] is True

    sources = registry["sources"]
    source_ids = [source["source_id"] for source in sources]
    assert len(source_ids) == len(set(source_ids)), "来源ID重复"
    source_levels = {source["source_id"]: source["evidence_level"] for source in sources}
    assert set(source_levels.values()) <= {"L1", "L2", "L3"}

    candidate_rules = collect_rules(rules)
    assert candidate_rules, "未找到候选规则"
    rule_ids = [rule["rule_id"] for rule in candidate_rules]
    assert len(rule_ids) == len(set(rule_ids)), "规则ID重复"
    for rule in candidate_rules:
        missing = REQUIRED_RULE_FIELDS - rule.keys()
        assert not missing, f"{rule['rule_id']}缺少字段: {sorted(missing)}"
        assert rule["status"] in ALLOWED_RULE_STATUSES
        assert rule["source_ids"], f"{rule['rule_id']}没有来源"
        unknown = set(rule["source_ids"]) - set(source_ids)
        assert not unknown, f"{rule['rule_id']}引用未知来源: {sorted(unknown)}"
        if rule["status"] == "PROPOSED_FREEZE":
            levels = {source_levels[source_id] for source_id in rule["source_ids"]}
            assert levels != {"L3"}, f"{rule['rule_id']}仅由L3支持"

    conflicts = rules["unresolved_conflicts"]
    assert len(conflicts) >= 9, "冲突矩阵少于9项"
    for conflict in conflicts:
        assert conflict["recommended_status"] in ALLOWED_CONFLICT_STATUSES
        assert conflict["recommended_status"] != "ACTIVE"

    referenced_ids = collect_source_references(rules) | collect_source_references(cases)
    unknown_references = referenced_ids - set(source_ids)
    assert not unknown_references, f"存在未知来源引用: {sorted(unknown_references)}"

    test_cases = cases["cases"]
    assert len(test_cases) >= 30, "测试案例少于30"
    case_ids = [case["case_id"] for case in test_cases]
    assert len(case_ids) == len(set(case_ids)), "案例ID重复"
    for case in test_cases:
        assert case["expected_status"] in EXPECTED_CASE_STATUSES
        assert case["source_ids"], f"{case['case_id']}没有来源"
        has_pillars = "expected_pillars" in case
        has_block = "expected_blocking_code" in case
        assert has_pillars ^ has_block, f"{case['case_id']}必须且只能有一种期望"
        if has_pillars:
            assert set(case["expected_pillars"]) == {"year", "month", "day", "hour"}
        if case["expected_status"] == "REQUIRES_MANUAL_VERIFICATION":
            assert case["expected_blocking_code"] == "REQUIRES_MANUAL_VERIFICATION"

    boundary_cases = [case for case in test_cases if case["conflict_sensitive"]]
    assert boundary_cases, "没有冲突敏感案例"
    assert all(case["conflict_sensitive"] is True for case in boundary_cases)
    assert any(case["expected_blocking_code"] == "DAY_BOUNDARY_UNRESOLVED" for case in test_cases if "expected_blocking_code" in case)

    serialized_rules = json.dumps(rules, ensure_ascii=False)
    forbidden_result_keys = [
        '"personality"',
        '"wealth"',
        '"marriage"',
        '"health_prediction"',
        '"favorable_god"',
        '"luck_cycle"',
    ]
    assert not any(key in serialized_rules for key in forbidden_result_keys), "发现命理解读字段"
    assert "ACTIVE" not in {rule["status"] for rule in candidate_rules}

    assert_git_scope()

    level_counts = Counter(source_levels.values())
    status_counts = Counter(rule["status"] for rule in candidate_rules)
    print(
        "BAZI RESEARCH VALIDATION PASS: "
        f"sources L1={level_counts['L1']} L2={level_counts['L2']} L3={level_counts['L3']}; "
        f"rules={len(candidate_rules)} proposed={status_counts['PROPOSED_FREEZE']} "
        f"unresolved={status_counts['UNRESOLVED']}; conflicts={len(conflicts)}; "
        f"cases={len(test_cases)}."
    )


if __name__ == "__main__":
    main()
