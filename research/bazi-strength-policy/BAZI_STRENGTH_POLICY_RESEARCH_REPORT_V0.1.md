# 八字旺衰解释政策协议研究报告 V0.1（Phase 2.6B.2）

状态：`RESEARCH_POLICY_PROTOCOL_NOT_FOR_RUNTIME`

协议：`BAZI_STRENGTH_POLICY_RESEARCH_PROTOCOL_V0_1_0`

tradition_scope：`ZIPING_BAZI`
日期：2026-08-21

## 1. 结论

本轮只完成解释政策的接口设计与冲突建模，没有形成可执行判断协议。Phase 2.6B.1 的五项 `FACT_ONLY` 输出可以作为未来研究输入，但目前缺少已冻结的传统 profile、季节状态映射、土月政策、藏干排序政策与全局互动规则，因此不得生成个人命盘状态。

协议当前唯一允许的结果是政策状态：`POLICY_NOT_SELECTED`、`POLICY_CONFLICT`、`INSUFFICIENT_POLICY`、`OUT_OF_SCOPE`。

## 2. 输入边界

未来政策研究仅可接收以下事实投影：

1. `month_order_fact`
2. `stem_root_presence`
3. `visible_stem_fact`
4. `hidden_stem_presence_fact`
5. `dependency_audit`

所有输入必须来自 `BAZI_STRENGTH_FACT_RUNTIME_V0_1_0` 且 gate 为 `FACT_ONLY`。原始出生资料、真实身份和原始地点不是政策研究必需字段。

## 3. 尚未冻结的政策字段

- 单一传统 profile 的选择与版本
- 五行季节状态映射
- 辰戌丑未等土月口径
- 通根事实的解释范围
- 藏干排序与等级语义
- 合冲刑害及生克制化前置规则
- 多因素综合方法

其中藏干排序受 Foundation `orderSemantics=NONE` 约束；任何排名与数值都被阻断。综合方法不得采用评分、百分比、权重、阈值或默认二元分类。

## 4. 冲突裁决方式

冲突登记共 9 项。每项只能处于 `SCOPED`、`OPEN`、`BLOCKED` 或 `OUT_OF_SCOPE`。不得以多数来源、现代流行度或软件惯例自动裁决；必须明确来源层级、传统 profile、输入语义、反例和边界测试，再进入单独冻结评审。

## 5. 传统体系边界

本研究把材料分为六个 profile family：子平日干参照、月令提纲优先观察、滴天髓整体结构语境、三命通会五行时序框架、现代三因素教学框架、现代数值模型。它们只是边界登记，不代表六套完整可执行算法。

现代三因素教学仅用于交叉核对；现代数值模型明确排除。不同 profile 不得自动混合成所谓统一传统规则。

## 6. 明确禁止

- 不输出身强或身弱
- 不输出旺衰评分或五行百分比
- 不定义权重和阈值
- 不输出喜用神
- 不输出格局
- 不产生个人吉凶、事业、财富、婚姻或未来预测
- 不让 runtime 或页面读取本研究目录

## 7. 后续进入冻结评审的前置条件

1. 选择一个单一、可追溯、版本化的传统 profile。
2. 逐项关闭对应冲突，未关闭项保持阻断。
3. 为每个政策字段登记来源与反例。
4. 建立匿名边界案例，证明单一事实不会被直接升级为状态结论。
5. 另开冻结任务；本研究包本身不可直接进入 runtime。

## 8. 本轮工程边界

只新增 `research/bazi-strength-policy/**`。未修改 `src/**`、`data/frozen/**`、`public/**`、页面或既有 SAFE interpretation。
