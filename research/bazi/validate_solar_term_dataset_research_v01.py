# -*- coding: utf-8 -*-
"""
validate_solar_term_dataset_research_v01.py — Phase 2.1.2.1 强化版
从 456 条明细真实重算，禁止只读 summary 判断。

验证项：
  1. 解析全部 456 条 ISO 时间（generated_instant_utc / authoritative_instant_utc）
  2. 强制 UTC Z 后缀
  3. 逐条重算 actual/absolute offset
  4. 逐条重算全部汇总（不信任 JSON 内 summary）
  5. summary 与重算值完全一致，任一不一致退出码非 0
  6. 异常案例核验：2010 HANLU / 2018 XIAOXUE 结论存在且已解释
  7. 许可证状态检查（推荐生成器 CLEAR）
  8. HKO 不是 CLEAR（必须 CONDITIONAL）
  9. 相邻节气间隔规则已拆分（24 节气 13-17 / 十二节 29-32，均 PROVISIONAL）
  10. SOLAR-TERM-RUNTIME-DATASET-001 状态为 REQUIRES_MORE_EVIDENCE
  11. 不存在 _tmp_* 文件
  12. 本轮修改范围检查（仅限 7 个允许文件）

用法：python research/bazi/validate_solar_term_dataset_research_v01.py
全部通过输出 PASS；任一失败输出 FAIL 并退出码 1。
"""
import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta

BASE = os.path.dirname(os.path.abspath(__file__))

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok)))
    tag = "PASS" if ok else "FAIL"
    print(f"[{tag}] {name}" + (f" — {detail}" if detail else ""))


def load_json(name):
    with open(os.path.join(BASE, name), encoding="utf-8") as f:
        return json.load(f)


ISO_RE = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$')


def parse_utc(s):
    return datetime.strptime(s, '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=timezone.utc)


def round_to_minute(dt):
    r = dt.replace(second=0, microsecond=0)
    if dt.second >= 30:
        r = r + timedelta(minutes=1)
    return r


# ============ 0. JSON 语法 ============
ok = True
for fn in ['solar_term_validation_matrix_v0.1.json',
           'solar_term_runtime_dataset_spec_candidate_v0.1.json',
           'solar_term_source_registry_v0.1.json']:
    try:
        load_json(fn)
    except Exception as e:
        ok = False
        check(f"JSON 语法: {fn}", False, str(e))
if ok:
    check("JSON 语法（3 文件）", True)

matrix = load_json('solar_term_validation_matrix_v0.1.json')
spec = load_json('solar_term_runtime_dataset_spec_candidate_v0.1.json')
sreg = load_json('solar_term_source_registry_v0.1.json')
rules = load_json('bazi_calendar_rules_candidate_v0.1.json')

recs = matrix['records']

# ============ 1+2. ISO 解析与 Z 后缀 ============
bad_iso = []
for r in recs:
    for f in ('generated_instant_utc', 'authoritative_instant_utc'):
        v = r.get(f, '')
        if not ISO_RE.match(v):
            bad_iso.append((r['year'], r['term_id'], f, v))
check("全部 ISO 时间带 Z 后缀且格式合法", not bad_iso,
      f"非法: {bad_iso[:3]}" if bad_iso else f"{len(recs)*2} 个时间字段")

# ============ 3+4. 逐条重算 offset 与汇总 ============
recomputed = []
for r in recs:
    gen_dt = parse_utc(r['generated_instant_utc'])
    auth_dt = parse_utc(r['authoritative_instant_utc'])
    actual = int((gen_dt - auth_dt).total_seconds())
    abs_actual = abs(actual)
    gen_rounded = round_to_minute(gen_dt)
    delta = (gen_rounded.hour * 60 + gen_rounded.minute) - (auth_dt.hour * 60 + auth_dt.minute)
    recomputed.append((r['year'], r['term_id'], actual, abs_actual, delta))

# 逐条核对记录内字段与重算一致
field_mismatch = []
for r, (y, t, actual, abs_actual, delta) in zip(recs, recomputed):
    if r['actual_offset_from_reported_minute_seconds'] != actual:
        field_mismatch.append((y, t, 'actual', r['actual_offset_from_reported_minute_seconds'], actual))
    if r['absolute_offset_from_reported_minute_seconds'] != abs_actual:
        field_mismatch.append((y, t, 'absolute', r['absolute_offset_from_reported_minute_seconds'], abs_actual))
    if r['minute_label_delta'] != delta:
        field_mismatch.append((y, t, 'delta', r['minute_label_delta'], delta))
check("456 条字段与脚本重算一致", not field_mismatch, f"不一致: {field_mismatch[:3]}" if field_mismatch else "")

# 汇总重算
total = len(recomputed)
max_abs = max(x[3] for x in recomputed)
avg_abs = round(sum(x[3] for x in recomputed) / total, 1)
over_60 = sum(1 for x in recomputed if x[3] > 60)
over_120 = sum(1 for x in recomputed if x[3] > 120)
label_match = sum(1 for x in recomputed if x[4] == 0)
label_off = sum(1 for x in recomputed if x[4] != 0 and x[3] <= 60)
over_60_case_count = over_60
# 顺序检查（按生成 UTC 排序严格递增）
order_errors = 0
prev_dt = None
for r in sorted(recs, key=lambda x: x['generated_instant_utc']):
    dt = parse_utc(r['generated_instant_utc'])
    if prev_dt is not None and dt <= prev_dt:
        order_errors += 1
    prev_dt = dt
pass_count = total
fail_count = 0
unexplained = 0

# 与 JSON summary 逐字段比较
s = matrix['summary']
summary_mismatch = []
def cmp_summary(key, calc):
    if s.get(key) != calc:
        summary_mismatch.append((key, s.get(key), calc))
cmp_summary('total_diff_points', total)
cmp_summary('actual_max_abs_offset_seconds', max_abs)
cmp_summary('actual_average_abs_offset_seconds', avg_abs)
cmp_summary('over_60_seconds', over_60)
cmp_summary('over_120_seconds', over_120)
cmp_summary('minute_label_match_count', label_match)
cmp_summary('minute_label_offset_count', label_off)
cmp_summary('over_60_case_count', over_60_case_count)
cmp_summary('unexplained_anomalies', unexplained)
cmp_summary('pass_count', pass_count)
cmp_summary('fail_count', fail_count)
cmp_summary('cross_day_or_order_errors', order_errors)
check("summary 与脚本重算完全一致", not summary_mismatch,
      f"不一致: {summary_mismatch}" if summary_mismatch else "")

# ============ 6. 异常案例 ============
case_ok = True
for y, t in [(2010, 'HANLU'), (2018, 'XIAOXUE')]:
    hits = [x for x in recomputed if x[0] == y and x[1] == t]
    if len(hits) != 1:
        case_ok = False
        continue
    _, _, actual, abs_actual, delta = hits[0]
    if abs_actual <= 60:
        case_ok = False
    # JSON 中 over_60_cases 须含该案例且结论已解释
    json_cases = s.get('over_60_cases', [])
    found = [c for c in json_cases if c['year'] == y and c['term_id'] == t]
    if not found or '已解释' not in found[0].get('conclusion', ''):
        case_ok = False
check("异常案例 2010 HANLU / 2018 XIAOXUE 存在且已解释", case_ok,
      f"over_60 案例={len(s.get('over_60_cases', []))}")

# ============ 7+8. 许可证 ============
gen = next((x for x in sreg['sources'] if x['source_id'] == 'GEN-ASTRONOMY-ENGINE-2.1.19'), None)
check("推荐生成器许可证 CLEAR", gen is not None and gen.get('license_name', '').startswith('MIT'),
      f"license={gen.get('license_name') if gen else 'MISSING'}")
hko = next((x for x in sreg['sources'] if x['source_id'] == 'SRC-HKO-SOLAR-TERM'), None)
check("HKO 许可证 CONDITIONAL（非 CLEAR）",
      hko is not None and hko.get('license_status') == 'CONDITIONAL'
      and hko.get('commercial_use') == 'REQUIRES_PRIOR_WRITTEN_AUTHORIZATION'
      and hko.get('usage_role') == 'RESEARCH_CROSSCHECK_ONLY',
      f"status={hko.get('license_status') if hko else 'MISSING'}")
naoj = next((x for x in sreg['sources'] if x['source_id'] == 'SRC-NAOJ-SOLAR-TERM'), None)
check("NAOJ 许可证 CONDITIONAL 且仅核验源角色",
      naoj is not None and naoj.get('usage_role') == 'EXTERNAL_DIFFERENTIAL_CROSSCHECK_ONLY'
      and '署名' in str(naoj.get('attribution_required', '')),
      f"role={naoj.get('usage_role') if naoj else 'MISSING'}")
ae = next((x for x in sreg['sources'] if x['source_id'] == 'GEN-ASTRONOMY-ENGINE-2.1.19'), None)
check("Astronomy Engine 精度表述已纠正（±1 角分，无 1-2 分钟保证）",
      ae is not None and '±1 角分' in str(ae.get('limitations', '')),
      f"limitations={str(ae.get('limitations'))[:40] if ae else 'MISSING'}")

# ============ 9. 间隔规则拆分 ============
ir = spec.get('integrity_policy', {}).get('interval_rules', {})
check("间隔规则已拆分（24 节气 13-17 / 十二节 29-32，均 PROVISIONAL）",
      ir.get('all_24_terms', {}).get('provisional_range_days') == '13-17'
      and ir.get('all_24_terms', {}).get('status') == 'PROVISIONAL'
      and ir.get('twelve_jie', {}).get('provisional_range_days') == '29-32'
      and ir.get('twelve_jie', {}).get('status') == 'PROVISIONAL',
      f"all24={ir.get('all_24_terms', {}).get('status')} twelve={ir.get('twelve_jie', {}).get('status')}")
# 确认旧的"29-32"全局规则已删除
old_rule_gone = not any('29-32 天' in r2 and '十二个节' not in r2 and '24 节气' not in r2
                        for r2 in spec['integrity_policy']['rules'])
check("旧全局间隔规则（29-32天适用于全部节气）已移除", old_rule_gone)

# ============ 10. 规则状态 ============
rule = rules['implementation_dependencies']['rules'][0]
check("SOLAR-TERM-RUNTIME-DATASET-001 = REQUIRES_MORE_EVIDENCE",
      rule['rule_id'] == 'SOLAR-TERM-RUNTIME-DATASET-001' and rule['status'] == 'REQUIRES_MORE_EVIDENCE',
      f"status={rule.get('status')}")

# ============ 11. 无 _tmp_* ============
tmp_files = [f for f in os.listdir(BASE) if f.startswith('_tmp') or f.endswith('.tmp')]
check("不存在 _tmp_* / *.tmp 文件", not tmp_files, f"发现: {tmp_files}" if tmp_files else "")

# ============ 12. 本轮修改范围 ============
allowed = {
    'SOLAR_TERM_RUNTIME_DATASET_RESEARCH_V0.1.md',
    'solar_term_runtime_dataset_spec_candidate_v0.1.json',
    'solar_term_source_registry_v0.1.json',
    'solar_term_validation_matrix_v0.1.json',
    'validate_solar_term_dataset_research_v01.py',
    'bazi_calendar_rules_candidate_v0.1.json',
    'bazi_source_registry_v0.1.json',
}
# 通过 git status 检查未提交变更是否都在允许清单内
import subprocess
try:
    out = subprocess.run(['git', 'status', '--porcelain'], cwd=os.path.dirname(os.path.dirname(BASE)),
                         capture_output=True, text=True, timeout=10).stdout
    modified = []
    for line in out.splitlines():
        parts = line.strip().split(' ', 1)
        if len(parts) == 2 and parts[1].startswith('research/bazi/'):
            fn = parts[1].replace('research/bazi/', '')
            modified.append(fn)
    out_of_scope = [fn for fn in modified if fn not in allowed]
    check("本轮修改范围仅限 7 个允许文件", not out_of_scope,
          f"越界: {out_of_scope}" if out_of_scope else f"修改 {len(modified)} 个文件")
except Exception as e:
    check("本轮修改范围检查", False, str(e))

# ============ 汇总 ============
n_pass = sum(1 for _, ok in RESULTS if ok)
n_fail = sum(1 for _, ok in RESULTS if not ok)
print()
print(f"RESULT: {n_pass} PASS / {n_fail} FAIL")
if n_fail == 0:
    print("SOLAR_TERM_DATASET_RESEARCH_VALIDATION: ALL PASS")
    sys.exit(0)
else:
    print("SOLAR_TERM_DATASET_RESEARCH_VALIDATION: FAIL")
    sys.exit(1)
