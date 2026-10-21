# P7：代码签名与应用身份验收前提

正式签名发布必须拒绝仍使用占位维护者邮箱或临时 `appId` 的配置。

Windows 代码签名证书、Apple Developer ID 和 macOS 公证凭据必须通过受保护的 GitHub Secrets 提供，不能提交到代码仓库。

验收证据应包括：

- 已安装 Windows 应用的签名验证结果。
- macOS 应用的签名、公证及 Gatekeeper 验证结果。
- Windows SmartScreen 提示的实际验证记录。

当前发布前置检查采用“条件不满足即拒绝发布”的设计。**这只能证明发布门禁已经实现，并不意味着真实证书签名、公证已经成功。**
