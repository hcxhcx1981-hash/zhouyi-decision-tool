#!/usr/bin/env python3
"""Validate the Bazi SAFE Interpretation Protocol frozen release (stdlib only)."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

sys.dont_write_bytecode = True


ROOT = Path(__file__).resolve().parents[2]
RESEARCH = ROOT / "research" / "bazi-interpretation"
FROZEN = ROOT / "data" / "frozen" / "bazi_interpretation"
PROTOCOL_PATH = FROZEN / "bazi_interpretation_protocol_v0.1.0.json"
MANIFEST_PATH = FROZEN / "BAZI_INTERPRETATION_MANIFEST_V0.1.0.json"
SUMS_PATH = FROZEN / "SHA256SUMS.txt"

EXPECTED_TEXT = {
    "日主": "可以把日主理解为这张命盘进行十神关系分析时的核心参照点。",
    "七杀": "传统子平会从对日主形成克制、以及是否得到适当制化的角度观察七杀。",
    "伤官": "传统子平会从才艺、秀气等主题观察伤官。",
    "正官": "传统子平会从贵气、尊位等主题观察正官。",
    "正印": "传统子平把印绶视为生助日主的一类关系。",
    "食神": "传统子平常从食禄以及生财关系观察食神。",
    "正财": "传统子平把正财归入财帛关系进行观察。",
}
EXPECTED_TOPICS = {
    "日主": ["中心参照"], "七杀": ["攻身", "制伏（制化）关系"], "伤官": ["才艺", "秀气"],
    "正官": ["贵气", "尊位"], "正印": ["生身关系"], "食神": ["食禄", "生财关系"], "正财": ["财帛关系"],
}
DIRECT_PHRASES = [
    "你天生", "注定", "一生", "必定", "命中注定", "婚姻不顺", "必有横财", "晚年富贵",
    "事业一定成功", "容易离婚", "克父克母", "子女不孝",
]


class Checks:
    def __init__(self) -> None:
        self.total = 0
        self.failures: list[str] = []

    def check(self, condition: bool, label: str) -> None:
        self.total += 1
        if condition:
            print(f"PASS {self.total:02d}: {label}")
        else:
            self.failures.append(label)
            print(f"FAIL {self.total:02d}: {label}")


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    c = Checks()
    c.check(all(path.is_file() for path in (PROTOCOL_PATH, MANIFEST_PATH, SUMS_PATH)), "Frozen 三个正式文件存在")
    try:
        protocol, manifest = load(PROTOCOL_PATH), load(MANIFEST_PATH)
    except Exception as exc:
        print(f"FAIL: JSON读取失败: {exc}")
        return 1

    c.check(protocol.get("status") == "FROZEN_RUNTIME_DATA", "Frozen status正确")
    c.check(protocol.get("tradition_scope") == "ZIPING_BAZI", "tradition_scope正确")
    glosses = protocol.get("safe_glosses", [])
    by_term = {item.get("canonical_term"): item for item in glosses}
    c.check(len(glosses) == 7 and set(by_term) == set(EXPECTED_TEXT), "SAFE_GLOSS恰好7条")
    c.check(by_term.get("日主", {}).get("standard_expression") == "日主（日干）是子平八字分析的中心参照。", "日主标准表达正确")
    for term in ["日主", "七杀", "伤官", "正官", "正印", "食神", "正财"]:
        item = by_term.get(term, {})
        c.check(item.get("plain_language") == EXPECTED_TEXT[term], f"{term}正式白话精确")
        c.check(item.get("allowed_topics") == EXPECTED_TOPICS[term], f"{term}允许主题精确")
        c.check(bool(item.get("source_ids")), f"{term}保留source_id证据链")

    fact_only = {item.get("canonical_term"): item for item in protocol.get("fact_only_terms", [])}
    for term in ["比肩", "劫财", "偏财", "偏印"]:
        c.check(fact_only.get(term, {}).get("gate") == "FACT_ONLY" and not fact_only.get(term, {}).get("safe_gloss_available"), f"{term}仅FACT_ONLY且无SAFE主题")

    gates = protocol.get("interpretation_gates", {})
    c.check(set(gates) == {"FACT_ONLY", "SAFE_SEMANTIC_GLOSS", "CONTEXT_REQUIRED", "PROHIBITED_DIRECT_INFERENCE"}, "解释Gate恰好四项")
    count_policy = protocol.get("count_policy", {})
    c.check(count_policy.get("policy_id") == "COUNT_ONLY_IS_NOT_INTERPRETATION" and count_policy.get("gate") == "FACT_ONLY", "数量规则仅FACT_ONLY")
    c.check(count_policy.get("applies_to") == "ALL_TEN_GODS", "数量规则适用于全部十神")
    visible = protocol.get("visible_hidden_policy", {})
    expected_visible = ["该十神出现在天干", "该十神仅存在于地支藏干", "该十神同时存在于天干与藏干"]
    c.check(visible.get("gate") == "FACT_ONLY" and visible.get("allowed_statements") == expected_visible, "透干藏干只允许事实关系")
    c.check(visible.get("case_i11") == {"case_id": "CASE-I11", "status": "FACT_ONLY"}, "CASE-I11已收口为FACT_ONLY")
    blocked_visible = " ".join(visible.get("prohibited_interpretations", []))
    c.check(all(word in blocked_visible for word in ["更强", "更重要", "更直接", "更弱", "更有力"]), "透干藏干解释性比较全部阻断")

    prohibited = protocol.get("prohibited_direct_inferences", [])
    prohibited_text = [item.get("text") for item in prohibited]
    c.check(all(text in prohibited_text for text in DIRECT_PHRASES), "12条直接禁语完整")
    c.check(len([item for item in prohibited if item.get("category") == "SINGLE_TEN_GOD_LIFE_INFERENCE"]) == 8, "8条单十神人生断语完整")
    c.check(len(prohibited) == 20, "正式禁语总数20")

    c.check(set(protocol.get("context_required_topics", [])) == {"旺衰", "月令", "通根", "生扶克泄", "格局", "制化", "位置", "全局组合"}, "CONTEXT_REQUIRED主题边界完整")
    serialized = json.dumps(protocol, ensure_ascii=False)
    c.check(not any(key in protocol for key in ["strength_algorithm", "yongshen_algorithm", "pattern_algorithm", "dayun_algorithm", "liunian_algorithm"]), "无旺衰喜用神格局大运流年算法")
    c.check(not any(key in serialized for key in ["birth_name", "identity_card", "phone_number", "user_profile"]), "无用户真实资料字段")
    c.check("short_excerpt" not in serialized and "source_evidence" not in serialized and "http://" not in serialized and "https://" not in serialized, "Frozen不保存古籍摘录或网页内容")
    provenance = protocol.get("provenance", {})
    c.check(provenance.get("candidate_sha256") == sha(RESEARCH / "safe_gloss_evidence_v0.1.json"), "candidate SHA证据链正确")
    c.check(provenance.get("research_source_sha256") == sha(RESEARCH / "sources.json"), "research source SHA证据链正确")

    counts = manifest.get("counts", {})
    c.check(counts == {"safe_glosses": 7, "fact_only_terms_without_safe_gloss": 4, "interpretation_gates": 4, "prohibited_direct_inferences": 20, "visible_hidden_allowed_statements": 3}, "Manifest counts正确")
    files = manifest.get("files", [])
    c.check(len(files) == 1 and files[0].get("sha256") == sha(PROTOCOL_PATH) and files[0].get("bytes") == PROTOCOL_PATH.stat().st_size, "Manifest文件哈希与大小正确")
    expected_sums = f"{sha(PROTOCOL_PATH)}  {PROTOCOL_PATH.name}\n{sha(MANIFEST_PATH)}  {MANIFEST_PATH.name}\n"
    c.check(SUMS_PATH.read_text(encoding="ascii") == expected_sums, "SHA256SUMS正确")

    spec = importlib.util.spec_from_file_location("freeze_builder", RESEARCH / "build_bazi_interpretation_freeze_v010.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load generator")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with tempfile.TemporaryDirectory(prefix="bazi-interpretation-freeze-") as temp:
        a, b = Path(temp) / "run-a", Path(temp) / "run-b"
        module.generate(a)
        module.generate(b)
        names = [PROTOCOL_PATH.name, MANIFEST_PATH.name, SUMS_PATH.name]
        c.check(all((a / name).read_bytes() == (b / name).read_bytes() for name in names), "双次生成字节一致")
        c.check(all((a / name).read_bytes() == (FROZEN / name).read_bytes() for name in names), "重复生成与正式Frozen字节一致")

    research_result = subprocess.run(
        [sys.executable, str(RESEARCH / "validate_bazi_interpretation_research_v01.py")],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    c.check(research_result.returncode == 0 and "PASS" in research_result.stdout, "现有research validator仍PASS")

    if c.failures:
        print(f"RESULT: FAIL ({c.total - len(c.failures)}/{c.total} PASS)")
        return 1
    print(f"RESULT: PASS ({c.total}/{c.total})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
