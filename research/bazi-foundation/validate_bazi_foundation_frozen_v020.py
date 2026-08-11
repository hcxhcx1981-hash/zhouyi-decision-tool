# -*- coding: utf-8 -*-
"""Validate the Bazi foundation V0.2.0 frozen release using stdlib only.

Truth flow: approved research candidate -> deterministic projection -> frozen
rules. This validator intentionally does not contain a second complete stem,
branch, hidden-stem, five-element, or 100-cell ten-god truth table.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
RESEARCH_DIR = ROOT / "research" / "bazi-foundation"
FROZEN_DIR = ROOT / "data" / "frozen" / "bazi_foundation"
CANDIDATE_PATH = RESEARCH_DIR / "bazi_foundation_freeze_candidate_v0.2.0.json"
EVIDENCE_PATH = RESEARCH_DIR / "evidence_snapshot_v0.2.0.json"
SOURCES_PATH = RESEARCH_DIR / "sources.json"
FROZEN_RULES_PATH = FROZEN_DIR / "bazi_foundation_rules_v0.2.0.json"
MANIFEST_PATH = FROZEN_DIR / "BAZI_FOUNDATION_MANIFEST_V0.2.0.json"
SUMS_PATH = FROZEN_DIR / "SHA256SUMS.txt"

EXPECTED_CANDIDATE_SHA256 = (
    "8b180184d34e613173342a71b420942305816831d383607474e4e27d50a27add"
)
RESULTS: list[tuple[str, bool, str]] = []


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def check(name: str, condition: bool, detail: str = "") -> None:
    ok = bool(condition)
    RESULTS.append((name, ok, detail))
    suffix = f" — {detail}" if detail else ""
    print(f"[{'PASS' if ok else 'FAIL'}] {name}{suffix}")


def project_frozen(candidate: dict[str, Any]) -> dict[str, Any]:
    return {
        "dataset_id": "BAZI_FOUNDATION_RULES_V0_2_0",
        "version": candidate["version"],
        "status": "FROZEN_RUNTIME_DATA",
        "tradition_scope": candidate["tradition_scope"],
        "heavenly_stems": candidate["heavenly_stems"],
        "earthly_branches": candidate["earthly_branches"],
        "hidden_stem_sets": candidate["hidden_stem_sets"],
        "five_element_relations": candidate["five_element_relations"],
        "ten_god_formula": candidate["ten_god_formula"],
        "ten_god_canonical_names": candidate["ten_god_canonical_names"],
    }


def collect_keys(value: Any) -> set[str]:
    keys: set[str] = set()
    if isinstance(value, dict):
        for key, child in value.items():
            keys.add(key)
            keys.update(collect_keys(child))
    elif isinstance(value, list):
        for child in value:
            keys.update(collect_keys(child))
    return keys


def main() -> int:
    required_paths = [
        CANDIDATE_PATH,
        EVIDENCE_PATH,
        SOURCES_PATH,
        FROZEN_RULES_PATH,
        MANIFEST_PATH,
        SUMS_PATH,
    ]
    check("所需文件存在", all(path.is_file() for path in required_paths))
    if not all(path.is_file() for path in required_paths):
        return finish()

    parsed: dict[Path, dict[str, Any]] = {}
    parse_ok = True
    for path in required_paths[:-1]:
        try:
            parsed[path] = load_json(path)
        except (OSError, json.JSONDecodeError) as exc:
            parse_ok = False
            print(f"[FAIL] JSON合法: {path.name} — {exc}")
    check("Candidate/Frozen/Manifest/Evidence JSON合法", parse_ok)
    if not parse_ok:
        return finish()

    candidate = parsed[CANDIDATE_PATH]
    evidence = parsed[EVIDENCE_PATH]
    sources = parsed[SOURCES_PATH]
    frozen = parsed[FROZEN_RULES_PATH]
    manifest = parsed[MANIFEST_PATH]

    candidate_sha = sha256(CANDIDATE_PATH)
    check("Candidate SHA-256固定正确", candidate_sha == EXPECTED_CANDIDATE_SHA256, candidate_sha)
    check(
        "Frozen元数据正确",
        frozen.get("dataset_id") == "BAZI_FOUNDATION_RULES_V0_2_0"
        and frozen.get("version") == "0.2.0"
        and frozen.get("status") == "FROZEN_RUNTIME_DATA",
    )
    check(
        "Manifest元数据正确",
        manifest.get("dataset_id") == "BAZI_FOUNDATION_MANIFEST_V0_2_0"
        and manifest.get("version") == "0.2.0"
        and manifest.get("status") == "FROZEN",
    )
    check(
        "tradition_scope = ZIPING_BAZI",
        candidate.get("tradition_scope") == frozen.get("tradition_scope")
        == manifest.get("tradition_scope") == "ZIPING_BAZI",
    )

    stems = frozen.get("heavenly_stems", [])
    branches = frozen.get("earthly_branches", [])
    hidden_sets = frozen.get("hidden_stem_sets", [])
    stem_ids = [item.get("stem_id") for item in stems]
    branch_ids = [item.get("branch_id") for item in branches]
    check("10 stems完整唯一", len(stems) == len(set(stem_ids)) == 10)
    check("12 branches完整唯一", len(branches) == len(set(branch_ids)) == 12)
    check(
        "stem字段最小且枚举结构合法",
        all(
            set(item) == {"stem_id", "chinese", "yin_yang", "element"}
            and item["yin_yang"] in {"YIN", "YANG"}
            for item in stems
        ),
    )
    check(
        "branch字段最小且枚举结构合法",
        all(
            set(item) == {"branch_id", "chinese", "yin_yang", "element"}
            and item["yin_yang"] in {"YIN", "YANG"}
            for item in branches
        ),
    )
    hidden_branch_ids = [item.get("branch_id") for item in hidden_sets]
    check(
        "12 hidden stem sets且每支唯一",
        len(hidden_sets) == len(set(hidden_branch_ids)) == 12
        and set(hidden_branch_ids) == set(branch_ids),
    )
    check(
        "藏干全部属于10 stems且集合内唯一",
        all(
            item.get("hidden_stem_set")
            and len(item["hidden_stem_set"]) == len(set(item["hidden_stem_set"]))
            and set(item["hidden_stem_set"]) <= set(stem_ids)
            for item in hidden_sets
        ),
    )
    check(
        "order_semantics全部NONE",
        all(item.get("order_semantics") == "NONE" for item in hidden_sets),
    )

    frozen_keys = collect_keys(frozen)
    legacy_hidden = {"main_hidden_stem", "other_hidden_stems", "ordered_hidden_stems"}
    check("Frozen无main/other/ordered hidden stems", not (legacy_hidden & frozen_keys))
    qi_keys = {"main_qi", "middle_qi", "residual_qi", "本气", "中气", "余气"}
    check("Frozen无本气/中气/余气字段", not (qi_keys & frozen_keys))
    check("Frozen无weight字段", not any("weight" in key.lower() for key in frozen_keys))

    relations = frozen.get("five_element_relations", {})
    generates = relations.get("generates", [])
    controls = relations.get("controls", [])
    gen_pairs = [(edge.get("from"), edge.get("to")) for edge in generates]
    ctl_pairs = [(edge.get("from"), edge.get("to")) for edge in controls]
    check(
        "generates = 5条完整有向关系",
        len(generates) == len(set(gen_pairs)) == 5
        and len({a for a, _ in gen_pairs}) == len({b for _, b in gen_pairs}) == 5,
    )
    check(
        "controls = 5条完整有向关系",
        len(controls) == len(set(ctl_pairs)) == 5
        and len({a for a, _ in ctl_pairs}) == len({b for _, b in ctl_pairs}) == 5,
    )

    formula = frozen.get("ten_god_formula", {})
    polarity_keys = {"SAME_POLARITY", "DIFFERENT_POLARITY"}
    formula_shape = len(formula) == 5 and all(set(pair) == polarity_keys for pair in formula.values())
    formula_values = [name for pair in formula.values() for name in pair.values()] if formula_shape else []
    canonical = frozen.get("ten_god_canonical_names", [])
    check("十神formula = 5×2", formula_shape and len(formula_values) == 10)
    check(
        "十神canonical = 10且与formula一致",
        len(canonical) == len(set(canonical)) == 10 and set(canonical) == set(formula_values),
    )

    stem_element = {item["stem_id"]: item["element"] for item in stems}
    stem_polarity = {item["stem_id"]: item["yin_yang"] for item in stems}
    gen_map = {edge["from"]: edge["to"] for edge in generates}
    ctl_map = {edge["from"]: edge["to"] for edge in controls}
    matrix: list[list[str]] = []
    classification_ok = formula_shape and len(gen_map) == len(ctl_map) == 5
    if classification_ok:
        for day in stem_ids:
            row: list[str] = []
            for target in stem_ids:
                day_el, target_el = stem_element[day], stem_element[target]
                matches = []
                if day_el == target_el:
                    matches.append("SAME_ELEMENT")
                if gen_map.get(day_el) == target_el:
                    matches.append("DAY_GENERATES_TARGET")
                if ctl_map.get(day_el) == target_el:
                    matches.append("DAY_CONTROLS_TARGET")
                if ctl_map.get(target_el) == day_el:
                    matches.append("TARGET_CONTROLS_DAY")
                if gen_map.get(target_el) == day_el:
                    matches.append("TARGET_GENERATES_DAY")
                if len(matches) != 1 or matches[0] not in formula:
                    classification_ok = False
                    break
                polarity = (
                    "SAME_POLARITY"
                    if stem_polarity[day] == stem_polarity[target]
                    else "DIFFERENT_POLARITY"
                )
                row.append(formula[matches[0]][polarity])
            matrix.append(row)
    check(
        "由Frozen数据重建10×10矩阵100/100",
        classification_ok and len(matrix) == 10 and sum(map(len, matrix)) == 100,
    )
    check(
        "每行十神10类各一次",
        classification_ok and all(len(row) == len(set(row)) == 10 for row in matrix),
    )

    wu_entry = next((item for item in hidden_sets if item.get("branch_id") == "WU"), None)
    check(
        "午支正式值为{DING,JI}",
        wu_entry is not None and set(wu_entry.get("hidden_stem_set", [])) == {"DING", "JI"},
    )
    check(
        "Frozen不保存100格matrix",
        not any("matrix" in key.lower() for key in frozen_keys),
    )
    check("Frozen不保存alias runtime真相", not any("alias" in key.lower() for key in frozen_keys))
    interpretive_tokens = {
        "strength", "favorable", "useful_god", "pattern", "climate",
        "spirit", "luck", "interpretation", "旺衰", "喜用神", "格局",
    }
    check(
        "Frozen无旺衰/喜用神/格局等字段",
        not any(key.lower() in interpretive_tokens for key in frozen_keys),
    )

    expected_frozen = project_frozen(candidate)
    check("Frozen与candidate确定性投影逐字段一致", frozen == expected_frozen)

    expected_counts = {
        "source_count": len(sources.get("sources", [])),
        "approved_static_rule_count": (
            len(stems) + len(branches) + len(hidden_sets)
            + len(generates) + len(controls) + len(formula_values)
        ),
        "stems_count": len(stems),
        "branches_count": len(branches),
        "hidden_stem_sets_count": len(hidden_sets),
        "generates_edges": len(generates),
        "controls_edges": len(controls),
        "ten_god_relation_classes": len(formula),
        "ten_god_canonical_count": len(canonical),
    }
    check(
        "Manifest counts重算正确",
        all(manifest.get(key) == value for key, value in expected_counts.items())
        and expected_counts["approved_static_rule_count"] == 54,
    )
    check(
        "Manifest Frozen SHA正确",
        manifest.get("frozen_rules_sha256") == sha256(FROZEN_RULES_PATH),
    )
    check(
        "Manifest candidate/evidence追踪正确",
        manifest.get("source_candidate_sha256") == candidate_sha
        and manifest.get("evidence_snapshot_id") == evidence.get("snapshot_id")
        and manifest.get("evidence_snapshot_sha256") == sha256(EVIDENCE_PATH),
    )
    source_ids = [item.get("source_id") for item in sources.get("sources", [])]
    check(
        "Manifest来源追踪8项一致",
        len(source_ids) == len(set(source_ids)) == 8
        and manifest.get("source_ids") == source_ids,
    )

    listed: dict[str, str] = {}
    sums_ok = True
    try:
        for line in SUMS_PATH.read_text(encoding="ascii").splitlines():
            digest, name = line.split("  ", 1)
            listed[name] = digest
    except (OSError, ValueError):
        sums_ok = False
    expected_sum_files = {FROZEN_RULES_PATH.name, MANIFEST_PATH.name}
    sums_ok = sums_ok and set(listed) == expected_sum_files
    for name, digest in listed.items():
        path = FROZEN_DIR / name
        sums_ok = sums_ok and path.is_file() and sha256(path) == digest
    check("SHA256SUMS全部正确", sums_ok)
    allowed_files = expected_sum_files | {SUMS_PATH.name}
    actual_files = {path.name for path in FROZEN_DIR.iterdir() if path.is_file()}
    check("正式目录无未知文件", actual_files == allowed_files)

    return finish()


def finish() -> int:
    passed = sum(ok for _, ok, _ in RESULTS)
    failed = len(RESULTS) - passed
    print(f"\nRESULT: {passed} PASS / {failed} FAIL")
    if failed:
        print("BAZI_FOUNDATION_FROZEN_V020_VALIDATION: FAIL")
        return 1
    print("BAZI_FOUNDATION_FROZEN_V020_VALIDATION: ALL PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
