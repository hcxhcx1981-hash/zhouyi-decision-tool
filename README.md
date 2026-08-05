# 周易问事决策工具 · Phase 1

本项目是一个完全本地运行的确定性样板：人工输入六个 `6 / 7 / 8 / 9`，计算本卦、之卦、动爻，并按冻结协议 V0.1 执行 0—6 动爻取辞路由。

## 本轮范围

- Next.js 16 + TypeScript + App Router
- 仅人工输入六爻，顺序为自下而上
- 仅接入乾、坤、屯三卦结构化资料
- 三爻动强制显示“主次待图版核准”，不自动给唯一主断
- 不接 AI API、联网搜索、数据库或其余 61 卦

## 启动

双击 `start-local.bat`，或在 PowerShell 中运行：

```powershell
npm run dev:3036
```

然后访问 <http://127.0.0.1:3036>。

## 验证

```powershell
npm run validate:rules
npm test
npm run lint
npm run build
```

冻结资料位于 `data/frozen/`，由开发资料包原样复制。应用不会改写这些文件。
