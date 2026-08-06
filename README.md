# 周易决策工具 · Phase 2.0

手机优先的本地双模块 H5 骨架，包含生辰八字资料录入与六爻问事。当前重点是产品架构、数据协议和确定性能力边界，不提供完整命理或事情成败预测。

## 当前范围

- 首页 `/`：生辰八字与六爻问事两个模块入口。
- 八字 `/bazi/`：出生资料表单可用；农历转换、四柱排盘和运势规则尚未实现，不生成假命盘。
- 六爻 `/liuyao/`：人工完成六次自下而上逐爻录入；本卦、之卦、动爻、占变路由和乾坤屯原文证据可用。
- 六爻纳甲、世应、六亲、六神、用神、旺衰与进展结局尚未实现。
- 不接 AI、网络占断、数据库、登录、支付、随机起卦或铜钱模拟。

## 本地启动

双击 `start-dev.bat` 启动开发模式（端口 3036；`start-local.bat` 是兼容别名），或在 PowerShell 中运行：

```powershell
npm run dev:3036
```

然后访问 <http://127.0.0.1:3036>。桌面入口继续调用项目内 `start-dev.bat` 并打开新版首页。

## 验证与静态导出

```powershell
npm run validate:rules
npm run typecheck
npm test
npm run lint
npm run build
```

`npm run build` 成功后，纯静态产物位于 `out\`。双击 `preview-out.bat` 可在端口 3037 预览首页、`/bazi/` 和 `/liuyao/`。

当前未部署；Phase 3 之前不继续部署研究。已有 `prepare-test-release.bat` 与发布审计仅作为兼容工具保留，本阶段不执行真实发布。

产品分层、禁止伪造清单和后续阶段见 `docs/PRODUCT_ARCHITECTURE_V0.1.md`。

冻结资料位于 `data/frozen/`，由开发资料包原样复制；应用与本轮改造均不修改这些文件。

## 后续阶段

```text
Phase 2.1：八字历法与四柱规则研究冻结
Phase 2.2：八字确定性排盘引擎
Phase 2.3：六爻纳甲规则研究冻结
Phase 2.4：六爻纳甲确定性排盘引擎
Phase 2.5：解释与运势规则层
Phase 2.6：完整移动端产品整合
Phase 3：本地验收后再研究部署
```

Phase 2.1 的八字历法规则、63 个回归案例与 1969—2101 节气数据已冻结为 V0.1.0。Phase 2.2 确定性排盘引擎尚待开发；当前页面继续保持 `NOT_IMPLEMENTED`，不得生成命盘。
