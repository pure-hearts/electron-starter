# Electron Starter — 交付清单与验收记录（2026-10-20）

## 目标与项目边界

单仓库、无业务逻辑、Electron + Vue 3 + TypeScript + Vite+；保留约定的 22 项通用系统能力，源码分别位于 `src/main`、`src/preload`、`src/renderer`、`src/shared`。

## 源码及 CI 已验证

- [x] 源码、构建配置和 Vite+ 依赖别名已提交
- [x] pnpm 11 `pnpm-lock.yaml` 锁定版本，CI 安装可复现
- [x] Vite+ lint/TS、vue-tsc 类型检查和单元测试成功
- [x] Renderer/Main/Preload 三端编译成功
- [x] Electron 沙箱 CommonJS Preload 可成功加载，类型化 IPC 成功往返
- [x] Linux 打包目录应用已启动并通过 IPC 烟雾测试
- [x] Windows NSIS、macOS DMG/ZIP、Linux AppImage/deb **无签名**安装包构建并上传 Actions
- [x] Ed25519 更新清单、校验异常及 ZIP 解压安全的单元测试
- [x] **Linux 已打包 Electron 集成测试**通过 HTTPS 读取临时签名更新清单、下载 ZIP、激活新版 Renderer，随后模拟异常退出并验证自动回滚到上一版本
- [x] GitHub Releases 默认整包更新配置、更新/安装操作接口与签名发布的凭证门禁
- [x] GitHub Actions Check、Cross-platform Package Check、Signed Release 工作流文件

证据： [CI 与真实打包/热更新测试](https://github.com/pure-hearts/electron-starter/actions/runs/39367415682)；[三平台无签名构建](https://github.com/pure-hearts/electron-starter/actions/runs/39367187847)。

## 22 项系统能力代码已覆盖（不同于全部平台 E2E 验收）

- [x] F01 双向类型化 IPC 和事件监听
- [x] F02 多窗口、单实例及生命周期
- [x] F03 electron-store 持久化
- [x] F04 Vue Router
- [x] F05 Element Plus
- [x] F06 国际化中英文
- [x] F07 系统托盘
- [x] F08 原生菜单与快捷键
- [x] F09 Splash 启动屏
- [x] F10 桌面通知
- [x] F11 文件下载进度、暂停、恢复及取消
- [x] F12 打印机和打印
- [x] F13 Deep Link
- [x] F14 Windows/macOS/Linux 自启动（Linux XDG）
- [x] F15 整包自动更新（默认 GitHub Releases）
- [x] F16 ZIP 资源热更新（Ed25519、SHA-256、版本兼容、回滚）
- [x] F17 Windows、macOS、Linux 安装包
- [x] F18 GitHub Actions 检查、打包与发布
- [x] F19 Electron 运行隔离与权限限制
- [x] F20 electron-log 日志
- [x] F21 进程异常捕获和有限恢复
- [x] F22 Axios 网络请求封装

勾选表示功能有对应实现；其中 Windows/macOS 的原生交互和正式安装升级还必须在目标设备上验证。

## 尚不能宣告完成的最终生产验收

- [ ] 在 Windows/macOS 原生环境安装产物，检查托盘、通知、打印、菜单、Deep Link 和自启动的实际行为
- [ ] 使用合法 Windows 签名证书和 Apple Developer ID，完成签名、公证、Gatekeeper / SmartScreen 验证
- [ ] 真实 GitHub Releases **已签名整包**从上一版本升级到下一版本，并完成失败恢复测试
- [ ] 替换正式维护者邮箱、App ID、商标图标与发布仓库所有者配置
- [ ] 正式发布前的代码和更新安全复审，尤其是下载重定向和跨平台异常场景
- [ ] 对应生产平台执行最终回归并手动核对 Release 文件

## 阶段结论

P0–P6：主要代码、工程化验证和无签名打包已完成，Linux ZIP 更新真实集成测试已通过。

P7：上述尚未完成的正式签名/跨平台安装与真实更新测试需要外部发布证书及目标操作系统，不得在未取得实测结果时标记完成。

## P1 可靠性增强与 P2 单元测试（本轮开发）
- [x] F11：单任务顺序执行的 FIFO 下载队列、重复 URL 下载、排队取消、失败重试、启动超时和重定向 URL 校验
- [x] F03：对旧配置进行 schemaVersion=1 迁移，丢弃无效选项及窗口边界，损坏文件可恢复
- [x] F22：Axios 取消、超时、HTTP、网络及未知异常分类（避免把响应体中的敏感字段带入错误）
- [x] F13：Deep Link 冷启动缓冲、渲染层订阅后读取与 URL 数量上限
- [x] F21：崩溃恢复次数限制的独立单元测试
- [x] F20：Renderer 日志中常见凭据字段的脱敏及单元测试
- [x] F02：窗口尺寸变更节流保存，不依赖窗口关闭时存储
- [x] F06：electron-store 为语言偏好权威来源，渲染层缓存仅用于初始展示
- [ ] P2 原生桌面 UI、打印、托盘和系统自启动等真实平台交互测试
- [ ] P3 完整正式整包升级与真实签名、公证

请核对以上每一项最新 GitHub Actions 测试结果后再视为通过 CI；此处勾选表示已提交实现。
