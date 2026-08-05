# CloudBase 静态托管准备说明

状态：`PREPARED_NOT_DEPLOYED`

本文件只记录 Phase 1.1 的静态产物和未来部署参数。本轮不安装 CloudBase CLI、不登录账号、不读取环境 ID、不上传文件，也不修改或部署 `D:\MBIT`。

## 1. 生成与验收静态产物

在 `D:\zhouyi-decision-tool` 运行：

```powershell
npm ci
npm run typecheck
npm test
npm run lint
npm run build
```

成功后必须存在：

- `out\index.html`
- `out\404\index.html`
- `out\_next\` 静态资源目录

`next.config.ts` 使用 `output: "export"`，因此无需 `next export`；`next build` 会直接生成 `out\`。

## 2. CloudBase 控制台建议参数

未来获得明确部署授权后，可在 CloudBase 静态网站托管中使用：

| 配置项 | 建议值 |
| --- | --- |
| 项目框架 | Next.js |
| Node.js | 24（或与项目验收环境一致的受支持版本） |
| 安装命令 | `npm ci` |
| 构建命令 | `npm run build` |
| 构建产物目录 | `./out` |
| 部署路径 | `/` |

当前只有根页面，没有需要服务端重写的动态路由。静态资源使用 Next.js 内容哈希文件名，适合 CDN 分发。

## 3. 未来 CLI 上传方式（本轮禁止执行）

CloudBase 官方静态托管 CLI 支持上传已构建目录。获得环境 ID 与部署授权后，才可考虑：

```powershell
tcb hosting deploy out -e <CLOUDBASE_ENV_ID>
```

禁止把真实环境 ID、Token、账号信息写入仓库。部署到根路径可能覆盖同名线上文件，执行前必须确认目标环境、备份与回滚方案。

## 4. 微信浏览器发布前检查

- 必须通过 HTTPS 域名访问。
- 用微信内置浏览器分别检查 390px 常规屏和带底部安全区的 iPhone。
- 确认输入框不会触发页面自动放大，按钮触控区域不小于 44px。
- 确认页面无横向滚动、规则结果可完整展开、三爻动仍显示硬阻断。
- 确认控制台无 error，静态资源均从当前 CloudBase 域名成功加载。

## 5. 项目边界

- 本项目静态产物仅来自 `D:\zhouyi-decision-tool\out`。
- 不复用 `D:\MBIT` 的环境、凭据或部署命令，除非未来另有明确授权。
- 不提交 `out\`、`.next\`、`node_modules\`、日志或任何隐私数据。

## 参考

- CloudBase 纯静态项目部署：https://docs.cloudbase.net/hosting/web-hosting-static
- CloudBase 静态托管 CLI：https://docs.cloudbase.net/cli-v1/hosting
- Next.js 静态导出：https://nextjs.org/docs/app/guides/static-exports
