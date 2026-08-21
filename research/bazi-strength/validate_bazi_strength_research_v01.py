# -*- coding: utf-8 -*-
"""
validate_bazi_strength_research_v01.py — Phase 2.6A 月令旺衰研究验证脚本（纯 Python 标准库）

验证：来源完整、scope 完整、禁止预测词、状态分类、gate 完整、case 完整、无用户真实资料
"""
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok)))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def load(name):
    with open(os.path.join(BASE, name), encoding="utf-8") as f:
        return json.load(f)


FILES = ['sources.json', 'month_order_semantics.json', 'strength_concepts.json',
         'root_semantics.json', 'conflicts.json', 'strength_dependency_map.json',
         'interpretation_gates.json']
ok = True
for fn in FILES:
    try:
        load(fn)
    except Exception as e:
        ok = False
        check(f"JSON 合法: {fn}", False, str(e))
if ok:
    check("JSON 合法（7 文件）", True)

src = load('sources.json')
mo = load('month_order_semantics.json')
sc = load('strength_concepts.json')
rt = load('root_semantics.json')
cf = load('conflicts.json')
sd = load('strength_dependency_map.json')
gates = load('interpretation_gates.json')
report = open(os.path.join(BASE, 'BAZI_STRENGTH_RESEARCH_REPORT_V0.1.md'), encoding='utf-8').read()

# 1. 来源完整：≥4 L1
l1 = [s for s in src['sources'] if s['evidence_level'] == 'L1']
check("来源完整（≥4 个 L1）", len(l1) >= 4, f"L1={len(l1)}")
l1_ids = {s['source_id'] for s in l1}

# 2. scope 完整
objs = [src, mo, sc, rt, cf, sd, gates]
check("scope 完整（tradition_scope=ZIPING_BAZI）",
      all(o.get('tradition_scope') == 'ZIPING_BAZI' for o in objs))

# 3. 禁止预测词（allowed 无预测断言；否定语境如"不等于'一定旺'"为边界说明，允许）
PRED = ['必定', '注定', '命中注定', '婚姻不顺', '必有横财', '晚年富贵',
        '事业一定成功', '容易离婚', '克父克母', '子女不孝', '身强所以', '身弱所以',
        '一定旺', '一定强', '一定好', '一定富', '一定穷']
viol = []
for c in gates['test_cases']:
    for a in c.get('allowed', []):
        # 否定语境（不等于/不得/禁止/无法）为边界说明，其中的预测词是反例引用
        if any(neg in a for neg in ['不等于', '不得', '禁止', '无法', '未冻结', '不能']):
            continue
        for w in PRED:
            if w in a:
                viol.append((c['case_id'], w, a))
check("禁止预测词（allowed 无预测断言）", not viol, f"违规: {viol[:3]}" if viol else "")

# 4. 状态分类
STATUS_KEYS = ['PROHIBITED_DIRECT_INFERENCE', 'TRADITION_POLICY_REQUIRED', 'OUT_OF_SCOPE']
status_ok = all(any(k in json.dumps(o, ensure_ascii=False) for o in objs) for k in STATUS_KEYS)
# 核心检查：旺衰无统一算法（评分/百分制不作为本项目规则）
no_alg = (sc['conclusion'].get('unified_algorithm_exists') is False
          and sd.get('machineability_verdict', {}).get('can_machine_strength') is False)
prohibited_models_registered = bool(sc.get('prohibited_models') or
                                    any('prohibited_models' in c for c in sc.get('concepts', [])))
check("状态分类完整（含 PROHIBITED/TRADITION_POLICY/OUT_OF_SCOPE）", status_ok)
check("无统一旺衰算法（评分/百分制仅作反例）", no_alg and prohibited_models_registered)

# 5. gate 完整
check("gate 完整（6 类）",
      set(gates['gates'].keys()) >= {'FACT_ONLY', 'SAFE_SEMANTIC_GLOSS', 'CONTEXT_REQUIRED',
                                      'TRADITION_POLICY_REQUIRED', 'PROHIBITED_DIRECT_INFERENCE', 'OUT_OF_SCOPE'})

# 6. case 完整（≥20，allowed_gate 合法，allowed/prohibited 齐备）
cases = gates['test_cases']
valid_gates = {'FACT_ONLY', 'SAFE_SEMANTIC_GLOSS', 'CONTEXT_REQUIRED', 'OUT_OF_SCOPE'}
case_ok = (len(cases) >= 20 and len({c['case_id'] for c in cases}) == len(cases)
           and all(c.get('allowed_gate') in valid_gates for c in cases)
           and all(c.get('allowed') and c.get('prohibited') for c in cases))
check("case 完整（≥20，gate 合法，allowed/prohibited 齐备）", case_ok, f"count={len(cases)}")

# 7. 无用户真实资料（形态检测）
def scan(text):
    hits = []
    for m in re.findall(r'\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}', text):
        hits.append('DATETIME:' + m)
    for m in re.findall(r'\d{8}', text):
        hits.append('EIGHT_DIGIT:' + m)
    for m in re.findall(r'(?<![\d:])\d{2}:\d{2}(?!\d)', text):
        hits.append('TIME:' + m)
    for m in re.findall(r'(?:[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]){4}', text):
        hits.append('FOUR_PILLAR:' + m)
    return hits
pack_txt = json.dumps(objs, ensure_ascii=False)
val_txt = open(os.path.join(BASE, 'validate_bazi_strength_research_v01.py'), encoding='utf-8').read()
hits = scan(pack_txt) + scan(val_txt)
check("无用户真实资料（形态检测）", not hits, f"命中: {hits[:3]}" if hits else "")

n_pass = sum(1 for _, ok in RESULTS if ok)
n_fail = sum(1 for _, ok in RESULTS if not ok)
print()
print(f"RESULT: {n_pass} PASS / {n_fail} FAIL")
if n_fail == 0:
    print("BAZI_STRENGTH_RESEARCH_VALIDATION: ALL PASS")
    sys.exit(0)
else:
    print("BAZI_STRENGTH_RESEARCH_VALIDATION: FAIL")
    sys.exit(1)
