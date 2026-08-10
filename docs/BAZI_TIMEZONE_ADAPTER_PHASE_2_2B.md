# 八字正式时区标准化适配器 Phase 2.2B

## 范围

本阶段建立“原始当地民用时间 → 正式时区标准化 → Phase 2.2A四柱纯核心”的确定性链路。页面没有接入该链路，`NOT_IMPLEMENTED` 保持；城市到时区推断、地理编码、命理解读、五行、十神、大运和流年均不在范围内。

## 冻结来源与可复现性

- 唯一来源：Python `tzdata==2026.3` 官方wheel，IANA TZDB release `2026c`。
- Wheel SHA-256：`dc096730c87af6cab1b171c9d532be840741ff5d459015e7f6947bd7d7e54931`。
- 安装：隔离venv内使用 `--require-hashes --no-deps --no-cache-dir`；不使用系统tzdb、Windows时区库或浏览器Intl。
- run-A与run-B分别从独立venv生成，正式JSON字节完全一致，SHA-256均为 `a15f271214fb2b595856d93c365ed6beb6dfbfbb429d6b3c2fa0fc9b58d7c6c2`。
- 正式数据位于 `data/frozen/bazi_timezone/`，与既有 `data/frozen/bazi/` 隔离。

## 数据集

- 覆盖UTC半开区间：`[1969-01-01T00:00:00Z, 2102-01-01T00:00:00Z)`。
- Zone：598个全部可用IANA key，包括 `Asia/Shanghai`、`America/New_York`、`America/Los_Angeles` 和 `Pacific/Honolulu`。
- Transition：55,642个；gap 27,730个；fold 27,681个。
- Offset范围：-43,200至50,400秒；最大变化量86,400秒。
- 每个zone保存覆盖起点状态及transition前后offset、DST状态和审计用缩写。
- 显式历史transition直接读取锁定wheel中的TZif；未来POSIX规则由同一锁定包的`ZoneInfo`以6小时括定并二分到秒物化。不得使用每日粗采样冒充transition表。

正式验证器逐项验证55,642个transition的前1秒、瞬间、后1秒，并对598个zone执行1969—2101每月固定UTC网格，共954,408项；同时检查18,468个TZif显式transition没有丢失。

## 标准化算法

- 已知时间：将当地`YYYY-MM-DD HH:mm`视为一分钟半开区间，通过冻结UTC interval和offset反求候选。
- 0个候选：`NONEXISTENT_LOCAL_TIME`。
- 1个候选：`READY`。
- 2个候选：未选择fold时为`AMBIGUOUS_LOCAL_TIME`；`EARLIER`和`LATER`按UTC候选先后选择。
- 超过2个候选：抛出`TIMEZONE_DATA_INTEGRITY_ERROR`，不猜测。
- 未知时辰：计算完整当地民用日实际映射的UTC范围，支持23、24、25小时日；整日不存在则阻断，无法表示为单一UTC半开区间则完整性失败。
- `referenceLocalDate`只由调用方提供的`referenceInstantUtc`经冻结数据换算；适配器不读取系统当前日期。
- 地点和时区一致性由上游以`MATCH`、`MISMATCH`或`UNKNOWN`提供；resolver不维护城市映射。

## 回归结果

- 正式70例端到端：状态70/70、柱结果39/39、阻断25/25、断言6/6、警告20/20、三柱4/4、月界同分钟12/12。
- 与Phase 2.2A测试fixture：正常范围61/61一致，已知时间offset 55/55一致。
- New York 2024 spring gap返回`NONEXISTENT_LOCAL_TIME`；fall fold返回两个不同UTC候选。
- Asia/Shanghai 1988历史DST gap返回`NONEXISTENT_LOCAL_TIME`。
- 正式运行时只读静态JSON，不联网、不读取research/tests、不依赖宿主系统tzdb、不调用Intl或Temporal。

## 已知技术债

`AUDIT_RULE_TRACE_DYNAMIC_PENDING`：当前`pillar-core.ts`的`appliedRuleIds`仍是静态完整规则表，不严格表示每一步实际执行轨迹。本阶段按边界要求不修改核心；必须在页面正式接入前改为动态审计轨迹。

## Phase 2.2B.1 非整分钟跳变补丁

正式resolver不再要求整个60秒当地分钟落在单个时区interval内。它先计算当地分钟与每个UTC interval映射出的当地有效区间之交，再将每个非空交集按该interval的offset反算为UTC candidate range；同offset且UTC连续的segment确定性合并。candidate range可以短于60秒。

冻结数据55,642个transition的自动扫描发现1个UTC秒值非零的transition，涉及1个zone；自动构造出的部分有效分钟1/1通过。明确回归中，Africa/Monrovia 1972-01-07 00:43仍为`NONEXISTENT_LOCAL_TIME`，00:44改为`READY`且有效范围为`[1972-01-07T00:44:30Z, 1972-01-07T00:45:00Z)`，00:45为正常完整分钟。该补丁未修改时区数据、公开类型、normalizer或Phase 2.2A核心。

## 下一阶段边界

Phase 2.2C仅可建设正式地点选择与`locationTimezoneStatus`上游协议，不得让自由文本城市驱动时区猜测。页面接入与解除`NOT_IMPLEMENTED`仍需单独裁决。
