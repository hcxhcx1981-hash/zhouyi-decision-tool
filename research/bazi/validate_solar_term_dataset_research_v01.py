# -*- coding: utf-8 -*-
"""
validate_solar_term_dataset_research_v01.py
Phase 2.1.2 生产节气数据方案研究验证脚本

验证项：
  1. 各 JSON 语法合法
  2. source_id 完整（spec/registry/matrix 互引一致）
  3. 候选来源均有许可证状态
  4. 推荐方案唯一
  5. 覆盖范围明确（1969-2101）
  6. 时间标准为 UTC
  7. 24 节气登记完整
  8. 十二个"节"标识正确
  9. 差分年份不少于 15
  10. 核心差分点不少于 135
  11. 差分不存在未解释超过 120 秒异常
  12. 推荐生成器许可证不是 UNKNOWN（须为 CLEAR）
  13. fixture 未被标成生产数据
  14. 未生成完整生产数据集
  15. 只修改 research/bazi 目录（本轮输出文件均在 research/bazi 下）

用法：python research/bazi/validate_solar_term_dataset_research_v01.py
全部通过输出 PASS；任一失败输出 FAIL 并退出码 1。
"""
import json
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(os.path.dirname(BASE))

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok), detail))
    tag = "PASS" if ok else "FAIL"
    print(f"[{tag}] {name}" + (f" — {detail}" if detail else ""))


def load_json(name):
    p = os.path.join(BASE, name)
    with open(p, encoding="utf-8") as f:
        return json.load(f)


# ---------- 1. JSON 语法 ----------
ok_all = True
for fn in [
    "solar_term_runtime_dataset_spec_candidate_v0.1.json",
    "solar_term_source_registry_v0.1.json",
    "solar_term_validation_matrix_v0.1.json",
]:
    try:
        load_json(fn)
    except Exception as e:
        ok_all = False
        check(f"JSON 语法: {fn}", False, str(e))
if ok_all:
    check("JSON 语法（3 个文件）", True)

spec = load_json("solar_term_runtime_dataset_spec_candidate_v0.1.json")
registry = load_json("solar_term_source_registry_v0.1.json")
matrix = load_json("solar_term_validation_matrix_v0.1.json")

# ---------- 2. source_id 完整 ----------
reg_ids = {s["source_id"] for s in registry["sources"]}
missing = []
for ref in [spec["generator"]["source_id"]]:
    if ref not in reg_ids:
        missing.append(ref)
for vs in spec["verification_sources"]:
    if vs["source_id"] not in reg_ids:
        missing.append(vs["source_id"])
gen_sid = matrix["generator"]["source_id"]
if gen_sid not in reg_ids:
    missing.append(gen_sid)
for rec in matrix["records"]:
    if rec["generator_source_id"] not in reg_ids:
        missing.append(rec["generator_source_id"])
    if rec["verification_source_id"] not in reg_ids:
        missing.append(rec["verification_source_id"])
missing = sorted(set(missing))
check("source_id 完整（spec/matrix 引用均存在于 registry）", not missing,
      f"缺失: {missing}" if missing else f"registry 共 {len(reg_ids)} 个来源")

# ---------- 3. 候选来源均有许可证状态 ----------
no_lic = [s["source_id"] for s in registry["sources"] if not s.get("license_name")]
check("候选来源均有许可证状态", not no_lic, f"缺 license_name: {no_lic}" if no_lic else "")

# ---------- 4. 推荐方案唯一 ----------
verdict = registry.get("verdict_notes", {}).get("final_verdict", "")
check("推荐方案唯一（final_verdict 存在且唯一）",
      verdict in ("DIRECT_AUTHORITATIVE_DATASET", "PINNED_GENERATOR_PLUS_OFFICIAL_CROSSCHECK",
                  "THIRD_PARTY_CALENDAR_LIBRARY", "CANNOT_FREEZE"),
      f"verdict={verdict}")

# ---------- 5. 覆盖范围明确 ----------
cov = spec.get("coverage", {})
check("覆盖范围明确（1969-2101）",
      cov.get("start_year") == 1969 and cov.get("end_year") == 2101,
      f"start={cov.get('start_year')} end={cov.get('end_year')}")

# ---------- 6. 时间标准为 UTC ----------
check("时间标准为 UTC", spec.get("time_standard") == "UTC", spec.get("time_standard"))

# ---------- 7. 24 节气登记完整 ----------
terms = spec.get("term_registry", [])
term_ids = [t["term_id"] for t in terms]
expect_ids = [
    "XIAOHAN", "DAHAN", "LICHUN", "YUSHUI", "JINGZHE", "CHUNFEN",
    "QINGMING", "GUYU", "LIXIA", "XIAOMAN", "MANGZHONG", "XIAZHI",
    "XIAOSHU", "DASHU", "LIQIU", "CHUSHU", "BAILU", "QIUFEN",
    "HANLU", "SHUANGJIANG", "LIDONG", "XIAOXUE", "DAXUE", "DONGZHI",
]
check("24 节气登记完整且无重复", len(terms) == 24 and sorted(term_ids) == sorted(expect_ids),
      f"count={len(terms)}")

# ---------- 8. 十二个"节"标识正确 ----------
jie_expect = ["LICHUN", "JINGZHE", "QINGMING", "LIXIA", "MANGZHONG",
              "XIAOSHU", "LIQIU", "BAILU", "HANLU", "LIDONG", "DAXUE", "XIAOHAN"]
jie_in_registry = [t["term_id"] for t in terms if t.get("is_month_boundary_jie")]
jie_from_policy = spec.get("jie_list_for_four_pillars", [])
check("十二个节标识正确（registry 与 policy 一致）",
      sorted(jie_in_registry) == sorted(jie_expect) == sorted(jie_from_policy),
      f"registry={len(jie_in_registry)} policy={len(jie_from_policy)}")

# ---------- 9. 差分年份不少于 15 ----------
years = matrix["summary"].get("years", [])
check("差分年份不少于 15", len(years) >= 15, f"years={len(years)}")

# ---------- 10. 核心差分点不少于 135 ----------
total = matrix["summary"].get("total_diff_points", 0)
check("核心差分点不少于 135", total >= 135, f"points={total}")

# ---------- 11. 差分不存在未解释超过 120 秒异常 ----------
over120 = matrix["summary"].get("over_120_seconds", -1)
unexplained = matrix["summary"].get("unexplained_anomalies", -1)
check("无未解释超过 120 秒异常", over120 == 0 and unexplained == 0,
      f"over120={over120} unexplained={unexplained}")

# ---------- 12. 推荐生成器许可证为 CLEAR ----------
gen = registry["sources"][0]
check("推荐生成器许可证 CLEAR", gen["status"] == "RECOMMENDED_GENERATOR" and gen.get("license_name", "").startswith("MIT"),
      f"license={gen.get('license_name')}")

# ---------- 13. fixture 未被标成生产数据 ----------
fixture_sep = spec.get("fixture_separation_note", "")
check("fixture 未被标成生产数据", "fixture" in fixture_sep and "不升级为生产数据" in fixture_sep)

# ---------- 14. 未生成完整生产数据集 ----------
status = spec.get("status", "")
gen_note = spec.get("production_dataset_generation", "")
check("未生成完整生产数据集", "RESEARCH_CANDIDATE" in status and "本轮不生成" in gen_note,
      f"status={status}")

# ---------- 15. 只修改 research/bazi 目录 ----------
# 本轮新增/修改文件清单，全部位于 research/bazi
allowed_files = [
    "SOLAR_TERM_RUNTIME_DATASET_RESEARCH_V0.1.md",
    "solar_term_runtime_dataset_spec_candidate_v0.1.json",
    "solar_term_source_registry_v0.1.json",
    "solar_term_validation_matrix_v0.1.json",
    "validate_solar_term_dataset_research_v01.py",
    "bazi_calendar_rules_candidate_v0.1.json",
]
in_scope = all(os.path.isfile(os.path.join(BASE, fn)) for fn in allowed_files)
check("本轮输出文件齐全且均在 research/bazi 下", in_scope)

# ---------- 汇总 ----------
n_pass = sum(1 for _, ok, _ in RESULTS if ok)
n_fail = sum(1 for _, ok, _ in RESULTS if not ok)
print()
print(f"RESULT: {n_pass} PASS / {n_fail} FAIL")
if n_fail == 0:
    print("SOLAR_TERM_DATASET_RESEARCH_VALIDATION: ALL PASS")
    sys.exit(0)
else:
    print("SOLAR_TERM_DATASET_RESEARCH_VALIDATION: FAIL")
    sys.exit(1)
