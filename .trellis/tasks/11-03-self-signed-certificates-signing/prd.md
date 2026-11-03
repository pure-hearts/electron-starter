# PRD: 为三端生成个人证书并配置本地代码签名构建体系

## 1. 目标与背景 (Goal & Background)

在桌面应用开发、企业内部私有化部署、离线测试与局域网分发场景中，商业证书（如 DigiCert、Sectigo EV 代码签名证书或 Apple Developer Program 开发者账号）具有高昂的年费和审核门槛。开发团队需要一套**完全自给自足、开箱即用的跨平台个人证书生成与签名集成方案**：

1. **三端全覆盖**：分别为 Windows、macOS 与 Linux 生成标准、合法的个人自签名证书与密钥对；
2. **本地项目存储与安全隔离**：证书保存在项目的专项目录中（如 `certs/`），且具备严密的安全防护，杜绝私钥误提交至 Git 仓库；
3. **与打包流程深度整合**：`electron-builder` 在构建三端安装包（NSIS、DMG/ZIP、AppImage/deb）时，能自动或通过配置感知并使用本地个人证书执行代码签名；
4. **易用的一键工具链**：提供自动化脚本，支持一键生成全套证书、查看证书指纹、导出公钥证书，并附带针对目标系统（Windows/macOS）信任自建证书的操作指引。

---

## 2. 核心约束与现状调研 (Constraints & Evidence)

1. **操作系统签名机制差异**：
   - **Windows**：依赖 Authenticode 签名。支持 `.pfx` (PKCS#12) 格式证书，要求包含代码签名增强密钥用法（Code Signing EKU: `1.3.6.1.5.5.7.3.3`）。`electron-builder` 原生支持配置 `certificateFile` 与 `certificatePassword` 或环境变量 `CSC_LINK`。
   - **macOS**：苹果生态强制依赖 Keychain 中的代码签名身份或 `.p12` 签名包。自签名证书格式须包含 Apple Code Signing 扩展（OID `1.2.840.113635.100.1.1`），支持本地 `codesign` 静态验签，免去 `adhoc` 伪签名的不稳定隐患（注：无法通过苹果云端 `notarize` 公证，但可在受信任或企业离线环境中顺畅运行）。
   - **Linux**：支持基于 GPG/PGP 的二进制与包签名（用于 AppImage 嵌入式摘要验证与 deb 发行包验证）。
2. **Git 安全红线**：
   - 项目 `AGENTS.md` 明确规定：“Keep private signing keys, certificates, and release credentials out of git.”
   - 个人证书及私钥必须放入 `.gitignore` 保护的 `certs/` 目录，禁止任何带私钥的 `.pfx`、`.p12`、`.key`、`.pem`、`.gpg` 提交到版本库，仅保留安全模板与生成脚本。
3. **构建流程无缝兼容**：
   - 当开发者尚未生成个人证书时，构建脚本不应报错中断，需平滑降级（如无证书时继续使用免签名构建）；当证书就绪时，自动或按需启用签名。

---

## 3. 详细需求拆解 (Requirements)

### 需求 1：跨平台个人证书与密钥一键自动化生成脚本

- 新增 `scripts/generate-self-signed-certs.mjs`（或对应通用跨平台脚本）：
  - **Windows 证书**：生成 RSA 4096 位的自签名根 CA 与代码签名证书，导出为带有自定义或默认安全密码的 `certs/windows/code-sign.pfx` 以及供用户/客户机安装信任的公钥证书 `certs/windows/root-ca.cer`；
  - **macOS 证书**：生成符合 macOS 代码签名规范的自签名身份证书，导出为 `certs/macos/mac-codesign.p12` 及公钥 `certs/macos/mac-root-ca.cer`，并提供将证书快捷导入并信任至本地登录钥匙串的辅助命令；
  - **Linux 证书/密钥**：生成专用的 GPG 自动化签名密钥对（保存在 `certs/linux/`），导出公开 GPG 密钥与私钥，为后续包校验提供标准凭证；
  - **热更新公私钥联动**：集成原有的 Ed25519 热更新密钥对生成逻辑，统一输出至 `certs/hot-update/` 或与项目原有热更新体系协同。
- 在 `package.json` 中配置便捷命令：`pnpm cert:generate` 与 `pnpm cert:clean`。

### 需求 2：项目文件夹证书结构与 Git 安全防护

- 在项目根目录规划规范的 `certs/` 目录：
  - `certs/.gitkeep`（允许空目录提交）；
  - `certs/README.md`（说明各端证书的作用、生成方式、在目标机器上信任安装的方法与安全注意事项）；
  - 更新根目录 `.gitignore`，全面忽略 `certs/**/*.pfx`、`certs/**/*.p12`、`certs/**/*.key`、`certs/**/*.pem`、`certs/**/*.gpg` 等一切私钥和私密文件。

### 需求 3：构建打包配置（`electron-builder.yml` 及构建脚本）签名集成

- 改造 `electron-builder.yml` 或增加包装构建脚本：
  - **Windows 配置**：当检测到 `certs/windows/code-sign.pfx` 存在时，自动配置为签名输入文件（支持通过环境变量 `WIN_CSC_KEY_PASSWORD` / `CSC_KEY_PASSWORD` 传参，支持配置默认开发密码回退）；
  - **macOS 配置**：支持通过 `CSC_LINK` / `identity` 读取 `certs/macos/mac-codesign.p12`，在本地打包 DMG 与 ZIP 时执行自签名，设置 `hardenedRuntime: false`（自签名证书无法启用带公证约束的严格沙箱）；
  - **Linux 配置**：保留包签名插槽，支持在环境变量指定时启用 GPG 签名；
  - **优雅降级与防御性容错**：未生成证书时，本地打包命令（`pnpm dist:win`、`pnpm dist:mac`、`pnpm dist:linux`）保持无证书安全打包，控制台输出清晰提示；生成证书后自动启用签名。

### 需求 4：客户端信任安装与分发说明文档

- 输出一份清晰详尽的使用指南（放入 `docs/self-signed-certificates.md` 与 `certs/README.md`）：
  - 如何在开发机或目标测试机上双击导入并信任 `root-ca.cer`（Windows 与 macOS 步骤说明）；
  - 解释“自签名”与“商业签名”的技术差异、消除 SmartScreen 弹窗的前提条件与最佳实践。

---

## 4. 验收标准 (Acceptance Criteria)

- [ ] **AC 1**：执行 `pnpm cert:generate` 后，可在 `certs/` 目录下一次性生成 Windows (`.pfx`、`.cer`)、macOS (`.p12`、`.cer`) 及 Linux/热更新的全套个人自签名证书与密钥。
- [ ] **AC 2**：敏感证书与私钥完全受 `.gitignore` 保护，`git status` 不会追踪任何生成的敏感私密文件。
- [ ] **AC 3**：在存在证书文件时，运行 `pnpm dist:win` / `pnpm dist:mac` 能够正确加载个人证书进行代码签名打包；在无证书时能够平滑降级构建，无崩溃报错。
- [ ] **AC 4**：项目完整保留证书导入、信任安装和日常维护的完整中英文技术文档。
- [ ] **AC 5**：通过现有测试与代码质量校验：`pnpm check` 与 `pnpm test` 正常通过。
