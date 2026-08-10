# 八字页面接入前最终收口（Phase 2.2D）

## 1. 结论与边界

确定性主链已具备静态移动端 H5 接入所需的运行数据和审计条件。本阶段没有修改页面，也没有解除 `NOT_IMPLEMENTED`；不包含五行、十神、大运、流年、真太阳时或命理解读。

三套 `data/frozen/` 资产继续是唯一规则与数据真相。`public/bazi-runtime/v0.1/` 仅为 `DERIVED_RUNTIME_ASSETS`，可随正式 frozen 数据重新确定性生成，不构成第二套业务规则。

## 2. 动态 appliedRuleIds

`pillar-core.ts` 使用内部去重 rule trace，按实际控制流第一次触达的顺序追加规则 ID。轨迹不排序、不补齐完整规则表；早期阻断返回后不会加入节气、日柱或时柱等未执行规则。

最低回归覆盖：

- 农历输入：只到 `CAL-GREGORIAN-ONLY-001`，不进入时区、节气或四柱算法。
- location mismatch：记录输入、产品日期范围、IANA 与静态地点映射规则，随后以 `LOCATION_TIMEZONE_MISMATCH` 阻断。
- same-minute：记录冻结节气数据、节气瞬间、分钟半开区间以及实际命中的年/月边界规则，不进入日柱和时柱。
- 未知时辰普通日：记录 `INPUT-UNKNOWN-TIME-002`、`UNKNOWN-HOUR-001` 和节令日检查，不记录时支或五鼠遁。
- 正常四柱：记录实际执行的公历、时区、节气、年/月/日/时柱规则；只有子时才记录子时日干耦合规则。

70 个冻结案例的 status、pillars、blocking、warnings 均保持不变；唯一变化是审计轨迹从静态整表变为动态执行结果。

## 3. 浏览器派生运行资产

生成器 `scripts/build-bazi-browser-runtime.mjs` 只读取三套 frozen 目录，先在同级临时目录完成全部生成与数量检查，再原子替换正式派生目录。Manifest 不含生成时间，run-A/run-B 的 735 个文件逐字节一致。

目录结构：

- `manifest.json`：固定版本、来源 ID/SHA、入口资产和生成政策。
- `location/registry.json`：正式地点登记的语义等价副本，保留 312 个 IANA 目录项和 4 个产品登记映射。
- `timezone/index.json`：598 个 zone ID 到固定数字文件名、SHA 和大小的精确映射。
- `timezone/zones/*.json`：每个文件仅含一个 zone 的完整 initial state 和 transitions，以及正式来源标识。
- `solar/index.json`：1969—2101 年度资产映射。
- `solar/years/*.json`：133 个年度分片，每年严格 24 条，原顺序和 `instant_utc` 不变。

用户提供的 zone ID 永远不能直接拼接路径；loader 只能从已校验 index 精确查找固定资产路径。年度节气按出生年加载 `Y-1/Y/Y+1`（存在时），最多 72 条。

## 4. 浏览器 loader 与完整性

`browser-runtime-loader.ts` 只使用调用方注入的同源 `fetchImpl`、Web Crypto SHA-256 和静态 JSON，不引用 `node:fs`、系统 tzdb、`Intl.DateTimeFormat`、Temporal 或外部 API。Manifest SHA 固定在 loader 中，每个 index/chunk 的 SHA 与字节大小逐个验证。

离线 fake-fetch 验证按以下顺序执行：location → 单一 timezone chunk → 相邻年度 solar chunks → Phase 2.2B normalizer → Phase 2.2A core。正式 70 案例 Browser/Node 逐例完整一致，包括动态 `appliedRuleIds`、location audit 和 timezone result。

时区专项保持：纽约 spring gap、fall fold EARLIER/LATER、上海历史 DST gap、Monrovia 1972-01-07 00:44 的部分分钟区间 `[00:44:30Z, 00:45:00Z)`。

## 5. 体积审计

| 项目 | 字节数 |
|---|---:|
| 完整 timezone frozen 源 | 16,679,716 |
| 完整 solar frozen 源 | 1,768,636 |
| 浏览器 location | 70,641 |
| timezone index | 105,842 |
| 最大 zone chunk | 59,736 |
| Asia/Shanghai chunk | 2,635 |
| 最大 solar 年度 chunk | 10,835 |
| CN-MAINLAND / 2024 典型总加载 | 234,376 |

典型加载包含 manifest、location、timezone index、Asia/Shanghai 单一 chunk、solar index 和 2023—2025 三个年度 chunk，显著低于完整 timezone 数据并低于 300KB 门槛。

## 6. 页面契约与下一阶段

`bazi-page-contract.ts` 定义未来页面草稿到 `RawBaziDeterministicInput` 的纯转换。调用方必须显式提供 `referenceInstantUtc`；契约不会调用当前时间、猜测城市/时区、默认 UTC/Asia/Shanghai 或填充未知时辰。gender 被协议保留，但当前四柱核心不消费。

旧 `form.ts` 接口继续保留，阻断文案已修正为“确定性规则和运行链已内部冻结，但页面尚未接入”。下一阶段可以开始正式页面接入，但必须继续保持：注册地点与 Manual IANA 分流、fold 明确选择、自由文本 display-only、错误码原样展示、无命理解读扩展，并在页面真正完成全链验收前保留 `NOT_IMPLEMENTED` 回退路径。
