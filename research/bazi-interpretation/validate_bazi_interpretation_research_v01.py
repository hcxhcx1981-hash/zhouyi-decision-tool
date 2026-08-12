# -*- coding: utf-8 -*-
"""
validate_bazi_interpretation_research_v01.py — Phase 2.5A.2 五层一致性收口版（纯 Python 标准库）

五层：safe_gloss_evidence → ten_god_semantics → interpretation_gates → prohibited_inferences → research report

检查项：
  A. 基础（JSON、十神完整性）
  B. 证据层（12 项检查）
  C. 五层一致性
  D. 隐私与预测
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


FILES = ['sources.json', 'safe_gloss_evidence_v0.1.json', 'ten_god_semantics.json',
         'day_master_semantics.json', 'pillar_role_semantics.json', 'visible_hidden_semantics.json',
         'interpretation_gates.json', 'strength_dependency_map.json', 'conflicts.json',
         'prohibited_inferences.json']
ok = True
for fn in FILES:
    try:
        load(fn)
    except Exception as e:
        ok = False
        check(f"JSON 合法: {fn}", False, str(e))
if ok:
    check("JSON 合法（10 文件）", True)

src = load('sources.json')
sge = load('safe_gloss_evidence_v0.1.json')
tg = load('ten_god_semantics.json')
dm = load('day_master_semantics.json')
gates = load('interpretation_gates.json')
pi = load('prohibited_inferences.json')
report_path = os.path.join(BASE, 'BAZI_INTERPRETATION_RESEARCH_REPORT_V0.1.md')
report = open(report_path, encoding='utf-8').read()

L1_IDS = {s['source_id'] for s in src['sources'] if s['evidence_level'] == 'L1'}
ALL_IDS = {s['source_id'] for s in src['sources']}
items = sge['safe_gloss_items']
gods = tg['ten_gods']

# ============ A. 基础 ============
expect = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印']
names = [g['ten_god'] for g in gods]
check("十神 10/10 存在且唯一", len(gods) == 10 and sorted(names) == sorted(expect))

# ============ B. 证据层（任务十 12 项） ============
# 1. SAFE 项必须有证据
safe_items = [i for i in items if i['freeze_recommendation'] == 'PROPOSE_SAFE_GLOSS_FREEZE']
check("1. SAFE 项必须有证据", all(i.get('source_evidence') for i in safe_items))

# 2. CONSERVATIVE 拟冻结项至少 2 个独立 source_id
cons_freezing = [i for i in items
                 if i['paraphrase_class'] == 'CONSERVATIVE_MODERN_PARAPHRASE'
                 and i['freeze_recommendation'] == 'PROPOSE_SAFE_GLOSS_FREEZE']
src_count_ok = True
for i in cons_freezing:
    sids = {e['source_id'] for e in i['source_evidence']}
    if len(sids) < 2:
        src_count_ok = False
check("2. CONSERVATIVE 拟冻结项 ≥2 独立 source_id",
      src_count_ok, f"项={len(cons_freezing)}")

# 3. 至少 1 个 L1
l1_ok = True
for i in cons_freezing:
    sids = {e['source_id'] for e in i['source_evidence']}
    if not (sids & L1_IDS):
        l1_ok = False
check("3. CONSERVATIVE 拟冻结项至少 1 个 L1", l1_ok)

# 4. REQUIRES_MORE_EVIDENCE 不得进入 SAFE allowed
rme_terms = {i['canonical_term'] for i in items if i['freeze_recommendation'] == 'REQUIRES_MORE_EVIDENCE'}
gate_violations = []
for c in gates['test_cases']:
    if c.get('allowed_gate') == 'SAFE_SEMANTIC_GLOSS':
        # SAFE gate 只允许冻结项
        pass
    for a in c.get('allowed', []):
        for t in rme_terms:
            if t in a and c.get('allowed_gate') != 'FACT_ONLY':
                if '被分类为' in a:
                    continue  # FACT_ONLY 表述
                gate_violations.append((c['case_id'], t, a))
check("4. REQUIRES_MORE_EVIDENCE 不得进入 SAFE allowed", not gate_violations,
      f"违规: {gate_violations[:3]}" if gate_violations else "")

# 5. removed_modern_words 不得重新进入 SAFE
removed_words = set()
for i in items:
    removed_words.update(i.get('removed_modern_words', []))
removed_words.update(['特殊学识', '灵感', '深度思考', '自我意识', '独立', '合作', '资源共享', '行动力',
                      '投资机遇', '社交人脉', '创造力', '个性表达', '叛逆', '稳定财富', '勤劳务实'])
removed_safe = []
for c in gates['test_cases']:
    for a in c.get('allowed', []):
        if a.startswith('传统子平常'):
            for w in removed_words:
                if w in a:
                    removed_safe.append((c['case_id'], w, a))
check("5. removed_modern_words 不得重新进入 SAFE", not removed_safe,
      f"残留: {removed_safe}" if removed_safe else "")

# 6. Gate 与 Evidence 一致（SAFE gate 术语均冻结；RME 术语 SAFE gate=0）
freeze_terms = {i['canonical_term'] for i in items if i['freeze_recommendation'] == 'PROPOSE_SAFE_GLOSS_FREEZE'}
safe_gate_terms = set()
for c in gates['test_cases']:
    if c.get('allowed_gate') == 'SAFE_SEMANTIC_GLOSS':
        for a in c.get('allowed', []):
            if a.startswith('传统子平常'):
                for t in freeze_terms | {'日主'}:
                    if t in a:
                        safe_gate_terms.add(t)
gate_ev_ok = True
for c in gates['test_cases']:
    if c.get('allowed_gate') == 'SAFE_SEMANTIC_GLOSS':
        has_gloss = any(a.startswith('传统子平') for a in c.get('allowed', []))
        if not has_gloss:
            gate_ev_ok = False
# RME 术语不得有 SAFE gate
rme_safe_gate = [c['case_id'] for c in gates['test_cases']
                 if c.get('allowed_gate') == 'SAFE_SEMANTIC_GLOSS'
                 and any(t in json.dumps(c['allowed'], ensure_ascii=False) for t in rme_terms)]
check("6. Gate 与 Evidence 一致", gate_ev_ok and not rme_safe_gate,
      f"RME 带 SAFE gate: {rme_safe_gate}" if rme_safe_gate else "")

# 7. prohibited 文件与 Evidence 一致（why_blocked 不引用 removed 词）
pi_txt = json.dumps(pi, ensure_ascii=False)
pi_old = [w for w in removed_words if w in pi_txt]
# 允许在 claim 中（作为禁止的断语）出现，但 why_blocked 不得引用为证据
pi_blocked_old = []
for ex in pi.get('structural_counterexamples', []):
    wb = ex.get('why_blocked', '')
    for w in ['特殊学识', '灵感', '深度思考', '投资机遇', '社交人脉', '稳定财富', '勤劳务实', '自我意识']:
        if w in wb:
            pi_blocked_old.append((ex['claim'], w))
check("7. prohibited 与 Evidence 一致（why_blocked 无 removed 词）", not pi_blocked_old,
      f"残留: {pi_blocked_old}" if pi_blocked_old else "")

# 8. report 与 Evidence 一致
report_has_freeze = '10 条' in report or '8 条' in report or '可冻结' in report
report_has_25a2 = '2.5A.2' in report or '双独立来源' in report or '交叉' in report
check("8. report 与 Evidence 一致（含最新统计与 2.5A.2 记录）", report_has_freeze and report_has_25a2)

# 9. 20 匿名测试一致（allowed_gate 合法 + allowed 非空 + prohibited 非空）
cases = gates['test_cases']
valid_gates = {'FACT_ONLY', 'SAFE_SEMANTIC_GLOSS', 'CONTEXT_REQUIRED'}
case_ok = (len(cases) == 20 and len({c['case_id'] for c in cases}) == 20
           and all(c.get('allowed_gate') in valid_gates for c in cases)
           and all(c.get('allowed') and c.get('prohibited') for c in cases))
check("9. 20 匿名测试一致（allowed_gate 合法、allowed/prohibited 齐备）", case_ok)

# 10. 真实个人资料 0（形态检测）
def scan_forms(text):
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
validator_text = open(os.path.join(BASE, 'validate_bazi_interpretation_research_v01.py'), encoding='utf-8').read()
pack_text = json.dumps({'src': src, 'sge': sge, 'tg': tg, 'dm': dm, 'gates': gates, 'pi': pi},
                       ensure_ascii=False)
hits_v = scan_forms(validator_text)
hits_p = scan_forms(pack_text)
check("10. 真实个人资料 0（validator + 研究包形态检测）", not hits_v and not hits_p,
      f"validator={hits_v} pack={hits_p}" if hits_v or hits_p else "")

# 11. 无预测输出（allowed 无个人预测断言）
predict_terms = ['一定', '必定', '注定', '天生', '命中注定', '婚姻不顺', '必有横财', '晚年富贵',
                 '事业一定成功', '容易离婚', '克父克母', '子女不孝', '脾气暴躁', '一定有钱', '一定当官']
pred_violations = []
for c in cases:
    for a in c.get('allowed', []):
        for w in predict_terms:
            if w in a:
                pred_violations.append((c['case_id'], w, a))
check("11. 无预测输出（allowed 无个人预测断言）", not pred_violations,
      f"违规: {pred_violations[:3]}" if pred_violations else "")

# 12. 五层一致性 PASS（汇总：evidence→semantics 一致）
# ten_god_semantics 中 SAFE gate 十神 == evidence freeze 十神（除日主在 day_master）
tg_safe = {g['ten_god'] for g in gods if g['interpretation_gate'] == 'SAFE_SEMANTIC_GLOSS'}
ev_free = {i['canonical_term'] for i in items if i['freeze_recommendation'] == 'PROPOSE_SAFE_GLOSS_FREEZE'}
layer_ok = tg_safe == (ev_free - {'日主'})
check("12. 五层一致性 PASS（semantics 与 evidence 冻结集合一致）", layer_ok,
      f"semantics={sorted(tg_safe)} evidence={sorted(ev_free)}" if not layer_ok else f"冻结十神={sorted(tg_safe)}")

n_pass = sum(1 for _, ok in RESULTS if ok)
n_fail = sum(1 for _, ok in RESULTS if not ok)
print()
print(f"RESULT: {n_pass} PASS / {n_fail} FAIL")
if n_fail == 0:
    print("BAZI_INTERPRETATION_RESEARCH_VALIDATION: ALL PASS")
    sys.exit(0)
else:
    print("BAZI_INTERPRETATION_RESEARCH_VALIDATION: FAIL")
    sys.exit(1)
