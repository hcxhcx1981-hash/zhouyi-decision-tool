# SOLAR_TERM_RUNTIME_DATASET_RESEARCH_V0.1

项目：D:\zhouyi-decision-tool
阶段：Phase 2.1.2
日期：2026-08-06
当前阻断项：`SOLAR_TERM_RUNTIME_DATASET_NOT_FROZEN`

---

## 1. 研究范围

冻结四柱排盘所需的生产节气数据方案。只研究数据来源、核验、精度、许可证与运行时消费协议；不编写八字引擎、不修改应用代码、不生成完整生产数据。

## 2. 当前阻断背景

`SOLAR-TERM-RUNTIME-DATASET-001` 规则状态为 UNRESOLVED。测试 fixture（`solar_term_test_fixture_v0.1.json`）只为回归案例提供少量节气时刻，不能用于完整生产范围。本轮需要裁决唯一数据方案并更新该规则状态。

## 3. fixture、生成器、核验源与运行数据的区别

| 层 | 名称 | 用途 | 是否用于运行时 |
|---|---|---|---|
| 1. 测试 fixture | `solar_term_test_fixture_v0.1.json` | 回归测试少量节气时刻 | 否，仅测试 |
| 2. 生产节气生成器 | astronomy-engine 2.1.19 | 开发阶段生成 1969-2101 静态数据 | 否，运行时调用 |
| 3. 外部权威核验源 | NAOJ（2009-2027）+ HKO（2024） | 抽样验证生成结果 | 否，仅开发期差分 |
| 4. 应用运行时静态数据集 | 后续 CX 生成的静态 JSON | 应用只读 | 是，唯一数据来源 |

四层严格分离，不得混用。

## 4. 权威直接数据方案（方案 A）

逐项评估（详见 `solar_term_source_registry_v0.1.json`）：

- **日本国立天文台 NAOJ**（SRC-NAOJ-SOLAR-TERM）：官方历书数据，24 节气全、分钟级、可批量抓取（本轮实际抓取 456 条），但查询工具**仅覆盖 2009-2027**。
- **香港天文台 HKO**（SRC-HKO-SOLAR-TERM）：官方，24 节气全、分钟级，但**逐年发布 PDF、无历史批量接口**，仅覆盖当年。
- **紫金山天文台**（SRC-PMO-ZIJINSHAN）：官方《中国天文年历》，需采购，无公开批量接口，再分发条款 UNKNOWN，本轮未取得数据。
- **USNO Earth Seasons**（SRC-USNO-EARTHSEASONS）：仅二分二至（4 节气非 24 节气），本轮页面 500 错误不可用。

**结论：没有任何单一权威机构提供 1969-2101 全范围、可批量、可再分发的节气时刻数据。方案 A 无法作为唯一生产数据源。**
（任务要求：若只能提供节气日期而没有时刻，不得作为唯一生产数据源——本方案连"全范围可批量取得"都未满足。）

## 5. 固定生成器方案（方案 B）

候选：**Astronomy Engine (Python) 2.1.19**（GEN-ASTRONOMY-ENGINE-2.1.19）

逐项核准：

- 项目名称：Astronomy Engine（cosinekitty/astronomy）
- 官方仓库：https://github.com/cosinekitty/astronomy
- 固定版本：2.1.19（PyPI 精确锁定，`pip install astronomy-engine==2.1.19`）
- 许可证：MIT（CLEAR）
- 商业使用：允许
- 派生数据：允许生成并分发派生静态 JSON
- 时间尺度：输出 UTC；内部 TT；ΔT 采用内建模型
- 太阳视黄经定义：视黄经（apparent ecliptic of date），节气 = 黄经 15° 整数倍
- 章动/岁差/光行差：基于 VSOP87 行星理论 + NOVAS 算法，内建处理
- 1970-2100 适用性：宣称 -1800 至 +2200，覆盖充分
- 官方宣称精度：官方仓库声明天体位置精度约 ±1 角分；**未官方保证节气时刻误差 1-2 分钟**；节气时刻表现以实际差分为准
- 实际差分结果（Phase 2.1.2.1 脚本逐条重算）：456 点 vs NAOJ（2009-2027），与打印分钟点偏移 max=70s avg=18.3s，over_60=2（2010 HANLU、2018 XIAOXUE，已解释为分钟边界效应），over_120=0，顺序/跨日错误=0，无未解释异常
- 可离线运行：是
- 星历依赖：无大型星历文件（纯算法库）
- 生成环境可复现：pip 固定版本可复现
- 仅开发阶段使用：符合（运行时只读静态 JSON）

备选：**Skyfield + JPL DE421**（SRC-SKYFIELD-DE421）：MIT，理论可行但依赖 ~1MB 星历文件、需自行封装黄经接口，本轮未实测，仅作备份记录。

## 6. 普通农历库方案（方案 C）

候选：sxtwl / 寿星天文历（SRC-SXTWL-LUNAR）

- 许可证：BSD/MIT（多版本不一，CONDITIONAL）
- 算法来源：民间寿星天文历，非官方天文机构
- 节气精度：宣称秒级但无法独立验证
- 是否黑箱：高
- 是否混入命理规则：**是**（节气归属、闰月处理带命理流派倾向，不可关闭）
- 版本稳定性：一般
- 可独立验证：否

**判定：`DO_NOT_USE_AS_PRODUCTION_SOURCE`**（命中"混入不可关闭的命理规则""结果无法独立验证"两条红线）。仅可作为差分辅助参考。

## 7. 许可证比较

| 来源 | 许可证 | 商业使用 | 派生数据 | 再分发 | 状态 |
|---|---|---|---|---|---|
| astronomy-engine 2.1.19 | MIT | 允许 | 允许 | 允许（携带文本） | **CLEAR** |
| Skyfield | MIT | 允许 | 允许 | 允许 | CLEAR（未实测） |
| NAOJ 数据 | 官方单独版权材料（须合理署名，注意第三方版权例外） | CONDITIONAL（须署名） | CONDITIONAL | CONDITIONAL | 核验源（仅外部差分核验） |
| HKO 数据 | 官方公开数据（商业/再分发需事先书面授权） | **REQUIRES_PRIOR_WRITTEN_AUTHORIZATION** | CONDITIONAL | CONDITIONAL | **CONDITIONAL**（RESEARCH_CROSSCHECK_ONLY） |
| sxtwl 系 | BSD/MIT 不一 | CONDITIONAL | CONDITIONAL | CONDITIONAL | REJECTED（混命理） |
| PMO 年历 | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | 未取得 |

## 8. 数据覆盖范围裁决

- **起始年份：1969**（产品出生日期下限 1970-01-01，1970 年初月柱判断需 1969 年末节气）
- **结束年份：2101**（算法验证范围至 2100 年，2100 年末边界需 2101 年相邻节气）
- **缓冲理由**：前后各保留 1 年安全缓冲，保证边界年份的月柱/年柱判断不缺数据
- **保存完整 24 节气：是**
- **每年固定 24 条：是**
- 具体范围：`1969-01-01T00:00:00Z` 至 `2101-12-31T23:59:59Z`

## 9. 时间标准与精度裁决

- **存储标准：UTC**，格式 `YYYY-MM-DDTHH:mm:ssZ`。禁止只保存北京时间/当地时间/公历日期。
- **运行时比较**：出生时刻（IANA 时区 → UTC）与节气 UTC 时刻在同一 UTC 时间轴比较；节气瞬间及之后进入新年柱/新月柱。
- **精度**：生成器秒级（source_precision=second）；权威核验源分钟级（NAOJ/HKO）。
- **NAOJ 分钟显示舍入规则**：官方仅定义"节气为太阳黄经到达特定度数的瞬间"（用語解説），**未发布分钟显示的舍入规则文字说明**；数据模式无法唯一确定四舍五入/截断（两种假设均有反例）→ `authoritative_rounding_policy = UNKNOWN`。与"官方打印分钟点"的偏移**不等于**真实天文误差；分钟级来源不能支持精确秒级误差结论，仅用于分钟标签一致性（四舍五入口径）与粗差检查；不得把 0/60 秒标签差写成真实绝对秒差。
- **同分钟歧义**：用户出生时刻与节气同一分钟时触发 `SOLAR_TERM_SAME_MINUTE_AMBIGUOUS`。
- **不虚构秒数**：核验源分钟级数据不得虚构秒；生成器秒级时刻可保存，但差分按统一口径比较。

## 10. 24 节气登记

完整 24 条见 `solar_term_runtime_dataset_spec_candidate_v0.1.json` 的 `term_registry`（term_id、中文名、黄经、顺序、是否节、对应月支、是否中气）。

四柱引擎只消费十二个"节"（`jie_list_for_four_pillars`）：立春 LICHUN、惊蛰 JINGZHE、清明 QINGMING、立夏 LIXIA、芒种 MANGZHONG、小暑 XIAOSHU、立秋 LIQIU、白露 BAILU、寒露 HANLU、立冬 LIDONG、大雪 DAXUE、小寒 XIAOHAN。不得由页面或业务组件自行判断。

## 11. 官方差分方法

- 生成器：astronomy-engine 2.1.19 按黄经 15° 整数倍顺序搜索 24 节气 UTC 时刻。
- 核验源：NAOJ 官方查询工具（POST year + lst=0 → UTC 分钟级时刻），覆盖 2009-2027。
- 每条差分记录含：year / term_id / generated_instant_utc / authoritative_instant_utc / actual_offset_from_reported_minute_seconds / absolute_offset_from_reported_minute_seconds / minute_label_delta / authoritative_precision / authoritative_rounding_policy / comparison_status / pass / notes。
- 比较口径（Phase 2.1.2.1 修正）：废弃含义错误的 `difference_seconds`（原为分钟标签差换算，非真实秒差）；真实偏移一律由脚本从两个 ISO UTC 时刻重算：`actual_offset = generated UTC - authoritative printed minute UTC`。
- 通过规则：pass = 通过分钟级核验（无跨日错误、无顺序错误、无未解释粗差）；`over_60_seconds` 为观测指标（与打印分钟点偏移超 60 秒），超过 60 秒必须单独核验解释；超过 120 秒且无法解释不得冻结；节气顺序错误或跨日错误立即淘汰。
- 核验源限制：NAOJ 仅覆盖 2009-2027，1969/1970/1980/2030/2050/2099/2100/2101 等年份无官方分钟级数据可批量取得，故差分矩阵以 2009-2027 全节气为主（456 点，远超 135 点下限）。

## 12. 差分结果（Phase 2.1.2.1 修正后，脚本逐条重算）

详见 `solar_term_validation_matrix_v0.1.json`（456 条明细，全部由脚本从 ISO UTC 时刻重算，不信任人工汇总）：

- 研究年份：2009-2027（19 年）
- 研究节气：全部 24 个
- 总差分点数：456
- 秒级来源：0（NAOJ 为分钟级）
- 分钟级来源：456
- 日期级辅助：0
- **真实最大偏移（与打印分钟点）**：70 秒（2010 HANLU）
- **真实平均偏移**：18.3 秒
- **超过 60 秒数量：2**（2010 HANLU +70s、2018 XIAOXUE -69s）
- 超过 120 秒数量：0
- 分钟标签一致（四舍五入口径）：366 / 456；标签差 ±1 分钟：90（秒位进位所致，分钟级核验正常现象）
- 顺序/跨日错误：0
- 未解释异常：0
- pass（分钟级核验协议）：456 / fail：0

**两个超过 60 秒案例结论（均单独核验）**：

1. **2010 HANLU**：生成 2010-10-08T09:27:10Z（复算一致），NAOJ 官方 2010-10-08T09:26:00Z（重抓一致，无抄录错误），黄经 195° 映射正确，偏移 +70s，分钟标签差 +1。判定：分钟边界效应（生成器秒位 + 官方舍入规则未公开），真实天文误差无法确证；**已解释，不构成生成器否决证据**。
2. **2018 XIAOXUE**：生成 2018-11-22T09:00:51Z（复算一致），NAOJ 官方 2018-11-22T09:02:00Z（重抓一致，无抄录错误），黄经 240° 映射正确，偏移 -69s，分钟标签差 -1。判定：分钟边界效应（同前）；**已解释，不构成生成器否决证据**。

**NAOJ 舍入规则调查结论**：官方定义节气为"太阳黄经到达特定度数的瞬间"（用語解説原文），但未发布分钟显示舍入规则文字说明；数据模式（454/456 条与单一舍入假设不完全吻合）无法唯一确定四舍五入/截断 → `authoritative_rounding_policy = UNKNOWN`，按诚实比较协议处理（见第 9 节）。

HKO 未保存可复算明细，**不保留任何 HKO 量化差分结论**（曾作辅助人工查看，不计入正式矩阵）。

## 13. 生产数据 Schema

见 `solar_term_runtime_dataset_spec_candidate_v0.1.json`。单条记录：

```json
{
  "year": 2024,
  "term_id": "LICHUN",
  "term_name_zh": "立春",
  "solar_longitude_degrees": 315,
  "instant_utc": "2024-02-04T08:27:00Z",
  "generator_source_id": "GEN-ASTRONOMY-ENGINE-2.1.19",
  "generator_version": "2.1.19",
  "verification_source_ids": ["SRC-NAOJ-SOLAR-TERM"],
  "source_precision": "second",
  "manually_verified": false
}
```

本轮不生成 1969-2101 完整生产数据。

## 14. 运行时消费规则

- 应用运行时不联网
- 应用运行时不运行天文算法
- 应用运行时只读取版本化静态 JSON
- 数据集缺失年份 → 阻断（SOLAR_TERM_YEAR_NOT_COVERED）
- 数据集缺失节气 → 阻断（SOLAR_TERM_RECORD_MISSING）
- SHA-256 不匹配 → 阻断（SOLAR_TERM_HASH_MISMATCH）
- term_id 重复 → 阻断（SOLAR_TERM_DUPLICATE）
- 时间顺序错误 → 阻断（SOLAR_TERM_ORDER_INVALID）
- 出生时间落在来源无法区分的同一分钟 → 阻断（SOLAR_TERM_SAME_MINUTE_AMBIGUOUS）
- 节气瞬间归入新柱（UTC 时间轴比较）
- 数据集版本与生成器版本必须进入排盘审计结果

## 15. 完整性与哈希规则

见 `solar_term_runtime_dataset_spec_candidate_v0.1.json` `integrity_policy`（规则含）：覆盖 1969-2101、每年 24 条、term_id 每年唯一、UTC 严格递增、黄经 15° 循环、十二节齐全、立春唯一、无重复时刻、无非法 ISO、dataset_id/version/generator 版本存在、许可证 CLEAR、SHA-256 存在、来源登记完整、外部差分完整、fixture 与生产数据分离。**间隔规则已拆分（Phase 2.1.2.1）**：相邻 24 节气候选粗范围 13-17 天（PROVISIONAL）；相邻十二个节（is_month_boundary_jie=true）候选粗范围 29-32 天（PROVISIONAL）；两者最终阈值均须在完整数据集生成后按全范围最小/最大值重新冻结。不得只校验 JSON 语法。

## 16. 更新和版本策略

- 语义化版本；数据集变更必须 bump version 并重算 SHA-256
- 仅当生成器版本升级或官方核验发现系统性偏差时重新生成
- 每次发布记录生成器版本、核验源、差分摘要、生成时间
- 应用必须显式支持数据集版本，否则阻断（SOLAR_TERM_DATASET_VERSION_UNSUPPORTED）

## 17. 风险与限制

- 权威核验仅覆盖 2009-2027（官方可得范围）；1969-2008 与 2028-2101 无官方分钟级数据可差分，依赖生成器算法一致性外推（VSOP87 在该范围的长期精度有理论保障，但无法与官方数据逐点核验）。
- NAOJ 为分钟级且舍入规则未公开（UNKNOWN），秒级仅生成器自证；与打印分钟点的偏移不等于真实天文误差；同分钟边界存在理论歧义，已用阻断码兜底。
- 2010 HANLU、2018 XIAOXUE 两案例偏移超 60 秒（与打印分钟点），已解释为分钟边界效应；若未来取得 NAOJ 舍入规则文字说明，应复核这两个案例的真实误差。
- USNO 本轮不可用；若未来可用可作为日期级辅助核验。
- 若未来官方数据覆盖扩大，应补充差分并 bump 数据集版本。

## 18. 唯一推荐方案（Phase 2.1.2.1 修正后：候选待终审）

**首选生成器候选**：`PINNED_GENERATOR_PLUS_OFFICIAL_CROSSCHECK`

- 生成器：astronomy-engine 2.1.19（MIT，CLEAR，固定版本）——首选生成器候选明确
- 官方核验：NAOJ 2009-2027（456 点，脚本重算：与打印分钟点偏移 max=70s avg=18.3s，over_60=2 已解释，over_120=0，顺序/跨日错误 0）；HKO 仅辅助人工查看、无量化结论
- 覆盖：1969-2101 完整 24 节气（方案级确定）
- 时间标准：UTC（秒级存储）
- 派生静态 JSON：允许提交项目（MIT 允许派生数据）
- 应用运行时：只读静态 JSON，不联网、不计算

否决记录：方案 A（无全范围可批量权威源）、方案 C（sxtwl 混命理规则，DO_NOT_USE_AS_PRODUCTION_SOURCE）。

**当前裁决状态（Phase 2.1.2.1 修正后）**：首选生成器候选明确、许可证主链明确（MIT CLEAR）；但差分统计需按修正后的诚实协议重新终审，`SOLAR-TERM-RUNTIME-DATASET-001` 状态回退为 `REQUIRES_MORE_EVIDENCE`，**暂不允许生成完整生产数据**。

## 19. 是否允许进入下一阶段

**暂不允许。** 本轮为纠错轮：差分统计口径已修正（真实偏移 max=70s avg=18.3s，over_60=2 已解释，NAOJ 舍入规则 UNKNOWN），许可证已纠正（HKO CONDITIONAL / NAOJ 须署名），规则状态回退 `REQUIRES_MORE_EVIDENCE`。等待 ChatGPT 对修正后的统计、协议与许可证重新终审；终审通过后方可决定是否进入下一阶段生成完整静态数据集。

## 20. 尚未解决事项

1. 1969-2008、2028-2101 年份缺乏官方分钟级数据逐点核验（保持外推，列为已知限制）。
2. NAOJ 分钟显示舍入规则未公开（UNKNOWN）：已按诚实比较协议处理（标签一致性+粗差检查）；若未来取得官方文字说明，应复核 2010 HANLU、2018 XIAOXUE 两案例并可能重新冻结口径。
3. USNO 二分二至数据服务恢复后可作为日期级辅助核验补充。
4. 完整生产数据集**暂不允许生成**，待 ChatGPT 重新终审。
5. 应用侧数据集加载与阻断逻辑属应用代码，本轮未实现（Phase 2.2 范围）。

---

## 引用来源索引

| source_id | 名称 | 角色 |
|---|---|---|
| GEN-ASTRONOMY-ENGINE-2.1.19 | Astronomy Engine 2.1.19 | 首选生成器候选（MIT, CLEAR） |
| SRC-NAOJ-SOLAR-TERM | 国立天文台 2009-2027 | 核心官方核验源（仅外部差分核验；须署名） |
| SRC-HKO-SOLAR-TERM | 香港天文台 2024 | 辅助人工查看（CONDITIONAL, RESEARCH_CROSSCHECK_ONLY，无量化结论） |
| SRC-PMO-ZIJINSHAN | 紫金山天文台 | 未取得 |
| SRC-USNO-EARTHSEASONS | USNO 二分二至 | 未取得（页面 500） |
| SRC-SKYFIELD-DE421 | Skyfield 备选 | 备份未实测 |
| SRC-SXTWL-LUNAR | sxtwl 寿星天文历 | DO_NOT_USE_AS_PRODUCTION_SOURCE |
