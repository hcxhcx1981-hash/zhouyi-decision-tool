# CloudBase 独立测试环境发布清单

状态：`CHECKLIST_ONLY_NOT_DEPLOYED`

## 发布前

- [ ] 确认使用独立 CloudBase 测试环境。
- [ ] 确认目标不是 MBTI 生产环境。
- [ ] 记录周易项目当前 commit。
- [ ] 取得测试环境的 HTTPS 地址。
- [ ] 使用测试地址运行 `prepare-test-release.bat https://example-test-domain`。
- [ ] 确认 `release:audit` 为 PASS。
- [ ] 确认上传源是当前 commit 生成的 `D:\zhouyi-decision-tool\out\`。

## 人工上传

- [ ] 上传 `out\` 中的完整内容到静态托管根目录。
- [ ] 不上传项目源码。
- [ ] 不上传 `node_modules\`。
- [ ] 不上传 `.env` 或任何真实环境文件。
- [ ] 不覆盖 `miaoduai.cn` 对应环境。
- [ ] 上传前由有权限的人员人工核准环境名称和环境 ID。

## 发布后

- [ ] 首页返回 HTTP 200。
- [ ] `_next` 资源 0 个 404。
- [ ] 控制台 0 error / 0 warning。
- [ ] 完成 390px 和 430px 真机验收。
- [ ] 完成微信内置浏览器验收。
- [ ] 乾卦样例正常核准。
- [ ] 三爻动阻断正常。
- [ ] 未收录卦提示正常。
- [ ] canonical 与 Open Graph URL 均指向测试域名。
- [ ] Footer 不显示错误备案号或空备案区域。
- [ ] 分享信息不包含用户问事文本、六爻数字、卦象结果或古籍长文。
- [ ] MBTI 正式站不受影响。

## 回滚

- [ ] 停止分发测试链接。
- [ ] 恢复或删除测试环境静态版本。
- [ ] 解除测试域名或恢复其原指向。
- [ ] 不修改 MBTI 项目和生产域名。

本清单不包含真实账号、环境 ID、密钥或域名绑定操作，也不授权任何自动部署。
