# 八字地点选择与 IANA 时区一致性协议（Phase 2.2C）

## 1. 目的与边界

本层只负责把明确的地点选择解析为正式 IANA 时区绑定，再依次交给 Phase 2.2B 时区标准化层和 Phase 2.2A 四柱纯核心。它不改变既有核心结果结构，也不读取研究候选数据。

V0.1 不建设全球城市数据库。自由文本 `locationName` 仅供界面展示和审计，不用于推断城市、国家、行政区或时区；系统不做 GPS、IP 定位、地理编码、联网搜索或城市模糊匹配。精确经纬度不是当前四柱计算的必要输入。

## 2. 正式数据来源

全球 IANA 选择目录只由锁定的 Python `tzdata==2026.3` wheel 中 `zone1970.tab` 逐字节生成，国家代码由同一 wheel 的 `iso3166.tab` 核验，对应 IANA release 为 `2026c`。wheel SHA-256 为 `dc096730c87af6cab1b171c9d532be840741ff5d459015e7f6947bd7d7e54931`。

源快照位于 `research/bazi_location/sources/`，各文件哈希登记于 `SOURCE_SNAPSHOT_SHA256.txt`。正式登记位于 `data/frozen/bazi_location/`。312 条 `zone1970` 记录全部引用现有 598-zone 正式时区数据，缺失数为 0；249 个国家代码、坐标范围和唯一性均由独立验证器重算。

每条 IANA 目录项使用 `IANA:<zone_id>` 作为 `location_id`。源坐标仅作为来源元数据和未来选择界面的提示，Phase 2.2C 运行层及 V0.1 四柱算法均不读取坐标。真太阳时继续为 `OUT_OF_SCOPE`。

## 3. 两种选择模式

### REGISTERED_LOCATION

解析器只按正式 registry 的 `locationId` 精确查找时区。若提供 `claimedIanaTimezone`，与登记值相同为 `MATCH`，不同为 `MISMATCH`；不存在的 `locationId` 返回 `LOCATION_REQUIRED`，不得自动降级为手动模式。

冻结的四项产品登记为：

| location_id | zone_id | mapping_class |
|---|---|---|
| `CN-MAINLAND` | `Asia/Shanghai` | `FROZEN_PRODUCT_LOCATION_POLICY` |
| `US-NY` | `America/New_York` | `FROZEN_TEST_AND_PRODUCT_MAPPING` |
| `US-LA` | `America/Los_Angeles` | `FROZEN_TEST_AND_PRODUCT_MAPPING` |
| `US-HNL` | `Pacific/Honolulu` | `FROZEN_TEST_AND_PRODUCT_MAPPING` |

### MANUAL_IANA

没有正式登记项时，用户必须显式选择 598-zone 正式数据内的 IANA zone。合法选择的 `locationTimezoneStatus` 为 `UNKNOWN`，其含义是“没有静态地点映射可比对”，不是错误；缺失或非法 zone 返回 `TIMEZONE_REQUIRED`，不会回退到 UTC、上海或系统时区。

## 4. 串联与审计

固定顺序为：location resolver → `normalizeBaziTime` → `calculateBaziPillars`。外层结果包含 `locationAudit`、`timezoneAudit` 和未改动的 `coreResult`。地点审计记录 registry ID/版本、选择模式、地点 ID、匹配状态、解析后的 IANA zone 与来源类型。

C063 通过 `CN-MAINLAND → Asia/Shanghai` 与声明的 `America/New_York` 自然产生 `MISMATCH`，最终阻断码为 `LOCATION_TIMEZONE_MISMATCH`；没有 case ID、描述或“中国大陆”等文本特判。

自由文本不变量覆盖“北京、上海、abc、火星、任意测试字符串”：在相同登记 ID 和声明时区下，5/5 均为 `MATCH`，UTC range 与四柱完全一致；声明 `America/New_York` 时 5/5 均为 `MISMATCH`。

## 5. 验收结果与后续边界

正式 70 案例经过新地点层、正式时区层和四柱核心后结果保持：70/70 status、39/39 pillars、25/25 blocked、6/6 assertions、20/20 warnings、4/4 three pillars、12/12 same-minute；冻结 expected 修改为 0。

页面本轮不接入新 pipeline，八字页继续保持 `NOT_IMPLEMENTED`，不显示四柱。`AUDIT_RULE_TRACE_DYNAMIC_PENDING` 仍是页面正式接入前必须解决的技术债。下一阶段只能进行 Phase 2.2D 页面接入前收口；不得在本阶段顺带开发页面、真太阳时、命理解读或运势规则。
