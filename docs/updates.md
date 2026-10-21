# 更新配置与安全指南

## 一、整包自动更新

整包自动更新默认使用 **GitHub Releases**。`electron-builder.yml` 将发布源配置为 `pure-hearts/electron-starter`；推送正式版本标签后，发布工作流会同时上传可安装文件及更新元数据。

如需改用自建 HTTPS 更新源，可在 `resources/app-config.json` 中设置 `appUpdateUrl`。它会覆盖默认的 GitHub 更新源。

只有存在版本更高、满足更新器要求的稳定签名发行版时，已安装客户端才能完成对应的正式升级验证。必须使用有效签名凭据，从实际安装的旧版本测试升级流程；不能依赖未签名的预发布测试产物代替生产验收。

## 二、仅更新渲染资源的 ZIP 热更新

ZIP 热更新只包含 `dist/renderer` 下的文件。主进程（Main）、预加载脚本（Preload）、Electron 本身以及原生依赖必须通过整包更新才能变更。

操作步骤：

1. 在仓库外生成 Ed25519 签名密钥对。私钥 PEM 文件应离线保存或放入受保护的 CI Secret。
2. 构建安装包前，将对应的**公钥** PEM 文件复制到 `resources/hot-update-public-key.pem`。
3. 在 `resources/app-config.json` 中把 `hotUpdateUrl` 设置为 HTTPS 的 `manifest.json` 地址。
4. 构建渲染资源：`pnpm exec vp build`。
5. 设置签名密钥、更新修订号和资源地址后执行打包：

```sh
HOT_UPDATE_PRIVATE_KEY_PEM_PATH=/secure/private.pem HOT_UPDATE_REVISION=1 HOT_UPDATE_ASSET_BASE_URL=https://your-cdn/updates pnpm run hot:pack
```

6. 将 `release/hot/manifest.json` 和对应 ZIP 上传到配置的 HTTPS 服务器。递增整数修订号即可发布下一次资源更新。
7. 客户端验证清单数字签名、应用版本兼容性和 ZIP 摘要，将资源解压到用户数据目录，并在下次启动时尝试激活。

如果未安装公钥或未配置 HTTPS 地址，热更新不会启用。

正式使用前应覆盖下载中断、恶意 ZIP、签名验证失败、磁盘空间不足、启动失败以及回滚等场景。

**注意：** 公钥可以包含在安装包中，签名私钥绝不能提交到仓库或打进发行版。

## 三、已知限制

- `electron-updater` 的行为随操作系统和安装包类型变化。
- ZIP 热更新不使用差分补丁；每次都包含完整的渲染资源构建结果。
- 热更新已在 Linux 已安装应用的 CI 环境中通过临时 Ed25519 密钥、HTTPS、修订号激活及模拟中断回滚测试。生产密钥、CDN、真实证书校验和其他操作系统环境仍需要发布前实测。
