# 八字基础静态规则 V0.2.0 冻结决定

## 决定

本次将 `ZIPING_BAZI` 范围内的 54 个基础静态决策单元冻结为
`data/frozen/bazi_foundation/bazi_foundation_rules_v0.2.0.json`。

本次只冻结数据，不接入 Foundation 运行时，不修改现有四柱、时区、地点、页面或六爻逻辑。

## 输入与证据链

- 候选文件：`research/bazi-foundation/bazi_foundation_freeze_candidate_v0.2.0.json`
- 候选 SHA-256：`8b180184d34e613173342a71b420942305816831d383607474e4e27d50a27add`
- 候选数据集：`BAZI_FOUNDATION_FREEZE_CANDIDATE_V0_2_0`
- 研究协议：`BAZI_FOUNDATION_RESEARCH_V0.2`
- 传统范围：`ZIPING_BAZI`
- 证据快照：`BAZI_FOUNDATION_EVIDENCE_SNAPSHOT_V0_2_0`
- 来源数量：8

正式数据由 `promote_bazi_foundation_freeze_v020.py` 对批准候选执行确定性字段投影生成，禁止人工重新录入54条规则。正式 validator 再以候选投影逐字段核对 Frozen；未来运行时不得读取 `research/`。

## 批准冻结范围

54 个静态决策单元定义为：

- 十天干阴阳与五行属性：10项；
- 十二地支阴阳与五行属性：12项；
- 十二地支藏干成员集合：12项；
- 五行相生与相克有向关系：5 + 5项；
- 十神公式输出：5种元素关系 × 2种阴阳关系，共10项。

Frozen 不需要也不得保存54个人工 `rule` 对象。

## 藏干冻结语义

每个地支只冻结 `hidden_stem_set` 成员集合，`order_semantics` 固定为 `NONE`。JSON数组只是序列化容器，不表达排名、主次、强弱或权重。

午支正式值唯一为：

```text
WU / 午 = {DING, JI}
order_semantics = NONE
```

公开文本中的 `BING + JI` variant 只保留在研究证据链中，按疑似转录或版本异文处理，不进入正式运行规则，也不形成第二套午支数据。

## 十神公式原则

十神仅按日干与目标天干的五行关系、阴阳同异确定：

| 元素关系 | 同性 | 异性 |
|---|---|---|
| `SAME_ELEMENT` | 比肩 | 劫财 |
| `DAY_GENERATES_TARGET` | 食神 | 伤官 |
| `DAY_CONTROLS_TARGET` | 偏财 | 正财 |
| `TARGET_CONTROLS_DAY` | 七杀 | 正官 |
| `TARGET_GENERATES_DAY` | 偏印 | 正印 |

100格十神矩阵仅是研究验证夹具，不是正式真值表。后续确定性查询引擎必须由公式推导，不能维护第二套100格表。历史别名不作为 runtime canonical 名称。

## 仍未冻结的政策与范围

以下2项继续为 `TRADITION_POLICY_REQUIRED`：

1. 藏干顺序或排名；
2. 本气/中气/余气分类协议。

藏干权重和月令用事天数为 `OUT_OF_SCOPE`。本次不冻结旺衰、身强弱、喜用神、格局、调候、神煞、十二长生、合冲刑害吉凶、大运、流年或任何命理解读。

## 后续边界

本冻结完成并通过审核后，下一阶段只允许开发 Foundation 确定性查询引擎：读取正式 Frozen 数据、查询干支基础属性、展开无序藏干成员集合、判定五行关系，并通过公式推导十神。不得自动扩展到解释性命理功能。
