# 周易问事决策工具 · Phase 1.1

手机优先的本地确定性六爻计算与占变取辞 H5 样板。人工输入六个 `6 / 7 / 8 / 9`，计算本卦、之卦、动爻，并按冻结协议 V0.1 执行 0—6 动爻取辞路由。

## 当前范围

- Next.js 16 + TypeScript + App Router
- 手机单列信息流，目标视口 390px，可在微信内置浏览器使用
- 仅人工输入六爻，顺序为自下而上
- 仅接入乾、坤、屯三卦结构化资料
- 三爻动强制显示“主次待图版核准”，不自动给唯一主断
- 不接 AI API、联网占断、数据库、登录、支付或其余 61 卦

## 本地启动

双击 `start-dev.bat`（`start-local.bat` 是兼容别名），或在 PowerShell 中运行：

```powershell
npm run dev:3036
```

然后访问 <http://127.0.0.1:3036>。

## 验证与静态导出

```powershell
npm run validate:rules
npm run typecheck
npm test
npm run lint
npm run build
```

`npm run build` 成功后，CloudBase 可用的纯静态产物位于 `out\`。本轮只准备产物和说明，不执行任何线上部署。

CloudBase 准备步骤见 `docs/CLOUDBASE_STATIC_DEPLOY.md`。

冻结资料位于 `data/frozen/`，由开发资料包原样复制；应用与本轮改造均不修改这些文件。
