# 构建与发布指南

## 本地构建

```sh
pnpm exec vp build
pnpm run dist:dir
```

推送符合 `v*` 格式的 Git 标签会触发 GitHub Actions 多平台正式发布工作流。面向公众分发前，需要完成以下配置：

- Windows 代码签名凭据。
- macOS Developer ID 签名与公证。
- HTTPS 发布/更新服务及安装包资产上传。
- `resources/app-config.json` 内的更新地址。
- 如果使用 ZIP 热更新，配置资源签名公钥和 CI 使用的私钥。
- `resources/icons` 下的应用图标文件。

仓库的 GitHub Actions 工作流提供构建与发布自动化，但**CI 生成的未签名产物不等于经过签名验收的正式安装包**。创建此模板不会自动推送正式版本标签。

## 维护者信息与自定义协议

`package.json` 中的 `replace-before-release@example.com` 是为 deb 打包提供的示例维护者邮箱，正式发布前必须更换为真实邮箱。

安装程序通过 `electron-builder.yml` 的 `protocols` 字段注册 `electron-starter://` 协议。如果重命名应用，应同步修改构建配置和 `src/main/modules/protocol.ts` 中的协议名称。

## 内置 GitHub 更新机制

`electron-builder.yml` 已将更新发布源设置为 `pure-hearts/electron-starter`。

与 `package.json.version` 一致的 `vX.Y.Z` 标签会触发发布工作流，上传安装包、更新元数据和分块映射文件。稳定版本标签用于正式版本；包含连字符的预发布版本标签会标记为预发布。

不要在质量检查、身份配置和签名凭据验证之前推送正式发布标签。需要使用自建 HTTPS 更新源时，可以在 `resources/app-config.json` 中配置地址。

## 正式发布签名门禁

`.github/workflows/release.yml` 要求版本标签与软件包版本完全一致，并检查下列 GitHub Secrets：

- `WIN_CSC_LINK`
- `WIN_CSC_KEY_PASSWORD`
- `MAC_CSC_LINK`
- `MAC_CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

根据 electron-builder 的要求，签名证书可以使用支持的文件地址或经过 Base64 编码的 P12 内容。

开发阶段的 CI 仍然构建**未签名**安装包。只有签名、公证及其实际验证完成后，才能将对应构建视为符合正式发布要求。发布工作流本身不会创建版本标签。

## 已验证的质量检查

GitHub Actions 已能生成 Windows NSIS、macOS DMG/ZIP 和 Linux AppImage/deb 未签名测试产物。

CI 还会验证 Linux 打包版应用启动，并使用临时 HTTPS 服务器完成已签名 ZIP 资源的激活与故障回滚集成测试。

这些产物具有可重复构建和自动检查证据，但**不是经过生产签名的正式发行版**。正式发布工作流在关键凭据缺失时会提前失败，并要求标签与 `package.json.version` 相同。
