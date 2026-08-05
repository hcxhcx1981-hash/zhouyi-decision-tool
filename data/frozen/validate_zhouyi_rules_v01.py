#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

BASE = Path(__file__).resolve().parent
RULES_PATH = BASE / "zhouyi_divination_rules_v0.1.json"
TESTS_PATH = BASE / "zhouyi_rule_test_cases_v0.1.json"


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def validate_values(values: Any) -> list[int]:
    if not isinstance(values, list) or len(values) != 6:
        raise ValueError("INVALID_LENGTH")
    if any(v not in (6, 7, 8, 9) for v in values):
        raise ValueError("INVALID_VALUE")
    return values


def analyze(values: list[int]) -> dict[str, Any]:
    values = validate_values(values)
    moving = [i + 1 for i, v in enumerate(values) if v in (6, 9)]
    nonmoving = [i + 1 for i, v in enumerate(values) if v in (7, 8)]
    original_bits = [0 if v in (6, 8) else 1 for v in values]
    changed_bits = [1 if v == 6 else 0 if v == 9 else b for v, b in zip(values, original_bits)]
    count = len(moving)

    result: dict[str, Any] = {
        "moving_count": count,
        "moving_positions": moving,
        "nonmoving_positions": nonmoving,
        "original_bits_bottom_to_top": original_bits,
        "changed_bits_bottom_to_top": changed_bits,
    }

    if count == 0:
        result.update(rule_id="M0_ORIGINAL_TUANCI", automatic_decision=True,
                      primary_hexagram="original", text_selector="tuan_ci_bundle")
    elif count == 1:
        result.update(rule_id="M1_ORIGINAL_MOVING_LINE", automatic_decision=True,
                      primary_hexagram="original", primary_positions=moving)
    elif count == 2:
        result.update(rule_id="M2_TWO_ORIGINAL_MOVING_LINES", automatic_decision=True,
                      primary_hexagram="original", primary_positions=[max(moving)],
                      secondary_positions=[min(moving)])
    elif count == 3:
        result.update(rule_id="M3_ORIGINAL_AND_CHANGED_TUANCI",
                      automatic_decision=False, blocked=True)
    elif count == 4:
        result.update(rule_id="M4_TWO_UNCHANGED_LINES_IN_CHANGED",
                      automatic_decision=True, primary_hexagram="changed",
                      primary_positions=[min(nonmoving)],
                      secondary_positions=[max(nonmoving)])
    elif count == 5:
        result.update(rule_id="M5_ONE_UNCHANGED_LINE_IN_CHANGED",
                      automatic_decision=True, primary_hexagram="changed",
                      primary_positions=nonmoving)
    else:
        result.update(rule_id="M6_ALL_MOVING", automatic_decision=True)
        if all(v == 9 for v in values):
            result.update(primary_hexagram="original", special_line="用九")
        elif all(v == 6 for v in values):
            result.update(primary_hexagram="original", special_line="用六")
        else:
            result.update(primary_hexagram="changed", special_line=None,
                          text_selector="tuan_ci_bundle")
    return result


def compare_expected(actual: dict[str, Any], expected: dict[str, Any]) -> list[str]:
    return [
        f"{key}: expected={value!r}, actual={actual.get(key)!r}"
        for key, value in expected.items()
        if actual.get(key) != value
    ]


def validate_rules(rules: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if rules.get("protocol_id") != "ZHOUYI_DIVINATION_PROTOCOL_V0_1":
        errors.append("protocol_id错误")
    selection = rules.get("selection_rules", [])
    if len(selection) != 7:
        errors.append("selection_rules必须覆盖0至6动爻")
    counts = sorted(r.get("moving_count") for r in selection)
    if counts != list(range(7)):
        errors.append(f"动爻规则覆盖错误: {counts}")
    m3 = next((r for r in selection if r.get("moving_count") == 3), None)
    if not m3 or m3.get("automatic_decision") is not False:
        errors.append("三爻动必须阻断自动主次裁决")
    allowed = rules.get("input_contract", {}).get("yao_values", {}).get("allowed_values")
    if allowed != [6, 7, 8, 9]:
        errors.append("允许值必须为6/7/8/9")
    order = rules.get("input_contract", {}).get("yao_values", {}).get("order")
    if order != "bottom_to_top":
        errors.append("爻序必须为bottom_to_top")
    return errors


def main() -> int:
    try:
        rules = load_json(RULES_PATH)
        tests = load_json(TESTS_PATH)
    except Exception as exc:
        print(f"[FAIL] 文件读取失败: {exc}")
        return 1

    failures: list[str] = validate_rules(rules)

    for case in tests.get("cases", []):
        case_id = case["id"]
        try:
            actual = analyze(case["yao_values"])
            if "expected_error" in case:
                failures.append(f"{case_id}: 预期错误 {case['expected_error']}，实际成功")
                continue
            for error in compare_expected(actual, case["expected"]):
                failures.append(f"{case_id}: {error}")
        except ValueError as exc:
            expected_error = case.get("expected_error")
            if str(exc) != expected_error:
                failures.append(
                    f"{case_id}: expected_error={expected_error}, actual={exc}"
                )

    if failures:
        print(f"[FAIL] 验证失败，共{len(failures)}项")
        for item in failures:
            print(" -", item)
        return 1

    print(f"[PASS] 规则结构 + {len(tests['cases'])}个回归案例全部通过")
    print("[PASS] 三爻动保持自动裁决阻断")
    print("[PASS] 6/7/8/9、本卦/之卦、0至6动爻取辞逻辑一致")
    return 0


if __name__ == "__main__":
    sys.exit(main())
