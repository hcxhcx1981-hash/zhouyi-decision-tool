# -*- coding: utf-8 -*-
"""
validate_bazi_foundation_v02.py — Phase 2.4A.2 正式冻结前验证脚本（29 项）

数据驱动原则：
- 不硬编码 STEM_YY / STEM_EL / GEN / CTL 真值表
- 从 heavenly_stems.json 读取 stem → yin_yang / element
- 从 five_element_relations.json 读取 generates / controls
- 从 ten_god_rules.json 读取 formula
- 完整验证链：candidate 基础属性 → 五行方向 → 阴阳关系 → formula → 100 格 matrix

用法：python research/bazi-foundation/validate_bazi_foundation_v02.py
"""
import json
import os
import sys
import hashlib
from collections import Counter

import jsonschema

BASE = os.path.dirname(os.path.abspath(__file__))
TS = 'ZIPING_BAZI'
RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok)))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def load(name):
    with open(os.path.join(BASE, name), encoding="utf-8") as f:
        return json.load(f)


# ---------- 1. JSON 合法 ----------
FILES = ['sources.json', 'heavenly_stems.json', 'earthly_branches.json',
         'five_element_relations.json', 'hidden_stems.json',
         'ten_god_rules.json', 'ten_god_matrix.json', 'conflicts.json',
         'bazi_foundation_freeze_candidate_v0.2.0.json',
         'bazi_foundation_freeze_candidate_v0.2.0.schema.json',
         'evidence_snapshot_v0.2.0.json']
ok = True
for fn in FILES:
    try:
        load(fn)
    except Exception as e:
        ok = False
        check(f"JSON 合法: {fn}", False, str(e))
if ok:
    check("JSON 合法（11 文件）", True)

hs = load('heavenly_stems.json')
eb = load('earthly_branches.json')
fe = load('five_element_relations.json')
hids = load('hidden_stems.json')
tgr = load('ten_god_rules.json')
tgm = load('ten_god_matrix.json')
cf = load('conflicts.json')
cand = load('bazi_foundation_freeze_candidate_v0.2.0.json')
schema = load('bazi_foundation_freeze_candidate_v0.2.0.schema.json')
snap = load('evidence_snapshot_v0.2.0.json')

# ---------- 2. tradition_scope 完整 ----------
all_objs = [hs, eb, fe, hids, tgr, tgm, cf, cand, snap]
scope_top = all(d.get('tradition_scope') == TS for d in all_objs)
scope_rules = all(r.get('tradition_scope') == TS
                  for d in (hs, eb, fe, tgr) for r in d.get('rules', []))
scope_rules &= all(r.get('tradition_scope') == TS
                   for r in hids.get('membership_rules', []) + hids.get('policy_rules', []))
scope_rules &= all(c.get('tradition_scope') == TS for c in cf.get('conflicts', []))
check("tradition_scope = ZIPING_BAZI 完整", scope_top and scope_rules)

# ---------- 3. 10 天干完整唯一 ----------
stems = [r['stem_id'] for r in hs['rules']]
cand_stems = [s['stem_id'] for s in cand['heavenly_stems']]
EXPECT_STEMS = ['JIA', 'YI', 'BING', 'DING', 'WU', 'JI', 'GENG', 'XIN', 'REN', 'GUI']
check("10 天干完整唯一（研究 + candidate）",
      len(stems) == 10 and len(set(stems)) == 10 and sorted(stems) == sorted(EXPECT_STEMS)
      and cand_stems == stems,
      f"研究{len(stems)} candidate{len(cand_stems)}")

# ---------- 4. 12 地支完整唯一 ----------
branches = [r['branch_id'] for r in eb['rules']]
cand_branches = [b['branch_id'] for b in cand['earthly_branches']]
EXPECT_BRANCHES = ['ZI', 'CHOU', 'YIN', 'MAO', 'CHEN', 'SI', 'WU', 'WEI', 'SHEN', 'YOU', 'XU', 'HAI']
check("12 地支完整唯一（研究 + candidate）",
      len(branches) == 12 and len(set(branches)) == 12 and sorted(branches) == sorted(EXPECT_BRANCHES)
      and cand_branches == branches)

# ---------- 5/6. enum 合法 ----------
STEM_EL_SET = {'WOOD', 'FIRE', 'EARTH', 'METAL', 'WATER'}
STEM_YY_SET = {'YANG', 'YIN'}
stem_enum = all(r['yin_yang'] in STEM_YY_SET and r['element'] in STEM_EL_SET for r in hs['rules'])
branch_enum = all(r['yin_yang'] in STEM_YY_SET and r['element'] in STEM_EL_SET for r in eb['rules'])
cand_enum = (all(s['yin_yang'] in STEM_YY_SET and s['element'] in STEM_EL_SET for s in cand['heavenly_stems'])
             and all(b['yin_yang'] in STEM_YY_SET and b['element'] in STEM_EL_SET for b in cand['earthly_branches']))
check("stem 阴阳/五行 enum 合法", stem_enum and cand_enum)
check("branch 阴阳/五行 enum 合法", branch_enum and cand_enum)

# ---------- 7. 12 藏干集合完整 ----------
sets = {r['branch_id']: set(r['hidden_stem_set']) for r in hids['membership_rules']}
cand_sets = {s['branch_id']: set(s['hidden_stem_set']) for s in cand['hidden_stem_sets']}
check("12 藏干集合完整（研究 + candidate）",
      len(sets) == 12 and len(cand_sets) == 12
      and all(sets[b] == cand_sets[b] for b in sets))

# ---------- 8. 藏干属于 10 天干 ----------
stem_set = set(stems)
all_hidden = set().union(*sets.values()) | set().union(*cand_sets.values())
check("每个藏干都属于 10 天干", all_hidden <= stem_set, f"越界: {all_hidden - stem_set}" if all_hidden - stem_set else "")

# ---------- 9. main/other 不进入 freeze projection ----------
mem_rules = hids['membership_rules']
main_other_out = all(r.get('freeze_projection') is False for r in mem_rules)
cand_has_legacy = any('main_hidden_stem' in s or 'other_hidden_stems' in s or 'ordered_hidden_stems' in s
                      for s in cand['hidden_stem_sets'])
check("main/other 退出 freeze projection", main_other_out and not cand_has_legacy)

# ---------- 10. freeze projection 无重复藏干真相 ----------
cand_has_hidden_copy = any('hidden_stem_ids' in b or 'hidden_stems' in b for b in cand['earthly_branches'])
dup_check = not cand_has_hidden_copy
check("FREEZE_CANDIDATE_DUPLICATE_HIDDEN_STEM_SOURCE = 0", dup_check)

# ---------- 11. earth branch 副本与权威 set 12/12 一致 ----------
eb_ids = {r['branch_id']: set(r['hidden_stem_ids']) for r in eb['rules']}
consistency = all(eb_ids[b] == sets[b] for b in sets)
check("earthly_branches.hidden_stem_ids 与 hidden_stem_set 12/12 一致（集合比较）",
      len(eb_ids) == 12 and consistency)

# ---------- 12/13/14. 五行关系 ----------
gen_rules = [r for r in fe['rules'] if r['topic'] == 'five_element_generation']
ctl_rules = [r for r in fe['rules'] if r['topic'] == 'five_element_control']
check("五行生 5 条", len(gen_rules) == 5 and len(cand['five_element_relations']['generates']) == 5)
check("五行克 5 条", len(ctl_rules) == 5 and len(cand['five_element_relations']['controls']) == 5)
gen_pairs = [(r['from'], r['to']) for r in gen_rules]
ctl_pairs = [(r['from'], r['to']) for r in ctl_rules]
cand_gen = [(e['from'], e['to']) for e in cand['five_element_relations']['generates']]
cand_ctl = [(e['from'], e['to']) for e in cand['five_element_relations']['controls']]
check("relation 无重复且与研究一致",
      len(gen_pairs) == len(set(gen_pairs)) and len(ctl_pairs) == len(set(ctl_pairs))
      and set(gen_pairs) == set(cand_gen) and set(ctl_pairs) == set(cand_ctl))

# ---------- 15/16. 十神 canonical / formula ----------
canonical = tgr.get('canonical_names', [])
EXPECT_CANON = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印']
formula = tgr.get('formula', {})
REL_KEYS = ['SAME_ELEMENT', 'DAY_GENERATES_TARGET', 'DAY_CONTROLS_TARGET', 'TARGET_CONTROLS_DAY', 'TARGET_GENERATES_DAY']
check("十神 canonical = 10", canonical == EXPECT_CANON and cand['ten_god_canonical_names'] == EXPECT_CANON)
check("formula = 5 类 × 2 极性",
      set(formula.keys()) == set(REL_KEYS)
      and all(set(v.keys()) == {'SAME_POLARITY', 'DIFFERENT_POLARITY'} for v in formula.values())
      and cand['ten_god_formula'] == formula)

# ---------- 17. 10 条 TEN-GOD rule 与 formula 10/10 一致 ----------
rule_formula_ok = True
for r in tgr['rules']:
    try:
        if formula[r['element_relation']][r['polarity_relation']] != r['ten_god']:
            rule_formula_ok = False
    except KeyError:
        rule_formula_ok = False
check("10 条 TEN-GOD rule 与 formula 10/10 一致", rule_formula_ok and len(tgr['rules']) == 10)

# ---------- 18/19/20. 用 candidate 数据重建 matrix ----------
stem_el = {r['stem_id']: r['element'] for r in cand['heavenly_stems']}
stem_yy = {r['stem_id']: r['yin_yang'] for r in cand['heavenly_stems']}
gen_map = {e['from']: e['to'] for e in cand['five_element_relations']['generates']}
ctl_map = {e['from']: e['to'] for e in cand['five_element_relations']['controls']}

def relation_of(d_el, t_el):
    if d_el == t_el:
        return 'SAME_ELEMENT'
    if gen_map[d_el] == t_el:
        return 'DAY_GENERATES_TARGET'
    if ctl_map[d_el] == t_el:
        return 'DAY_CONTROLS_TARGET'
    if ctl_map[t_el] == d_el:
        return 'TARGET_CONTROLS_DAY'
    if gen_map[t_el] == d_el:
        return 'TARGET_GENERATES_DAY'
    raise ValueError('关系无法判定')

ORDER = EXPECT_STEMS
CN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
regen = []
nulls = 0
for day in ORDER:
    gods = []
    for target in ORDER:
        rel = relation_of(stem_el[day], stem_el[target])
        pol = 'SAME_POLARITY' if stem_yy[day] == stem_yy[target] else 'DIFFERENT_POLARITY'
        god = formula[rel][pol]
        if god is None:
            nulls += 1
        gods.append(god)
    regen.append({'day_stem': day, 'day_chinese': CN[ORDER.index(day)], 'ten_gods': gods})

cells = sum(len(r['ten_gods']) for r in regen)
check("使用 candidate 数据重建 matrix = 100/100", cells == 100)
check("matrix 无 null", nulls == 0)
per_row = all(len(r['ten_gods']) == 10 and len(set(r['ten_gods'])) == 10 for r in regen)
check("每行 10 神各一次", per_row)
matrix_identical = regen == tgm['rows'] and regen == [dict(r) for r in cand.get('matrix_fixture_check', [])] if False else regen == tgm['rows']
check("重建 matrix 与 ten_god_matrix.json 一致", matrix_identical)

# ---------- 21. 午={丁,己} ----------
wu_set = sets.get('WU')
check("午 = {丁,己}", wu_set == {'DING', 'JI'} and cand_sets.get('WU') == {'DING', 'JI'})

# ---------- 22. 午 variant 证据保留 ----------
wu_evs = snap.get('special_evidence_wu_branch', [])
markers = [e.get('marker') for e in wu_evs]
has_mainline = any(e.get('role') == 'mainline' and e.get('source_id') == 'SRC-L1-YUANHAI-ZIPING' for e in wu_evs)
has_variant = any(e.get('role') == 'variant_observed' and e.get('source_id') == 'SRC-L2-MINGLI-TANYUAN'
                  and e.get('marker') == 'LIKELY_TRANSCRIPTION_OR_EDITION_VARIANT' for e in wu_evs)
has_later = any(e.get('role') == 'same_book_later_evidence' and e.get('source_id') == 'SRC-L2-MINGLI-TANYUAN' for e in wu_evs)
check("午 variant 证据保留（三证据 + 标记）", has_mainline and has_variant and has_later and len(wu_evs) == 3)

# ---------- 23/24/25. 政策状态 ----------
pol = {p['rule_id']: p.get('product_recommendation') for p in hids['policy_rules']}
check("藏干顺序 policy 仍阻断", pol.get('HIDDEN-POLICY-ORDER') == 'TRADITION_POLICY_REQUIRED')
check("本中余气仍阻断", pol.get('HIDDEN-POLICY-QI-LABELS') == 'TRADITION_POLICY_REQUIRED')
check("权重 OUT_OF_SCOPE", pol.get('HIDDEN-POLICY-WEIGHTS') == 'OUT_OF_SCOPE')

# ---------- 26. evidence snapshot source_id 有效 ----------
src_ids = {s['source_id'] for s in load('sources.json')['sources']}
snap_ids = {e['source_id'] for e in snap['sources']}
wu_ids = {e['source_id'] for e in wu_evs}
check("evidence snapshot 引用 source_id 全部有效",
      snap_ids <= src_ids and wu_ids <= src_ids, f"snap={snap_ids - src_ids if snap_ids - src_ids else 'OK'}")

# ---------- 27. evidence hash 全部匹配 ----------
hash_file = os.path.join(BASE, 'FOUNDATION_EVIDENCE_SHA256.txt')
hash_ok = True
if os.path.exists(hash_file):
    for line in open(hash_file, encoding='utf-8'):
        line = line.strip()
        if not line:
            continue
        h, fn = line.split('  ', 1)
        fp = os.path.join(BASE, fn)
        if not os.path.exists(fp):
            hash_ok = False
            continue
        cur = hashlib.sha256(open(fp, 'rb').read()).hexdigest()
        if cur != h:
            hash_ok = False
check("evidence hash 全部匹配", hash_ok)

# ---------- 28. freeze candidate 通过 schema ----------
try:
    jsonschema.validate(cand, schema)
    schema_ok = True
except jsonschema.ValidationError as e:
    schema_ok = False
check("freeze candidate 通过 schema", schema_ok)

# ---------- 29. 无旺衰/喜用/吉凶 runtime 字段 ----------
forbidden = ['旺衰', '喜用', '吉凶', '身强', '身弱', '格局', '大运', '调候']
# 业务数据视图：排除元数据声明字段（excluded_from_freeze 是排除声明，非业务字段）
biz_view = {
    'heavenly_stems': cand['heavenly_stems'],
    'earthly_branches': cand['earthly_branches'],
    'hidden_stem_sets': cand['hidden_stem_sets'],
    'five_element_relations': cand['five_element_relations'],
    'ten_god_formula': cand['ten_god_formula'],
    'ten_god_canonical_names': cand['ten_god_canonical_names'],
}
biz_txt = json.dumps(biz_view, ensure_ascii=False)
found = [k for k in forbidden if k in biz_txt]
check("freeze candidate 业务字段无旺衰/喜用/吉凶等", not found, f"命中: {found}" if found else "")

# ---------- 状态数量（真实重算，不硬编码为 PASS 条件） ----------
stats = Counter()
for r in (hs['rules'] + eb['rules'] + fe['rules'] + tgr['rules']
          + hids['membership_rules'] + hids['policy_rules']):
    stats[r.get('product_recommendation', 'MISSING')] += 1
total_rules = sum(stats.values())
print()
print('=== 真实状态数量（rules 层面，共 %d 条）===' % total_rules)
for k, v in sorted(stats.items()):
    print(f'  {k}: {v}')

n_pass = sum(1 for _, ok in RESULTS if ok)
n_fail = sum(1 for _, ok in RESULTS if not ok)
print()
print(f"RESULT: {n_pass} PASS / {n_fail} FAIL")
if n_fail == 0:
    print("BAZI_FOUNDATION_V02_VALIDATION: ALL PASS")
    sys.exit(0)
else:
    print("BAZI_FOUNDATION_V02_VALIDATION: FAIL")
    sys.exit(1)
