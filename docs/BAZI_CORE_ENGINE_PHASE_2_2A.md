# 八字确定性四柱纯核心 Phase 2.2A

## 范围与边界

本阶段实现的是“当地民用时间已经标准化之后”的确定性纯核心：年柱、月柱、日柱、时柱、未知时辰三柱模式、单一主阻断码、警告码和审计轨迹。核心采用依赖注入，不自行猜测地点、IANA 时区、UTC 偏移、DST gap/fold，也不读取当前系统日期。

正式 IANA 时区适配器尚未实现；测试使用 Python 3.11 标准库 `zoneinfo` 生成、标记为 `TEST_ONLY_NOT_FOR_RUNTIME` 的固定 fixture。应用页面没有接入核心，继续保持 `NOT_IMPLEMENTED`。

本阶段不包含五行旺衰、十神、喜用神、大运、流年或任何命理解读。

## 正式输入资产

- 规则：`bazi_calendar_rules_v0.1.1.json`，V0.1.1。
- 回归案例：`bazi_calendar_test_cases_v0.1.1.json`，70 例。
- 节气：`solar_terms_1969_2101_v0.1.0.json`，V0.1.0，3192 条正式 `instant_utc`。
- Node 冻结数据加载器只读取正式规则、Manifest 和节气文件，校验固定 SHA-256、版本及记录数；不读取 research 候选或冻结测试案例作为运行数据。

## 算法

- 分钟边界：`HH:mm` 是 `[HH:mm:00, 下一分钟)` 的 UTC 半开区间。立春或月界节令 `instant_utc` 落入该区间时返回 `SOLAR_TERM_SAME_MINUTE_AMBIGUOUS`，不取整或截断节气秒值。已能唯一判定且区间距边界不超过 120 秒时返回 `BOUNDARY_SENSITIVE` 警告。
- 年柱：以正式立春瞬间换年，1984 立春年为甲子锚点。
- 月柱：只使用正式数据中 `is_month_boundary_jie=true` 的记录，月支直接读取 `month_branch_after_boundary`，月干按年干执行五虎遁。
- 日柱：当地民用日期 00:00 换日，以 1949-10-01 甲子日为锚点。纯格里历整数日序与独立 Julian Day Number 整数算法交叉验证。
- 时柱：子时为 23:00—00:59，按同一个 00:00 日界所得日干执行五鼠遁；未知时辰不填充默认时间，普通日期只返回三柱。
- 未知时辰：若当地民用日内存在立春或月界节令，返回 `SOLAR_TERM_TIME_REQUIRED`。

## 验收结果

- 1970-01-01 至 2100-12-31：两套日序算法一致 47,847 / 47,847；2100 年按非闰年处理。
- 冻结案例：状态 70/70、柱结果 39/39、阻断 25/25、断言 6/6、边界警告 20/20、三柱 4/4、月界同分钟阻断 12/12。
- 测试 fixture：`tests/fixtures/bazi_core_normalized_cases_v0.1.1.json`，固定参考日期 2026-08-07，resolver ID 为 `TEST_PYTHON_ZONEINFO_FIXTURE`；fixture 不得被 `src` 引用。
- 冻结 expected 修改数：0。

Phase 2.2A 完成后仍不能由页面生成四柱。下一关键缺口是 Phase 2.2B 的正式、版本化 IANA 时区标准化适配器及其输入协议接入。
