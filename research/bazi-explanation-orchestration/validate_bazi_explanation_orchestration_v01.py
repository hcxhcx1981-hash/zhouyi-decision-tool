from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PACKAGE = Path(__file__).resolve().parent

EXPECTED_FILES = {
    "explanation_protocol_v0.1.0.json",
    "section_schema_v0.1.0.json",
    "wording_policy_v0.1.0.json",
    "boundary_rules_v0.1.0.json",
    "validate_bazi_explanation_orchestration_v01.py",
}
EXPECTED_SOURCES = {
    "BAZI_CHART_RUNTIME",
    "FOUNDATION_FROZEN_RUNTIME",
    "SAFE_INTERPRETATION_RUNTIME",
    "STRENGTH_FACT_RUNTIME",
}
EXPECTED_SECTIONS = [
    "A_BASIC_CHART_SUMMARY",
    "B_DAY_MASTER_GLOSS",
    "C_TEN_GOD_STRUCTURE_FACTS",
    "D_TRADITIONAL_OBSERVATION_ENTRY",
    "E_STRENGTH_FACT_ENTRY",
    "F_CURRENT_LIMITATIONS",
]
EXPECTED_TITLES = [
    "基础命盘摘要",
    "日主说明",
    "十神结构事实",
    "传统观察入口",
    "旺衰事实入口",
    "当前限制说明",
]
EXPECTED_PROHIBITED = {
    "STRONG_WEAK_CLASSIFICATION",
    "STRENGTH_CONCLUSION",
    "FAVORABLE_ELEMENT",
    "PATTERN_CLASSIFICATION",
    "WEALTH_JUDGMENT",
    "MARRIAGE_JUDGMENT",
    "CAREER_JUDGMENT",
    "PERSONALITY_JUDGMENT",
    "LUCK_FORECAST",
}


def load_json(name: str) -> dict:
    with (PACKAGE / name).open("r", encoding="utf-8") as handle:
        return json.load(handle)


protocol = load_json("explanation_protocol_v0.1.0.json")
sections = load_json("section_schema_v0.1.0.json")
wording = load_json("wording_policy_v0.1.0.json")
boundaries = load_json("boundary_rules_v0.1.0.json")

assert {path.name for path in PACKAGE.iterdir() if path.is_file()} == EXPECTED_FILES
for asset in (protocol, sections, wording, boundaries):
    assert asset["status"] == "RESEARCH_PROTOCOL_NOT_FOR_RUNTIME"
    assert asset["executable"] is False

assert protocol["orchestration_only"] is True
assert protocol["report_order"] == EXPECTED_SECTIONS
assert {item["source_id"] for item in protocol["source_registry"]} == EXPECTED_SOURCES
assert protocol["wording_origins"] == [
    "FACT_VALUE_FORMAT",
    "SAFE_RUNTIME_LOOKUP",
    "BOUNDARY_POLICY_COPY",
]
assert protocol["report_envelope"]["personal_judgment_field_available"] is False
assert protocol["report_envelope"]["prediction_field_available"] is False

section_items = sections["sections"]
assert [item["section_id"] for item in section_items] == EXPECTED_SECTIONS
assert [item["title"] for item in section_items] == EXPECTED_TITLES
assert [item["ordinal"] for item in section_items] == list("ABCDEF")
assert all(set(item["sources"]) <= EXPECTED_SOURCES for item in section_items)
assert all(
    set(item["allowed_modes"])
    <= {"FACT_PROJECTION", "SAFE_RUNTIME_GLOSS", "BOUNDARY_ONLY"}
    for item in section_items
)

assert set(wording["wording_origins"]) == {
    "FACT_VALUE_FORMAT",
    "SAFE_RUNTIME_LOOKUP",
    "BOUNDARY_POLICY_COPY",
}
assert wording["wording_origins"]["SAFE_RUNTIME_LOOKUP"][
    "hardcoded_safe_gloss_allowed"
] is False
assert all(
    item["section_id"] in EXPECTED_SECTIONS for item in wording["fact_templates"]
)
assert "COUNT_ONLY_IS_NOT_INTERPRETATION" in {
    item.get("required_runtime_policy") for item in wording["fact_templates"]
}

assert set(boundaries["prohibited_report_outputs"]) == EXPECTED_PROHIBITED
assert boundaries["direct_use_in_runtime_allowed"] is False
assert len(boundaries["inference_boundaries"]) == 7
assert {item["condition"] for item in boundaries["degradation_rules"]} == {
    "BAZI_CHART_RUNTIME_BLOCKED",
    "FOUNDATION_RUNTIME_UNAVAILABLE",
    "SAFE_INTERPRETATION_RUNTIME_UNAVAILABLE",
    "STRENGTH_FACT_RUNTIME_BLOCKED_OR_UNAVAILABLE",
    "UNKNOWN_HOUR",
}

contract_checks = {
    ROOT / "src/lib/bazi/runtime-types.ts": ["interface BaziCoreResult"],
    ROOT / "src/lib/bazi/foundation-runtime-types.ts": [
        "interface PillarsFoundationResult",
        'hiddenStemOrderSemantics: "NONE"',
    ],
    ROOT / "src/lib/bazi/interpretation-runtime-types.ts": [
        "interface InterpretationProtocol",
        'policyId: "COUNT_ONLY_IS_NOT_INTERPRETATION"',
        'gate: "SAFE_SEMANTIC_GLOSS"',
    ],
    ROOT / "src/lib/bazi/strength-fact-runtime-types.ts": [
        "interface StrengthFactOutput",
        "month_order_fact",
        "stem_root_presence",
        "visible_stem_fact",
        "hidden_stem_presence_fact",
        "dependency_audit",
    ],
}
for path, needles in contract_checks.items():
    source = path.read_text(encoding="utf-8")
    for needle in needles:
        assert needle in source, f"missing contract symbol: {needle}"

print("STATUS=RESEARCH_PROTOCOL_NOT_FOR_RUNTIME")
print("EXECUTABLE=FALSE")
print("ORCHESTRATION_ONLY=TRUE")
print("SOURCES=4/4")
print("SECTIONS=6/6")
print("WORDING_ORIGINS=3/3")
print("INFERENCE_BOUNDARIES=7/7")
print("DEGRADATION_RULES=5/5")
print("PROHIBITED_OUTPUTS=9/9")
print("PERSONAL_JUDGMENT_FIELD=FALSE")
print("PREDICTION_FIELD=FALSE")
print("BAZI_EXPLANATION_ORCHESTRATION: ALL PASS")
