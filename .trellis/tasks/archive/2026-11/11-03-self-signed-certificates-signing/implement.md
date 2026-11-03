# Implementation Plan: 三端个人证书体系与构建签名实施清单

## 1. 准备与目录初始化 (Setup & Directory Scaffolding)

- [x] 1.1 创建证书专项目录结构：`certs/`、`certs/.gitkeep`。
- [x] 1.2 更新项目根目录 `.gitignore`，增加证书后缀（`.pfx`、`.p12`、`.key`、`.cer`、`.crt`、`.pub`、`.gpg`）及 `certs/` 敏感私钥文件的绝对排除规则，确保私钥安全不泄漏。

## 2. 自动化证书生成脚本开发 (Cert Generator Scripts)

- [x] 2.1 编写跨平台证书生成脚本 `scripts/generate-self-signed-certs.mjs`：
  - Windows: 基于 OpenSSL 生成 Authenticode 代码签名证书，导出 `certs/windows/code-sign.pfx` 与客户端根证书 `certs/windows/root-ca.cer`（兼容 OpenSSL 3 `-legacy` 格式）；
  - macOS: 生成 Apple 规范代码签名身份，导出 `certs/macos/mac-codesign.p12` 与 `certs/macos/mac-root-ca.cer`；
  - Linux: 生成独立签名密钥对并保存至 `certs/linux/`；
  - 导出各证书的指纹与元数据摘要 `cert-info.json`；
  - 联动刷新渲染层 Ed25519 增量热更新密钥对。
- [x] 2.2 在 `package.json` 中配置便捷命令：
  - `"cert:generate": "node scripts/generate-self-signed-certs.mjs"`
  - `"cert:clean": "node scripts/generate-self-signed-certs.mjs --clean"`

## 3. 构建打包体系签名集成 (Build & Packaging Integration)

- [x] 3.1 编写构建包装调度脚本 `scripts/build-with-cert.mjs`：
  - 自动检测 `certs/` 目录下各平台个人证书的存在性；
  - 存在证书时，自动为 Windows (`win`) / macOS (`mac`) 注入签名环境变量（`WIN_CSC_LINK`、`MAC_CSC_LINK`、`CSC_KEY_PASSWORD`）并触发签名打包；
  - 不存在证书时，平滑降级为无证书构建，并在终端给予提示，保证项目新 Clone 下零障碍运行。
- [x] 3.2 更新 `package.json` 中的各端打包命令（`dist:dir`、`dist:win`、`dist:mac`、`dist:linux`）接入自动证书集成器。

## 4. 客户端信任指引与文档建设 (Documentation & Guides)

- [x] 4.1 编写 `certs/README.md`，提供清晰详细的证书说明：
  - Windows 客户机 / 测试机如何安装 `root-ca.cer` 到“受信任的根证书颁发机构”与“受信任的发布者”消除 SmartScreen 拦截；
  - macOS 本地如何通过 `security` 命令导入钥匙串并信任根证书；
  - 证书密码的修改与安全规范。
- [x] 4.2 更新 `docs/build-and-packaging.md`，在“代码签名策略”章节补充自签名个人证书体系的最佳实践方案。

## 5. 质量保证与回归校验 (Verification & Quality Gate)

- [x] 5.1 运行 `pnpm run cert:generate` 实际生成三端证书，验证文件格式有效性（PFX 解析、P12 解析、CER 解析通过）。
- [x] 5.2 验证 Git 状态：确认生成的证书文件均被正确忽略，未在 `git status` 中漏入版本库。
- [x] 5.3 编写自动化测试 `tests/scripts/self-signed-certs.test.ts`，运行 `pnpm check` 与 `pnpm test` 全面通过（51 个测试套件，221 项用例全部 PASS）。
