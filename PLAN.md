# Electron Starter — 实施计划与验收状态

## 目标与约束
Electron + Vue 3 + TypeScript + Vite+ 的单应用项目；源码严格分为 `src/main`、`src/preload`、`src/renderer`、`src/shared`；22 项通用系统能力，不含业务功能与字节码保护。

## 已通过 GitHub Actions 的验证（2026-10-20）
- [x] Node 24 / pnpm 11 依赖安装及已提交的 `pnpm-lock.yaml`
- [x] Vite+ 类型检查和 lint，`vue-tsc` Vue SFC 类型检查
- [x] IPC 运行时输入验证、Ed25519 更新清单、ZIP 解压安全的单元测试
- [x] Renderer/Main/Preload 三端构建
- [x] Linux CI 真实启动 Electron，验证 sandboxed Preload 和类型化 IPC
- [x] Linux CI 打包目录启动烟雾测试
- [x] Windows NSIS、macOS DMG/ZIP、Linux AppImage/deb **无签名**安装包构建及上传 Actions artifacts
- [x] GitHub Releases 发布配置，生产 Release 增加签名凭证与版本校验门禁（发布流程尚未实测）

## 22 项系统能力（代码实现状态）
- [x] 共享 TypeScript IPC 请求/响应和事件订阅、来源/参数校验
- [x] 窗口管理和单实例
- [x] electron-store 持久化
- [x] Vue Router
- [x] Element Plus
- [x] vue-i18n
- [x] 系统托盘
- [x] 原生菜单与快捷键
- [x] Splash 启动屏
- [x] 桌面通知
- [x] 文件下载启动、进度、暂停、恢复及取消
- [x] 打印
- [x] Deep Link
- [x] Windows/macOS/Linux 开机自启动代码
- [x] electron-updater 整包更新集成及 GitHub Releases 默认源
- [x] Ed25519 签名的 ZIP Renderer 资源热更新与基于确认状态的回滚
- [x] electron-builder 跨平台打包
- [x] GitHub Actions 代码检查、构建及有签名门禁的发布工作流
- [x] Electron 沙箱、隔离、CSP、IPC 运行时验证
- [x] electron-log 统一日志
- [x] 崩溃捕获与有限恢复
- [x] Axios 封装

此处 [x] 表示模块具备代码实现，**不是所有 OS 行为都通过端到端验收**。

## 仍未达成的生产发布验收（必须保留未完成状态）
- [ ] Windows 与 macOS 安装后实际运行 UI、原生通知、打印、Deep Link、自启动等行为测试
- [ ] 使用真实 Windows 证书 / Apple Developer ID 完成代码签名、macOS 公证和 Gatekeeper / SmartScreen 体验验证
- [ ] 已签名的真实 GitHub Release 从低版本升级到高版本的端到端测试
- [ ] ZIP 热更新在**真实安装包**中的 HTTPS 下载、故障注入、断网恢复和跨版本回滚测试
- [ ] 替换示例维护者邮箱及默认应用 ID、图标和发布主体信息
- [ ] 开始正式交付前的安全复核（包含下载重定向、权限边界和 ZIP 异常）

## 阶段结论
P0–P6 的主要功能与工程化代码均已落地，Linux CI 与三平台构建具备可核验记录。P7 的生产签名、真实设备运行及更新恢复测试需要合法凭证和目标平台测试环境。没有这些证据不得宣称 P7 完成。
