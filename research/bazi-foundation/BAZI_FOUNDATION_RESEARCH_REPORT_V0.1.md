# 八字基础命理静态规则研究报告 V0.1（Phase 2.4A.1 证据收口版）

状态：`RESEARCH_CANDIDATE_NOT_FOR_RUNTIME`

版本说明：本文件为 Phase 2.4A 基础研究报告；Phase 2.4A.1 在既有 8 来源与 `research/bazi-foundation/` 产物上完成证据收口，收口记录见第 11 节。全研究 `tradition_scope = ZIPING_BAZI`。

## 1. 审计范围与边界

本报告只研究十天干、十二地支的阴阳五行，十二地支藏干成员，以及日干对目标天干的十神确定性关系。它不是命理解读，也不包含旺衰、身强身弱、喜用神、格局、调候、神煞、纳音应用、十二长生、合冲刑害吉凶、大运、流年或人生判断。

资料采用 8 个来源：L1 经典文献 4 个，L2 有明确著者或研究主体的近现代资料 4 个。核心依据包括[《五行大义》](https://ctext.org/wiki.pl?chapter=73926&if=gb&remap=gb)、[《五行精纪》](https://ctext.org/wiki.pl?chapter=727777&if=gb&remap=gb)、[《渊海子平》](https://ctext.org/wiki.pl?chapter=296619&if=en&remap=gb)、[《白虎通德论·五行》](https://ctext.org/text.pl?if=gb&node=52956&show=parallel)、[《命理探源》](https://ctext.org/wiki.pl?chapter=419625&if=en&remap=gb)和[《千里命稿》](https://ctext.org/wiki.pl?chapter=447084&if=en&remap=gb)。网络转载数量不作为共识证据。

## 2. 结论总表

| 检查项 | 裁决 | 产品建议 |
|---|---|---|
| 十天干阴阳五行 | 10 项一致，可确定性机器化 | `PROPOSE_FREEZE` |
| 十二地支阴阳五行 | 12 项一致，可确定性机器化 | `PROPOSE_FREEZE` |
| 十二地支藏哪些干 | 成员集合稳定，可确定性机器化 | `PROPOSE_FREEZE` |
| 藏干顺序 | 数组顺序无语义（`NONE_V0_2`）；歌诀列举顺序不等于统一主次顺序 | `TRADITION_POLICY_REQUIRED` |
| 本气/中气/余气 | 术语存在，但完整标签与排序协议需要选定体系 | `TRADITION_POLICY_REQUIRED` |
| 藏干权重 | 百分比、分值、用事天数并非统一体系 | `OUT_OF_SCOPE` |
| 五行相生相克 | 两个五边关系图稳定，无吉凶含义 | `PROPOSE_FREEZE` |
| 日干对天干十神 | 可由五行方向与阴阳同异统一推导（公式见第 6 节） | `PROPOSE_FREEZE` |
| 十神正偏冲突 | 未发现会改变公式输出的可靠来源冲突；别名仅证据字段 | 显示名 canonical 固定 10 个 |
| 午支藏干 | 收口 `午={丁,己}`；《命理探源》公开转录"丙己"登记为疑似转录/版本异文 | `PROPOSE_FREEZE`（变体不阻断） |
| 10×10 矩阵 | 100/100 有值、每行十神各一次、与公式重算完全一致 | 由公式生成，不作硬编码表 |

## 3. 天干与地支基础属性

《五行大义》明确列出甲丙戊庚壬为阳、乙丁己辛癸为阴，并给出甲乙寅卯木、丙丁巳午火、戊己辰戌丑未土、庚辛申酉金、壬癸亥子水；《五行精纪》对干支阴阳交叉印证。因此：

- 十天干阴阳五行 10 项均为 `STATIC_CONSENSUS`。
- 十二地支阴阳五行 12 项均为 `STATIC_CONSENSUS`。
- 这些字段只表达分类，不附带性格、身体、职业、象义或吉凶。

## 4. 藏干核验与反证

《渊海子平》的地支藏遁歌与《千里命稿》等资料对“藏哪些干”的成员集合实质一致，支持冻结十二支成员集合。数据文件中的数组不承担排序语义；`main_hidden_stem`只是候选主藏表达，正式冻结前仍应与选定的气类政策一并复核。

发现的真实政策差异如下：

1. **列举顺序与主次顺序不同。** 例如《渊海子平》歌诀列丑为“癸辛己”，而主气优先的常见表达为“己癸辛”；辰、巳、未、戌也存在同类现象。若把原文顺序直接当作排名，机器输出会不同。
2. **本气/中气/余气未形成当前可直接移植的统一 Schema。** 尤其一藏、二藏、三藏地支怎样统一标空值、次序和术语，需要明确传统口径。
3. **数值权重不是成员规则。** 60/30/10、70/20/10、分值或月令用事天数代表不同模型；本轮没有可靠依据把其中任何一种定为通用事实。
4. **午支转录疑点（Phase 2.4A.1 收口）。** 《命理探源》公开转录页出现"午宫丙火并己土"，与《渊海子平》及通行的丁己体系冲突。收口处理：保留该异常证据，标记 `LIKELY_TRANSCRIPTION_OR_EDITION_VARIANT`（疑似转录或版本异文），**不得删除、不得称为已确认流派差异**；同书（《命理探源》）后续理论章节及命例遵循丁己体系，与《渊海子平》一致。午支正式候选收口为 `午={丁,己}`（`PROPOSE_FREEZE`），变体不产生第二套运行时规则。

因此，下一版可以冻结"每支藏干成员集合"，但藏干排序、气类标签和权重必须继续阻断。`hidden_stems_order_semantics = NONE_V0_2` 明确数组顺序无语义。

## 5. 五行关系图

相生关系固定为：木→火→土→金→水→木。

相克关系固定为：木→土、土→水、水→火、火→金、金→木。

这 10 条边只用于关系判定，不表示“吉”“凶”“强”“弱”。

## 6. 十神统一推导协议（Phase 2.4A.1 公式正式化）

设日干为 `day_stem`，目标天干为 `target_stem`。先取得两者五行和阴阳，再以日干为参照判定五行方向。正式公式（`ten_god_rules.json` 的 `formula` 字段，5 类关系 × 2 极性）：

| 关系类型 | 同性（SAME_POLARITY） | 异性（DIFFERENT_POLARITY） |
|---|---|---|
| SAME_ELEMENT（同五行） | 比肩 | 劫财 |
| DAY_GENERATES_TARGET（日干生目标） | 食神 | 伤官 |
| DAY_CONTROLS_TARGET（日干克目标） | 偏财 | 正财 |
| TARGET_CONTROLS_DAY（目标克日干） | 七杀 | 正官 |
| TARGET_GENERATES_DAY（目标生日干） | 偏印 | 正印 |

canonical 显示名固定为：比肩、劫财、食神、伤官、偏财、正财、七杀、正官、偏印、正印。历史别称（七杀：偏官、七煞；偏印：枭神、倒食；劫财：败财）仅作证据字段（`aliases_evidence_only`），runtime 未来只能输出 canonical_name。

该公式不需要月份、出生时辰、性别、旺衰、大运或任何解释。别名不改变关系格子，不需要第二套计算规则。

地支不得直接粗暴映射为一个十神。正确流程只能是：地支 → 藏干成员集合 → 每个藏干分别按上述公式推导十神。

## 7. 10×10 自校验（Phase 2.4A.1 重新生成）

`ten_god_matrix.json` 由 `ten_god_rules.json` 的 `formula` **程序生成**（`validate_bazi_foundation_v02.py` 重新推导并比对），非人工填写真值表、不作运行时硬编码。验证条件：

- 100/100 单元格非空（null=0）；
- 每个日干的十个目标干恰好产生十类十神，各一次；
- 矩阵与公式重算逐格完全一致（任何手改都会在验证脚本中失败）；
- 五行生克方向和阴阳同异均与规则表一致；
- 代码不应维护 100 格独立真值表。

## 8. 候选计数（Phase 2.4A.1 真实重算）

按"独立候选决策项"去重计数，冲突登记对同一政策的交叉引用不重复计数；计数由 `validate_bazi_foundation_v02.py` 程序从全部 rules 数组统计（不硬凑）：

- `PROPOSE_FREEZE`：**54 条**（天干 10、地支 12、藏干成员 12、五行关系 10、十神关系 10）。
- `TRADITION_POLICY_REQUIRED`：**2 条**（藏干顺序、本气/中气/余气）。
- `OUT_OF_SCOPE`：**1 条**（藏干数值权重）。
- `REQUIRES_MORE_EVIDENCE`：**0 条**（午支转录异常已收口为变体记录，见第 11 节，不再作为候选决策项）。

另登记：午支"丙己"公开转录异常为 `LIKELY_TRANSCRIPTION_OR_EDITION_VARIANT`（证据保留，不计入候选决策项）；月令用事天数体系为 `OUT_OF_SCOPE` 冲突登记。

## 9. 下一阶段裁决建议

建议 ChatGPT 对 54 条静态候选执行正式冻结审核；在冻结前补做来源版本留档与 JSON Schema/哈希清单。即使静态候选获准，也只能开发：干支阴阳五行查询、藏干成员集合展开（顺序无语义 `NONE_V0_2`）、五行关系判定和日干对天干十神推导（canonical 名）。

当前明确禁止 CX 直接开发：藏干权重、本中余气自动排名、旺衰强弱、身强身弱、喜用神、格局、调候、神煞、纳音应用、十二长生、合冲刑害吉凶、大运、流年，以及任何财运、婚姻、事业、健康、性格、吉凶或 AI 命理解读。

## 10. 安全声明

本轮没有修改 `data/frozen/**`、`src/**`、页面、四柱核心、时区/地点算法、浏览器运行资产或六爻业务；没有安装依赖、启动应用、部署或接入运行时。

## 11. Phase 2.4A.1 证据收口记录

本收口只基于既有 8 个来源（`sources.json`）与 `research/bazi-foundation/` 现有产物，未扩大搜索。

| # | 收口项 | 结果 |
|---|---|---|
| 1 | tradition_scope | 全部 8 个 JSON 顶层及 57 条规则统一为 `ZIPING_BAZI` |
| 2 | 午支正式候选收口 | `午={丁,己}`（`PROPOSE_FREEZE`）；保留《渊海子平》丁己证据、《命理探源》公开转录"丙己"异常（标记 `LIKELY_TRANSCRIPTION_OR_EDITION_VARIANT`）、同书后续理论及命例丁己证据；不删除、不称流派差异 |
| 3 | 藏干数组顺序语义 | `hidden_stems_order_semantics = NONE_V0_2`（数组顺序无语义） |
| 4 | 藏干顺序 | `TRADITION_POLICY_REQUIRED`（继续阻断） |
| 5 | 本气/中气/余气 | `TRADITION_POLICY_REQUIRED`（继续阻断） |
| 6 | 藏干权重 | `OUT_OF_SCOPE`（继续阻断） |
| 7 | 十神 canonical | 固定 10 个：比肩、劫财、食神、伤官、偏财、正财、七杀、正官、偏印、正印 |
| 8 | aliases | 仅证据字段：七杀{偏官,七煞}、偏印{枭神,倒食}、劫财{败财}；runtime 只输出 canonical_name |
| 9 | 十神公式 | 正式化 5 类关系 × 2 极性（见第 6 节 `formula` 字段） |
| 10 | 10×10 矩阵 | 由公式程序重新生成：100/100 无 null、每行十神各一次、与 `ten_god_matrix.json` 逐格一致（`validate_bazi_foundation_v02.py` 验证 13/13 PASS） |
| 11 | 真实状态数量 | 程序统计（rules 层面 57 条）：PROPOSE_FREEZE 54 / TRADITION_POLICY_REQUIRED 2 / OUT_OF_SCOPE 1 / REQUIRES_MORE_EVIDENCE 0；未硬凑 54/3/1/2 |
| 12 | 验证工具 | 新增 `validate_bazi_foundation_v02.py`（13 项检查全部 PASS） |

本轮未 commit；未修改 `src/**`、`data/frozen/**`、`public/**`。

## 12. Phase 2.4A.2 Schema 与证据硬化记录

54 条静态规则已通过 ChatGPT 语义审核进入 `FREEZE_CANDIDATE`。本轮只做正式冻结前的数据结构、验证独立性与证据留档，不重新研究。

| # | 硬化项 | 结果 |
|---|---|---|
| 1 | 藏干成员正式字段 | `hidden_stem_set` 12/12（`business_order_semantics=NONE`，`serialization_order=CANONICAL_STEM_ID_ORDER`，数组仅 JSON 容器） |
| 2 | main/other 退出冻结 | `freeze_projection=false`；`ordered_hidden_stems` 保持 null；candidate 不含这些字段 |
| 3 | earthly_branches 降级 | `hidden_stem_ids_policy.derived_reference_only=true`；validator 集合比对与权威 set 12/12 一致 |
| 4 | 正式 Freeze Projection 候选 | `bazi_foundation_freeze_candidate_v0.2.0.json`（`FREEZE_CANDIDATE_NOT_RUNTIME`，10 干/12 支/12 藏干集/5+5 边/5×2 公式/10 canonical） |
| 5 | JSON Schema | `bazi_foundation_freeze_candidate_v0.2.0.schema.json`（数量、enum、additionalProperties=false） |
| 6 | validator 数据驱动 | 不再硬编码 STEM_YY/STEM_EL/GEN/CTL；从 heavenly_stems.json / five_element_relations.json / formula 读取，重建矩阵并比对 |
| 7 | 十神 rules↔formula | 10 条 TEN-GOD rule 逐条 `formula[element_relation][polarity_relation]==ten_god` 10/10 一致 |
| 8 | 藏干双源 | earthly_branches.hidden_stem_ids vs hidden_stems.hidden_stem_set 12/12；FREEZE_CANDIDATE_DUPLICATE_HIDDEN_STEM_SOURCE=0 |
| 9 | Scope 完整性 | 所有 rules/policy/conflicts/candidate/snapshot 均 `tradition_scope=ZIPING_BAZI`；修复 CONFLICT-HIDDEN-WU-TEXT 缺失字段 |
| 10 | 证据留档 | `evidence_snapshot_v0.2.0.json`：8 来源最小证据定位 + 午支三证据；HAKKA 本轮 SSL 超时记 `SNAPSHOT_RETRIEVAL_UNAVAILABLE`（不换来源） |
| 11 | 证据哈希 | `FOUNDATION_EVIDENCE_SHA256.txt`（13 条目） |
| 12 | Validator | 30/30 PASS（29 项 + 矩阵一致性）；状态数量真实重算 54/2/1/0 |

本轮未 commit；未修改 `src/**`、`data/frozen/**`、`public/**`；未开发 runtime。
