# MBTI → 周易问事 H5 壳复用与替换方案

状态：`READ_ONLY_DESIGN_ONLY`
基线：周易 `fe97bfa`；MBTI `9feadd7`
结论：唯一推荐先使用独立 CloudBase 测试环境或测试域名，不覆盖 `miaoduai.cn`，不替换 MBTI 正式站。

## 1. 审计范围与安全边界

本报告只依据两个本地仓库中的公开构建配置、页面 metadata、分享代码、Footer、README 与部署说明。未读取 `.env*`、API Key、Token、Cookie、账号配置、用户数据或真实微信号；未登录 CloudBase、Vercel、EdgeOne 或域名后台；未启动服务、执行构建或部署。

只读核准的关键文件：

- 周易：`package.json`、`next.config.ts`、`src/app/layout.tsx`、`src/app/page.tsx`、`src/app/globals.css`、`README.md`、`docs/CLOUDBASE_STATIC_DEPLOY.md`、`.gitignore`。
- MBTI：`package.json`、`next.config.ts`、`src/app/layout.tsx`、`src/app/page.tsx`、`src/app/globals.css`、`src/lib/share.ts`、`src/components/SiteFooter.tsx`、`src/components/SharePoster.tsx`、`README.md`、`docs/edgeone-pages-deploy.md`、`.gitignore`。
- MBTI 未发现公开 CloudBase 部署脚本、`vercel.json` 或 `.vercelignore`。这只表示白名单公开文件中没有证据，不代表线上未使用相应平台。

## 2. 两个项目当前状态

| 项目 | 分支 / HEAD | Git | 静态导出 | 本地静态产物 | 部署资料 |
| --- | --- | --- | --- | --- | --- |
| 周易问事 | `master` / `fe97bfa` | clean | Next.js 16.3.0，`output: "export"`，`images.unoptimized: true` | `out/index.html` 存在 | CloudBase 准备说明存在，状态为未部署 |
| MBTI | `master` / `9feadd7` | clean | Next.js `^15.3.2`，`output: "export"`，`images.unoptimized: true` | `out/index.html` 存在 | 只有 EdgeOne Pages Drop 公开说明；线上平台未核准 |

两者都使用 TypeScript、Next.js App Router 和纯静态导出，但 Next.js 版本、页面路由、业务组件、metadata 与分享内容不同。MBTI 具有 `/test`、结果页、报告页和分享海报等业务链路；周易当前为单首页确定性规则工具，不能用 MBTI 路由树直接替换。

## 3. 域名、分享与部署冲突证据表

状态定义：

- `CURRENT`：当前代码、构建配置与对应公开说明一致。
- `STALE_DOCUMENTATION`：文档陈述已被当前公开代码直接否定，不能作为当前配置使用。
- `CODE_CURRENT_RUNTIME_UNKNOWN`：仓库代码中的当前配置明确，但线上实际生效状态无法由仓库确认。
- `UNKNOWN_REQUIRES_EXTERNAL_VERIFICATION`：必须由平台、DNS 或人工验收确认。

| 检查项 | 文件位置 | 实际值 | 状态 |
| --- | --- | --- | --- |
| 分享 URL | `D:\MBIT\src\lib\share.ts` | `SHARE_TEST_URL = "https://miaoduai.cn/"` | `CODE_CURRENT_RUNTIME_UNKNOWN` |
| metadata 基准 URL | `D:\MBIT\src\app\layout.tsx` | `metadataBase` 使用 `SHARE_TEST_URL`，代码解析为 `https://miaoduai.cn/` | `CODE_CURRENT_RUNTIME_UNKNOWN` |
| canonical URL | `D:\MBIT\src\app\layout.tsx` | 未声明 `alternates.canonical` | `UNKNOWN_REQUIRES_EXTERNAL_VERIFICATION` |
| Open Graph URL | `D:\MBIT\src\app\layout.tsx` | `openGraph.url` 使用 `SHARE_TEST_URL`，代码解析为 `https://miaoduai.cn/` | `CODE_CURRENT_RUNTIME_UNKNOWN` |
| Open Graph 分享图片 | `D:\MBIT\src\app\layout.tsx` | 未声明 `openGraph.images` | `UNKNOWN_REQUIRES_EXTERNAL_VERIFICATION` |
| MBTI CloudBase 部署目标 | 公开部署说明、脚本与配置 | 未发现公开 CloudBase 目标或上传脚本 | `UNKNOWN_REQUIRES_EXTERNAL_VERIFICATION` |
| 周易 CloudBase 准备链路 | `docs/CLOUDBASE_STATIC_DEPLOY.md` | `out/`、根路径 `/`、未来授权后才使用 `tcb hosting deploy` | `CURRENT`（仅指准备方案，不代表已部署） |
| Vercel 说法 | `D:\MBIT\docs\edgeone-pages-deploy.md` | 文档称复制转发链接仍指向 Vercel，但当前 `share.ts` 已指向 `miaoduai.cn` | `STALE_DOCUMENTATION` |
| Vercel 部署配置 | MBTI 根目录公开配置 | 未发现 `vercel.json` 或 `.vercelignore`；不能确认线上是否仍有 Vercel 部署 | `UNKNOWN_REQUIRES_EXTERNAL_VERIFICATION` |
| EdgeOne 上传流程 | `D:\MBIT\docs\edgeone-pages-deploy.md` | 手工上传整个 `out/`，取得平台公网链接 | `UNKNOWN_REQUIRES_EXTERNAL_VERIFICATION`（流程存在，线上使用状态未知） |
| 正式域名 | `D:\MBIT\src\lib\share.ts`、layout metadata | 公开代码唯一明确域名为 `miaoduai.cn`；README 未声明线上平台 | `CODE_CURRENT_RUNTIME_UNKNOWN` |
| `www` 域名 | 白名单公开代码与说明 | 未发现 `www.miaoduai.cn` 配置或状态 | `UNKNOWN_REQUIRES_EXTERNAL_VERIFICATION` |
| ICP 展示 | `D:\MBIT\src\components\SiteFooter.tsx` | Footer 展示京 ICP 备案号并链接工信部备案系统 | `CODE_CURRENT_RUNTIME_UNKNOWN` |
| 公安备案展示 | 白名单公开页面、Footer 与说明 | 未发现公安备案展示代码 | `UNKNOWN_REQUIRES_EXTERNAL_VERIFICATION` |
| CloudBase 默认域名 | 白名单公开说明 | 未记录环境 ID 或默认域名 | `UNKNOWN_REQUIRES_EXTERNAL_VERIFICATION` |
| 静态输出目录 | 两项目 `next.config.ts` 与本地文件 | 均为 Next 静态导出，构建产物为 `out/`；两边 `out/index.html` 均存在 | `CURRENT` |

### 冲突裁决

1. `src/lib/share.ts` 中的 `https://miaoduai.cn/` 是当前仓库代码硬编码的分享 URL，同时驱动 metadata 基准 URL 和 Open Graph URL；它不是环境变量或仅本地 fallback，但仅凭公开代码不能证明它已在线上生效，因此分类为 `CODE_CURRENT_RUNTIME_UNKNOWN`。
2. 部署说明中的 Vercel 只出现在“分享链接仍指向 Vercel”的文字中，已被当前 `share.ts` 的值直接否定；该句分类为 `STALE_DOCUMENTATION`。是否仍存在可访问的 Vercel 部署，公开仓库无法确认。
3. MBTI 仓库公开资料只证明存在 EdgeOne 手工上传 `out/` 的流程，没有 CloudBase 目标或脚本。周易仓库自身已具备独立的 CloudBase 静态产物与未来根目录上传方案，不依赖敏感配置完成构建；实际上传仍需要经授权取得环境 ID，并人工核对目标环境。

**最终冲突结论：当前公开代码能够确认 MBTI 的仓库内分享、metadata 基准和 Open Graph URL 均指向 `https://miaoduai.cn/`，能够确认 Vercel 文档陈述已与代码不一致，但不能确认线上真实托管平台、DNS 指向、分享缓存、备案适用性和 CloudBase 环境；正式迁移前必须由负责人在平台与域名后台人工核验这些事实。**

## 4. 复用分类

### 4.1 可直接复用：`REUSE_DIRECTLY`（6 项）

| # | 项目 | 裁决 |
| --- | --- | --- |
| 1 | App Router 的根 layout / page 组织方式 | 复用框架结构，不复制 MBTI 业务页面 |
| 2 | `output: "export"` | 两项目一致，可继续使用 |
| 3 | `images.unoptimized: true` | 两项目一致，适合纯静态托管 |
| 4 | `out/` 作为不可提交的静态交付目录 | 两项目一致，`.gitignore` 均忽略该目录 |
| 5 | “上传完整 `out/`”的纯静态交付原则 | 平台无关，可用于独立测试环境；目标必须重新核准 |
| 6 | 手机单列、居中限宽的壳层几何 | 可保留这一布局原则，周易继续使用自己的组件与样式 |

### 4.2 需改造复用：`REUSE_WITH_ADAPTATION`（21 项）

| # | 项目 | 必须改造的内容 |
| --- | --- | --- |
| 1 | Next.js 构建链路 | MBTI 声明 Next 15，周易为 Next 16；使用周易锁定版本和测试命令 |
| 2 | 路由结构 | 不复制 MBTI 的测试、结果和报告路由；子路径方案需单独设计 |
| 3 | `basePath` / `assetPrefix` / 静态资源路径 | 仅子路径方案需要；必须重新 build 并验收 `_next` 资源 |
| 4 | CloudBase 上传命令与目标 | 复用静态目录上传思路，不复用环境 ID、账号或根路径假设 |
| 5 | viewport | 周易保留 `device-width`、`initialScale: 1`、`viewportFit: "cover"`；MBTI layout 未提供同等声明 |
| 6 | safe-area | 周易保留自己的 `env(safe-area-inset-bottom)`；MBTI 公开 CSS 未提供可直接复制的实现 |
| 7 | 微信浏览器兼容样式 | 保留周易 16px 输入字号、触控与无横向溢出策略，并在真实微信环境复验 |
| 8 | 按钮触控尺寸 | 复用移动优先原则，具体尺寸继续服从周易既有验收 |
| 9 | 长文本换行与折叠 | 周易原文长度不同，保留 `overflow-wrap` 并按古籍内容复验 |
| 10 | 顶部导航 / 状态栏 | 可参考壳层层级，品牌、状态和动作必须改为周易语义 |
| 11 | Footer 布局 | 可参考居中限宽结构，不复制备案值或 MBTI 品牌内容 |
| 12 | metadata 对象结构 | 可参考 `Metadata`、Open Graph、Twitter 字段组织，所有值重新配置 |
| 13 | 分享函数结构 | 可参考 Web Share API、复制 fallback 和统一常量模式，不复制文案或 URL |
| 14 | 分享 URL | 必须使用经人工确认的周易测试 URL；禁止沿用 `miaoduai.cn` |
| 15 | canonical URL | 周易应显式新增并与最终测试/正式 URL 一致 |
| 16 | Open Graph URL | 必须与当前发布环境一致，切域名时同步更新 |
| 17 | 页面 title / description | 改为周易产品内容，不使用 MBTI 测试文案 |
| 18 | 分享图片基础结构 | 可参考固定尺寸海报思路；图片、文字、链接和可访问路径全部重做 |
| 19 | Footer 品牌名 | 必须改为周易品牌，并与页面 metadata 一致 |
| 20 | ICP / 公安备案展示 | 只在主体、域名和备案适用性人工核准后配置；公安备案当前无公开证据 |
| 21 | 域名配置 | 测试域名、正式域名、裸域与 `www`、HTTPS、跳转和缓存必须逐项核准 |

### 4.3 禁止复用：`DO_NOT_REUSE`（11 项）

| # | 项目 | 原因 |
| --- | --- | --- |
| 1 | MBTI 题库 | 与周易规则业务无关 |
| 2 | MBTI 结果数据和测试结果文案 | 与乾、坤、屯及占变规则无关 |
| 3 | “喵毒”品牌名与品牌文案 | 品牌和产品含义不同 |
| 4 | MBTI 分享标题、描述和转发文案 | 含 MBTI 产品定位，不能改名后继续使用 |
| 5 | MBTI 分享海报的品牌内容与结果卡内容 | 含 MBTI 类型、标签与 CTA，不属于周易产品 |
| 6 | 微信号或私域入口 | 本轮未读取；不得复制或迁移 |
| 7 | 用户数据 | 不属于静态壳复用范围，禁止读取或迁移 |
| 8 | API 配置与环境变量 | 不读取、不复制，周易当前也不需要 |
| 9 | 支付、深度报告或人工发放逻辑 | 超出周易 Phase 1 范围 |
| 10 | MBTI 测试、结果、报告的业务路由树 | 直接复用会污染周易信息架构并制造旧链接冲突 |
| 11 | 未经核准的正式域名硬编码 | `miaoduai.cn` 不能默认授权给周易使用 |

以下事实不是可复用资产，当前统一标记为 `UNKNOWN`：线上真实平台、DNS 当前指向、CloudBase 环境与默认域名、`www` 状态、公安备案状态、ICP 对周易业务及测试域名的适用性、现有社交平台分享缓存。

### 周易必须原样保留的边界

- 冻结规则 JSON、乾坤屯结构化资料、三爻动主次阻断。
- 现有移动交互、静态导出、规则测试与 Git 历史。
- 冻结资料和应用规则不得因壳层迁移而复制、改写或重新实现。

## 5. 三种上线方案比较

| 方案 | 优点 | 主要风险与影响 | 回滚 | 裁决 |
| --- | --- | --- | --- | --- |
| A：直接替换 MBTI 首页 | URL 最短，表面上切换快 | 根目录静态文件被覆盖后 MBTI 首页和既有业务路由可能消失；旧分享链接、缓存、结果页和海报路径可能失效；域名与备案适用性未核准 | 需要恢复旧 commit、旧 `out/`、平台上一版本、域名和分享配置，人工步骤多 | **不推荐** |
| B：使用 `miaoduai.cn/zhouyi/` | 共用域名，MBTI 根首页可保留 | 周易需设置并验证 `basePath`，必要时协调 `assetPrefix`；metadata、分享 URL、404 和 `_next` 路径必须改；CloudBase 子路径上传规则未知；共用 `_next` 与发布目录可能互相覆盖。至少需要修改周易并协调 MBTI 发布链路，平台若不支持隔离上传还需共同打包或调整两个项目 | 可删除子目录，但共享发布与缓存使回滚仍需人工核准 | **当前不推荐** |
| C：独立 CloudBase 测试环境或测试域名 | 与 MBTI 根站、路由、资源和缓存隔离；可直接使用周易已有 `out/`；便于手机、微信、metadata、404 与资源验收 | 需要新环境/测试域名和人工平台配置；上线前仍需核准域名与备案 | 可停用测试环境或解除测试域名，不触碰 MBTI | **唯一推荐** |

### 唯一推荐方案

选择 **方案 C：独立 CloudBase 测试环境或测试域名**。

理由：当前存在分享 URL 与部署说明冲突，线上真实部署状态仅凭公开代码无法完全确认；直接覆盖 MBTI 风险过高；周易已有独立、验收通过的 `out/` 静态产物，可以先隔离验证，再由负责人决定正式域名切换、子路径整合或替换。测试阶段不得覆盖 `miaoduai.cn`，也不得把该域名写入周易代码。

## 6. 正式迁移步骤

以下顺序是未来获得明确授权后的执行门禁，本轮不执行：

1. 记录 `D:\MBIT` 当前 commit，并保存 clean 证明。
2. 备份 MBTI 当前 `out/`，记录校验值、生成时间和恢复位置。
3. 记录 MBTI 当前正式域名、裸域/`www` 状态、分享 URL、canonical、Open Graph URL 与分享图片。
4. 由平台负责人登录后台，人工确认线上实际部署平台、项目/环境、当前版本、DNS 和 CDN 状态。
5. 新建与 MBTI 隔离的 CloudBase 测试环境，不复用生产环境 ID、凭据或根目录。
6. 上传周易项目已经完整验收的 `out/`；上传前再次核准目录来源与 commit。
7. 用测试域名确认 HTTPS、首页 HTTP 200、刷新与直接访问行为。
8. 在 390px 和 430px 手机视口验收无横向滚动、触控尺寸、长原文和底部安全区。
9. 在微信内置浏览器验收输入、核准、三爻动阻断、返回与页面缩放。
10. 验收分享标题、描述、URL、canonical、Open Graph URL 和分享图片；所有字段必须指向测试环境。
11. 由备案负责人验收 Footer 品牌、ICP 适用性、公安备案状态与外链展示；不合格则不切正式域名。
12. 验收 404、`_next` 静态资源 0 个 404、控制台 0 error/0 warning，并覆盖乾卦、三爻阻断和未收录卦。
13. 全程保持 MBTI 线上环境、代码、`out/`、域名和分享配置不变。
14. 测试验收签字后，再单独决策正式域名、独立子域、子路径或替换；不得在同一操作中直接覆盖 `miaoduai.cn`。

## 7. 回滚方案

### 独立测试环境的回滚

1. 停止对测试链接的分发。
2. 在 CloudBase 控制台停用或删除周易测试环境/静态托管版本。
3. 在 DNS 后台删除测试域名解析或恢复其原指向。
4. 清理测试域名的 CDN 与分享缓存，并确认 URL 不再对外提供错误内容。
5. MBTI 无需代码或产物回滚，因为独立测试方案不修改 MBTI。

### 若未来获批覆盖正式站的回滚

1. 将 MBTI 工作树恢复到替换前记录的 commit；禁止用不明确的分支或工作区副本替代。
2. 恢复已备份并校验的 MBTI `out/`。
3. 在实际托管平台恢复 CloudBase/EdgeOne/Vercel 的上一已知正常版本。
4. 在 DNS 后台恢复旧域名指向、裸域/`www` 跳转与 HTTPS 配置。
5. 恢复旧分享 URL、canonical、Open Graph URL、标题、描述与图片，并处理社交平台缓存。
6. 重新验收 MBTI 首页、测试流程、结果/报告路径、分享和备案 Footer。

平台版本恢复、环境删除、DNS 修改、域名绑定、证书、备案判断、CDN/微信分享缓存刷新均必须由有权限的负责人人工确认，不能由仓库脚本自动执行。脚本可以辅助生成校验值、检查 HTTP/资源状态和保存验收结果，但不得自动选择生产环境、覆盖根目录或修改 DNS。

## 8. 风险清单

| 风险 | 等级 | 控制措施 |
| --- | --- | --- |
| 分享代码指向 `miaoduai.cn`，部署文档仍写 Vercel | 高 | 以代码事实与后台人工核验分别记录；修正文档前不得推断线上平台 |
| 线上真实平台、版本和 DNS 未知 | 高 | 正式迁移前由负责人登录平台逐项截图/记录，本报告不代替后台证据 |
| 根目录覆盖导致 MBTI 首页和深层路由消失 | 高 | 禁止方案 A；先用独立环境 |
| 子路径的 `basePath`、`_next`、404 或共享上传冲突 | 高 | 当前不采用方案 B；若重启评估必须建立专项构建与回归测试 |
| `miaoduai.cn`、ICP 与周易业务的适用性未核准 | 高 | 法务/备案负责人书面确认前，不绑定正式域名、不复制备案值 |
| canonical 与 Open Graph 分享图片缺失 | 中 | 周易测试部署前新增独立 metadata 设计并在真实分享环境验收 |
| 社交平台保留旧标题、描述、URL 或图片缓存 | 中 | 使用测试域名隔离；正式切换制定缓存刷新与验证清单 |
| 误带 MBTI 文案、数据、微信号或人工报告入口 | 高 | 按禁止复用清单逐项做内容扫描和人工审核 |

## 9. 下一阶段建议

1. 先由负责人提供不入库的人工核验结果：当前线上平台、项目/环境、生产版本、DNS、裸域/`www`、证书、备案适用性和分享缓存状态。
2. 为周易测试环境单独确定 URL、canonical、Open Graph URL、标题、描述和分享图片；不得使用 `miaoduai.cn` 作为默认值。
3. 获得独立 CloudBase 测试环境部署授权后，再开展一次单独的“构建产物校验 → 上传 → 手机/微信/分享/404验收”任务。
4. 独立环境通过后，再形成正式域名决策单；方案 A 或 B 必须重新评审，不因本报告而自动获批。

## 10. 本轮声明

- 本轮未修改 `D:\MBIT`，未修改其 Git、`out/` 或任何公开/敏感配置。
- 本轮未部署、未登录任何平台后台、未读取 `.env*` 或其他敏感文件。
- 本轮未修改周易应用代码、冻结规则、乾坤屯数据、测试或静态产物。
- 周易项目仅新增本报告，不生成第二份报告、截图、日志或临时交付物。
