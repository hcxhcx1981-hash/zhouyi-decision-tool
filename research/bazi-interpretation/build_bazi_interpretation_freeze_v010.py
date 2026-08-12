#!/usr/bin/env python3
"""Deterministically project the approved SAFE interpretation policy to Frozen JSON."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
RESEARCH_DIR = ROOT / "research" / "bazi-interpretation"
DEFAULT_OUTPUT_DIR = ROOT / "data" / "frozen" / "bazi_interpretation"

PROTOCOL_NAME = "bazi_interpretation_protocol_v0.1.0.json"
MANIFEST_NAME = "BAZI_INTERPRETATION_MANIFEST_V0.1.0.json"
SUMS_NAME = "SHA256SUMS.txt"

FREEZE_POLICY_V0_1: dict[str, Any] = {
    "safe_glosses": [
        {
            "semantic_id": "SAFE-GLOSS-DAY-MASTER",
            "canonical_term": "日主",
            "standard_expression": "日主（日干）是子平八字分析的中心参照。",
            "plain_language": "可以把日主理解为这张命盘进行十神关系分析时的核心参照点。",
            "allowed_topics": ["中心参照"],
        },
        {
            "semantic_id": "SAFE-GLOSS-QISHA",
            "canonical_term": "七杀",
            "plain_language": "传统子平会从对日主形成克制、以及是否得到适当制化的角度观察七杀。",
            "allowed_topics": ["攻身", "制伏（制化）关系"],
        },
        {
            "semantic_id": "SAFE-GLOSS-SHANGGUAN",
            "canonical_term": "伤官",
            "plain_language": "传统子平会从才艺、秀气等主题观察伤官。",
            "allowed_topics": ["才艺", "秀气"],
        },
        {
            "semantic_id": "SAFE-GLOSS-ZHENGGUAN",
            "canonical_term": "正官",
            "plain_language": "传统子平会从贵气、尊位等主题观察正官。",
            "allowed_topics": ["贵气", "尊位"],
        },
        {
            "semantic_id": "SAFE-GLOSS-ZHENGYIN",
            "canonical_term": "正印",
            "plain_language": "传统子平把印绶视为生助日主的一类关系。",
            "allowed_topics": ["生身关系"],
        },
        {
            "semantic_id": "SAFE-GLOSS-SHISHEN",
            "canonical_term": "食神",
            "plain_language": "传统子平常从食禄以及生财关系观察食神。",
            "allowed_topics": ["食禄", "生财关系"],
        },
        {
            "semantic_id": "SAFE-GLOSS-ZHENGCAI",
            "canonical_term": "正财",
            "plain_language": "传统子平把正财归入财帛关系进行观察。",
            "allowed_topics": ["财帛关系"],
        },
    ],
    "fact_only_terms": ["比肩", "劫财", "偏财", "偏印"],
    "direct_phrases": [
        "你天生", "注定", "一生", "必定", "命中注定", "婚姻不顺",
        "必有横财", "晚年富贵", "事业一定成功", "容易离婚", "克父克母", "子女不孝",
    ],
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def encode_json(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def source_ids_for(item: dict[str, Any]) -> list[str]:
    return [entry["source_id"] for entry in item["source_evidence"]]


def build_documents() -> tuple[bytes, bytes, bytes]:
    candidate_path = RESEARCH_DIR / "safe_gloss_evidence_v0.1.json"
    sources_path = RESEARCH_DIR / "sources.json"
    prohibited_path = RESEARCH_DIR / "prohibited_inferences.json"
    visible_hidden_path = RESEARCH_DIR / "visible_hidden_semantics.json"
    gates_path = RESEARCH_DIR / "interpretation_gates.json"

    candidate = read_json(candidate_path)
    sources = read_json(sources_path)
    prohibited = read_json(prohibited_path)
    registered_sources = {item["source_id"] for item in sources["sources"]}
    candidates = {item["canonical_term"]: item for item in candidate["safe_gloss_items"]}

    projected_glosses: list[dict[str, Any]] = []
    for approved in FREEZE_POLICY_V0_1["safe_glosses"]:
        term = approved["canonical_term"]
        if term not in candidates:
            raise ValueError(f"approved term missing from research candidate: {term}")
        ids = source_ids_for(candidates[term])
        if not ids or not set(ids).issubset(registered_sources):
            raise ValueError(f"invalid source trace for approved term: {term}")
        projected_glosses.append({**approved, "gate": "SAFE_SEMANTIC_GLOSS", "source_ids": ids})

    research_claims = [item["claim"] for item in prohibited["structural_counterexamples"]]
    direct_inferences = [
        *[{"text": text, "category": "DIRECT_LANGUAGE"} for text in FREEZE_POLICY_V0_1["direct_phrases"]],
        *[{"text": text, "category": "SINGLE_TEN_GOD_LIFE_INFERENCE"} for text in research_claims],
    ]

    provenance_files = [candidate_path, sources_path, prohibited_path, visible_hidden_path, gates_path]
    protocol = {
        "schema_version": "0.1.0",
        "version": "0.1.0",
        "status": "FROZEN_RUNTIME_DATA",
        "tradition_scope": "ZIPING_BAZI",
        "safe_glosses": projected_glosses,
        "fact_only_terms": [
            {
                "canonical_term": term,
                "gate": "FACT_ONLY",
                "allowed": "仅显示 Foundation 已冻结的生克阴阳结构分类依据。",
                "safe_gloss_available": False,
            }
            for term in FREEZE_POLICY_V0_1["fact_only_terms"]
        ],
        "interpretation_gates": {
            "FACT_ONLY": "可以直接显示确定结构事实。",
            "SAFE_SEMANTIC_GLOSS": "只能使用本协议正式冻结的 safe gloss。",
            "CONTEXT_REQUIRED": "只允许提示需要更多传统规则后才能进一步判断，不得输出结论。",
            "PROHIBITED_DIRECT_INFERENCE": "禁止生成。",
        },
        "count_policy": {
            "policy_id": "COUNT_ONLY_IS_NOT_INTERPRETATION",
            "gate": "FACT_ONLY",
            "allowed_example": "命盘中有两个可见七杀关系。",
            "prohibited_modifiers": ["重", "旺", "压力大", "杀气重", "事业心强"],
            "applies_to": "ALL_TEN_GODS",
        },
        "visible_hidden_policy": {
            "gate": "FACT_ONLY",
            "allowed_statements": [
                "该十神出现在天干",
                "该十神仅存在于地支藏干",
                "该十神同时存在于天干与藏干",
            ],
            "prohibited_interpretations": [
                "透干更重要", "透干力量更强", "透干意义更直接", "藏干力量更弱", "深根更有力",
            ],
            "deferred_gate": ["TRADITION_POLICY_REQUIRED", "CONTEXT_REQUIRED"],
            "case_i11": {"case_id": "CASE-I11", "status": "FACT_ONLY"},
        },
        "prohibited_direct_inferences": direct_inferences,
        "context_required_topics": [
            "旺衰", "月令", "通根", "生扶克泄", "格局", "制化", "位置", "全局组合",
        ],
        "known_limitations": [
            "不是个人命理解读。",
            "不提供旺衰、喜用神、格局、大运或流年判断。",
            "不根据单一十神、数量、透干或藏干推断性格、事件、吉凶或人生结果。",
        ],
        "provenance": {
            "projection_policy": "CHATGPT_APPROVED_FREEZE_POLICY_V0_1",
            "research_files_sha256": {
                path.name: sha256_bytes(path.read_bytes()) for path in provenance_files
            },
            "candidate_sha256": sha256_bytes(candidate_path.read_bytes()),
            "research_source_sha256": sha256_bytes(sources_path.read_bytes()),
        },
    }
    protocol_bytes = encode_json(protocol)

    manifest = {
        "schema_version": "0.1.0",
        "release_id": "BAZI_INTERPRETATION_V0.1.0",
        "version": "0.1.0",
        "status": "FROZEN_RUNTIME_DATA",
        "tradition_scope": "ZIPING_BAZI",
        "generator": "research/bazi-interpretation/build_bazi_interpretation_freeze_v010.py",
        "files": [{"path": PROTOCOL_NAME, "sha256": sha256_bytes(protocol_bytes), "bytes": len(protocol_bytes)}],
        "counts": {
            "safe_glosses": 7,
            "fact_only_terms_without_safe_gloss": 4,
            "interpretation_gates": 4,
            "prohibited_direct_inferences": len(direct_inferences),
            "visible_hidden_allowed_statements": 3,
        },
        "provenance": protocol["provenance"],
    }
    manifest_bytes = encode_json(manifest)
    sums_bytes = (
        f"{sha256_bytes(protocol_bytes)}  {PROTOCOL_NAME}\n"
        f"{sha256_bytes(manifest_bytes)}  {MANIFEST_NAME}\n"
    ).encode("ascii")
    return protocol_bytes, manifest_bytes, sums_bytes


def generate(output_dir: Path) -> None:
    protocol_bytes, manifest_bytes, sums_bytes = build_documents()
    output_dir.mkdir(parents=True, exist_ok=True)
    for name, data in ((PROTOCOL_NAME, protocol_bytes), (MANIFEST_NAME, manifest_bytes), (SUMS_NAME, sums_bytes)):
        (output_dir / name).write_bytes(data)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args()
    generate(args.output_dir.resolve())
    print(f"PASS: generated 3 frozen files in {args.output_dir.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
