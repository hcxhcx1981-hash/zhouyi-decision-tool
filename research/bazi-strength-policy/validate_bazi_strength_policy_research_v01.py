from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PACKAGE = Path(__file__).resolve().parent


def load_json(name: str) -> dict:
    with (PACKAGE / name).open("r", encoding="utf-8") as handle:
        return json.load(handle)


protocol = load_json("bazi_strength_policy_protocol_v0.1.0.json")
inputs = load_json("input_contract_v0.1.0.json")
conflicts = load_json("conflict_register_v0.1.0.json")
traditions = load_json("tradition_boundaries_v0.1.0.json")
sources = json.loads(
    (ROOT / "research" / "bazi-strength" / "sources.json").read_text(encoding="utf-8")
)

assert protocol["status"] == "RESEARCH_POLICY_PROTOCOL_NOT_FOR_RUNTIME"
assert protocol["executable"] is False
assert protocol["gate"] == "TRADITION_POLICY_REQUIRED"
assert protocol["upstream_fact_contract"]["required_gate"] == "FACT_ONLY"
assert protocol["upstream_fact_contract"]["required_outputs"] == [
    "month_order_fact",
    "stem_root_presence",
    "visible_stem_fact",
    "hidden_stem_presence_fact",
    "dependency_audit",
]
assert len(protocol["policy_dimensions"]) == 8
assert {item["current_status"] for item in protocol["policy_dimensions"]} <= {
    "SCOPED",
    "OPEN",
    "BLOCKED",
    "OUT_OF_SCOPE",
}

result_contract = protocol["result_contract"]
assert result_contract["permitted_statuses"] == [
    "POLICY_NOT_SELECTED",
    "POLICY_CONFLICT",
    "INSUFFICIENT_POLICY",
    "OUT_OF_SCOPE",
]
assert result_contract["personal_chart_classification_available"] is False
assert result_contract["score_available"] is False
assert result_contract["weights_available"] is False
assert set(result_contract["prohibited_outputs"]) == {
    "STRONG_WEAK_CLASSIFICATION",
    "STRENGTH_SCORE",
    "WEIGHTED_RESULT",
    "FAVORABLE_ELEMENT",
    "PATTERN_CLASSIFICATION",
    "LUCK_JUDGMENT",
    "LIFE_INTERPRETATION",
}

assert inputs["status"] == "RESEARCH_POLICY_PROTOCOL_NOT_FOR_RUNTIME"
assert inputs["executable"] is False
assert [item["field"] for item in inputs["fact_inputs"]] == protocol[
    "upstream_fact_contract"
]["required_outputs"]
assert all(item["required_gate"] == "FACT_ONLY" for item in inputs["fact_inputs"])
assert all(
    item["availability"] in {"MISSING", "BLOCKED", "OUT_OF_SCOPE"}
    for item in inputs["policy_inputs_not_yet_frozen"]
)
assert inputs["data_minimization"] == {
    "personal_identity_required": False,
    "birth_input_required": False,
    "raw_location_required": False,
    "fact_projection_only": True,
}

assert conflicts["status"] == "RESEARCH_POLICY_PROTOCOL_NOT_FOR_RUNTIME"
assert conflicts["automatic_resolution_allowed"] is False
assert len(conflicts["conflicts"]) == 9
assert len({item["conflict_id"] for item in conflicts["conflicts"]}) == 9

assert traditions["status"] == "RESEARCH_POLICY_PROTOCOL_NOT_FOR_RUNTIME"
assert len(traditions["profile_families"]) == 6
assert traditions["mixing_policy"]["automatic_merge"] is False
assert any(
    item["project_state"] == "EXCLUDED"
    for item in traditions["profile_families"]
)

known_source_ids = {item["source_id"] for item in sources["sources"]}
referenced_source_ids = {
    source_id
    for collection in (conflicts["conflicts"], traditions["profile_families"])
    for item in collection
    for source_id in item["source_ids"]
}
assert referenced_source_ids <= known_source_ids


def walk_keys(value: object) -> list[str]:
    if isinstance(value, dict):
        return [key for key in value for key in [key, *walk_keys(value[key])]]
    if isinstance(value, list):
        return [key for item in value for key in walk_keys(item)]
    return []


for asset in (protocol, inputs, conflicts, traditions):
    keys = {key.lower() for key in walk_keys(asset)}
    assert "weight" not in keys
    assert "score" not in keys
    assert "threshold" not in keys
    assert "algorithm" not in keys

print("STATUS=RESEARCH_POLICY_PROTOCOL_NOT_FOR_RUNTIME")
print("EXECUTABLE=FALSE")
print("FACT_INPUTS=5/5")
print("POLICY_DIMENSIONS=8/8")
print("CONFLICTS=9/9")
print("TRADITION_PROFILES=6/6")
print("AUTOMATIC_MERGE=FALSE")
print("PERSONAL_CLASSIFICATION=FALSE")
print("SCORE=FALSE")
print("WEIGHTS=FALSE")
print("BAZI_STRENGTH_POLICY_RESEARCH: ALL PASS")
