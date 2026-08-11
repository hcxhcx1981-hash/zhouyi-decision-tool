# -*- coding: utf-8 -*-
"""Deterministically promote the approved V0.2.0 foundation candidate.

This script uses only the Python standard library. It does not interpret or
re-enter any Bazi rule: the runtime data fields are projected from the approved
candidate verbatim.
"""

from __future__ import annotations

import hashlib
import json
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


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def project_frozen(candidate: dict[str, Any]) -> dict[str, Any]:
    """Project only the approved runtime fields from the candidate."""
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


def build_manifest(
    candidate: dict[str, Any],
    evidence: dict[str, Any],
    sources: dict[str, Any],
    frozen_rules_sha256: str,
) -> dict[str, Any]:
    source_ids = [item["source_id"] for item in sources["sources"]]
    return {
        "dataset_id": "BAZI_FOUNDATION_MANIFEST_V0_2_0",
        "version": "0.2.0",
        "status": "FROZEN",
        "tradition_scope": candidate["tradition_scope"],
        "frozen_rules_path": "data/frozen/bazi_foundation/bazi_foundation_rules_v0.2.0.json",
        "frozen_rules_sha256": frozen_rules_sha256,
        "source_candidate": "research/bazi-foundation/bazi_foundation_freeze_candidate_v0.2.0.json",
        "source_candidate_sha256": EXPECTED_CANDIDATE_SHA256,
        "research_protocol": "BAZI_FOUNDATION_RESEARCH_V0.2",
        "evidence_snapshot_id": evidence["snapshot_id"],
        "evidence_snapshot_sha256": sha256(EVIDENCE_PATH),
        "source_ids": source_ids,
        "source_count": len(source_ids),
        "approved_static_rule_count": 54,
        "stems_count": len(candidate["heavenly_stems"]),
        "branches_count": len(candidate["earthly_branches"]),
        "hidden_stem_sets_count": len(candidate["hidden_stem_sets"]),
        "generates_edges": len(candidate["five_element_relations"]["generates"]),
        "controls_edges": len(candidate["five_element_relations"]["controls"]),
        "ten_god_relation_classes": len(candidate["ten_god_formula"]),
        "ten_god_canonical_count": len(candidate["ten_god_canonical_names"]),
        "frozen_decision_scope": "STATIC_FOUNDATION_RELATIONS_ONLY",
        "frozen_scope": [
            "HEAVENLY_STEM_YIN_YANG_AND_ELEMENT",
            "EARTHLY_BRANCH_YIN_YANG_AND_ELEMENT",
            "EARTHLY_BRANCH_HIDDEN_STEM_MEMBERSHIP_SET_WITHOUT_ORDER",
            "FIVE_ELEMENT_GENERATES_AND_CONTROLS_DIRECTED_RELATIONS",
            "DAY_STEM_TO_TARGET_STEM_TEN_GOD_FORMULA",
        ],
        "excluded_scope": [
            "HIDDEN_STEM_ORDER_OR_RANK",
            "MAIN_MIDDLE_RESIDUAL_QI",
            "HIDDEN_STEM_WEIGHT_OR_MONTHLY_DAY_ALLOCATION",
            "TEN_GOD_ALIAS_AS_RUNTIME_TRUTH",
            "TEN_GOD_100_CELL_MATRIX_AS_RUNTIME_TRUTH",
            "STRENGTH_FAVORABLE_ELEMENTS_PATTERN_CLIMATE_SPIRITS_LUCK_OR_INTERPRETATION",
        ],
        "known_limitations": [
            "藏干顺序未冻结，所有hidden_stem_set的order_semantics均为NONE。",
            "本气/中气/余气未冻结。",
            "藏干权重属于OUT_OF_SCOPE。",
            "不含旺衰、喜用神或格局。",
            "tradition_scope仅为ZIPING_BAZI。",
        ],
        "runtime_integration_status": "NOT_INTEGRATED",
    }


def main() -> None:
    actual_candidate_sha = sha256(CANDIDATE_PATH)
    if actual_candidate_sha != EXPECTED_CANDIDATE_SHA256:
        raise SystemExit(
            "candidate SHA-256 mismatch: "
            f"expected {EXPECTED_CANDIDATE_SHA256}, got {actual_candidate_sha}"
        )

    candidate = load_json(CANDIDATE_PATH)
    evidence = load_json(EVIDENCE_PATH)
    sources = load_json(SOURCES_PATH)
    frozen = project_frozen(candidate)

    FROZEN_DIR.mkdir(parents=True, exist_ok=True)
    write_json(FROZEN_RULES_PATH, frozen)
    frozen_sha = sha256(FROZEN_RULES_PATH)
    manifest = build_manifest(candidate, evidence, sources, frozen_sha)
    write_json(MANIFEST_PATH, manifest)

    sums = [
        f"{sha256(FROZEN_RULES_PATH)}  {FROZEN_RULES_PATH.name}",
        f"{sha256(MANIFEST_PATH)}  {MANIFEST_PATH.name}",
    ]
    SUMS_PATH.write_text("\n".join(sums) + "\n", encoding="ascii", newline="\n")

    print(f"candidate_sha256={actual_candidate_sha}")
    print(f"frozen_rules_sha256={sha256(FROZEN_RULES_PATH)}")
    print(f"manifest_sha256={sha256(MANIFEST_PATH)}")
    print("BAZI_FOUNDATION_FREEZE_PROMOTION: PASS")


if __name__ == "__main__":
    main()
