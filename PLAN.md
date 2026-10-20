# Electron Starter — 实施计划与状态

## 目标

Electron + Vue 3 + TypeScript + Vite+；22 项系统级能力；单仓库、单应用；Main / Preload / Renderer / Shared 分层。

## 阶段

- [ ] P0 工程配置与验证（已补依赖构建许可；等待 CI 全链路通过）
- [x] P1 IPC、安全桥和基本窗口（代码已提交；未运行测试）
- [x] P2 托盘、原生菜单、启动页面、通知、Deep Link、自启动（代码已提交；未在 OS 实测）
- [x] P3 存储、国际化、Axios、下载、打印、日志、崩溃捕获（代码已提交；未在 OS 实测）
- [x] P4 整包更新代码与配置入口（尚未配置发布服务器和签名）
- [x] P5 签名的 Renderer ZIP 热更新代码（尚未配置密钥、更新服务器；需真实升级回归）
- [x] P6 builder 与 GitHub Actions 初始配置（尚未验证 CI）
- [ ] P7 完整测试、签名发布验证、跨平台最终验收

以上勾选代表“基础实现代码已存在”，**不代表已通过生产验收**。

## 待完成

1. 在有网络的环境运行 `corepack enable && pnpm install`，生成并提交 `pnpm-lock.yaml`。
2. 执行 `pnpm exec vp check`、`pnpm exec vp test --run`、`pnpm exec vp build`，修复全部错误。
3. 提供可见的应用托盘图标及各系统安装图标。
4. 在 Windows / macOS / Linux 真实系统上测试各个 OS 模块。
5. 配置 HTTPS 整包更新源、签名证书与 macOS 公证。
6. 使用实际 Ed25519 密钥签发资源热更新，执行回滚与故障注入测试。
7. 审查 ZIP 解压限制和文件系统边界，再开放真实用户的热更新能力。
8. 检查 `release.yml` 构建/发布产物和签名，不要把测试打包当成正式签名发布。

## 功能范围

IPC、窗口、electron-store、路由、Element Plus、i18n、系统托盘、原生菜单与快捷键、启动页、桌面通知、文件下载、打印、Deep Link、自启动、整包更新、ZIP 热更新、跨平台安装包、GitHub Actions、Electron 安全、日志、崩溃恢复、Axios。

## 当前修复轮次

- 对 pnpm 11 使用明确 `allowBuilds` 策略，避免忽略第三方构建脚本。
- 测试代码改用 `vite-plus/test`，启用 Vite+ TypeScript 类型检查。
- 任何 CI 失败必须保持 P0 未完成，并继续修复。

## 2026-10-20 构建进展

- CI 已首次通过安装、Vite+ 类型检查、单元测试和全部三进程构建。
- 修正生产沙箱中 ESM Preload 不兼容的问题，改为预打包 CJS；需后续集成测试确认。
