# 八字 Foundation V0.2.0 确定性查询引擎

## 范围

本阶段只提供 `ZIPING_BAZI` 基础静态规则查询：

- 天干、地支的阴阳与五行属性；
- 地支藏干成员集合；
- 两个五行之间的确定性关系；
- 日干与目标天干的十神公式推导；
- 对已确定四柱附加上述 Foundation 属性。

引擎不计算四柱，也不接页面或 Browser runtime。它不提供五行评分、缺失判断、强弱判断、喜忌、格局、运势或命理解读。

## 唯一数据来源

Node 加载器只读取：

- `data/frozen/bazi_foundation/bazi_foundation_rules_v0.2.0.json`
- `data/frozen/bazi_foundation/BAZI_FOUNDATION_MANIFEST_V0.2.0.json`

加载器校验两个文件的固定 SHA-256、数据集 ID、版本、状态、`tradition_scope` 及 Manifest 中的 Frozen 哈希，然后返回深度只读数据。运行时代码不读取候选文件、证据快照或研究矩阵。

## 模块职责

- `foundation-runtime-types.ts`：正式 ID、只读数据和结果类型。
- `foundation-data-node.ts`：Node 文件读取、哈希与元数据校验。
- `foundation-engine.ts`：仅接收已加载数据的纯查询和公式函数。

纯引擎不自行读文件，Node 加载器不重新维护干支属性、藏干、五行边或十神表。

## 查询与错误

严格查询 API：

- `getHeavenlyStemById`
- `getHeavenlyStemByChinese`
- `getEarthlyBranchById`
- `getEarthlyBranchByChinese`
- `getHiddenStemSet`

中文与 ID 的转换索引来自 Frozen 的 `chinese` 字段，只接受 exact match。普通未知输入返回带有 `FOUNDATION_UNKNOWN_STEM` 或 `FOUNDATION_UNKNOWN_BRANCH` 的 Result，不做拼音或模糊猜测。

Frozen 内部数据若出现0个或多个五行关系命中、非法藏干引用或非法十神输出，则 fail-fast 为 `FOUNDATION_DATA_INTEGRITY_ERROR`。

## 藏干集合语义

`getHiddenStemSet` 返回只读成员数组。固定常量 `FOUNDATION_HIDDEN_STEM_ORDER_SEMANTICS` 的值为 `NONE`：数组只是集合的 JSON 序列化结果，调用方不得通过位置推断排名、层级或比例。

四柱输出中的每个地支都包含：

- `hiddenStems`：逐个附加天干静态属性和十神；
- `hiddenStemOrderSemantics: "NONE"`。

## 五行关系与十神

`resolveElementRelation` 只遍历 Frozen 中的 `generates` 与 `controls` 边。五种元素的25种有序组合必须各自唯一命中一种关系。

`deriveTenGod` 的固定流程是：

```text
日干与目标干
→ 从Frozen查询各自五行和阴阳
→ 从Frozen有向边判定元素关系
→ 判定阴阳同性或异性
→ 从Frozen ten_god_formula取得canonical结果
```

源码不保存100格十神真值表。100格矩阵只在测试执行期间由公式生成并校验，每个日干行十类十神各出现一次。日干对自己的“比肩”也经过同一公式，不设特例。

## 四柱 Foundation 输出

`derivePillarsFoundation(data, pillars)` 只接受已经确定的年、月、日、时柱 ID。日柱天干是全部十神的唯一参照。函数不修改输入、不重新排柱，只附加天干、地支及藏干的静态 Foundation 属性。

当 `hour = null` 时，结果的 `hour` 仍为 `null`，不得猜测时柱。

旧四柱核心输出中文时，`foundationPillarFromChinese` 使用 Frozen 反向索引作严格转换，再交给 Foundation 引擎。

## 验证

```powershell
node --experimental-strip-types scripts\validate-bazi-foundation-runtime.mjs
node --test --experimental-strip-types tests\bazi-foundation-engine.test.mjs
```

Runtime validator 检查 Frozen/Manifest 哈希、10天干、12地支、12藏干集合、动态重算的28个藏干成员、25种五行关系、100种十神推导、午支成员集合，以及源码未读取研究目录或加入解释性能力。

## 下一阶段边界

如进入浏览器资产与页面展示阶段，应从同一 Frozen 生成最小浏览器数据，并继续保持无序藏干集合和公式推导。不得在该阶段顺带新增任何解释性命理规则。
