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
- [x] F05 Naive UI（已从 Element Plus 迁移至纯 TS 按需引入的 Naive UI）
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
- [x] F22 Axios 网络请求封装（含 `@vueuse/integrations/useAxios` 响应式状态集成）

勾选表示功能有对应实现；其中 Windows/macOS 的原生交互和正式安装升级还必须在目标设备上验证。

## 尚不能宣告完成的最终生产验收与决策记录

- [ ] 在 Windows/macOS 原生环境安装产物，检查托盘、通知、打印、菜单、Deep Link 和自启动的实际行为
- [x] **签名策略明确**：
  - **macOS 代码签名与公证**：用户明确**暂停**，不作为当前交付阻塞项。
  - **Windows 代码签名**：用户明确采用**内部官网分发无证书模式**（不接入商业 CA 证书与硬件 Token，依赖用户首次信任与后续静默覆盖更新）。
- [x] **动态环境变量去硬编码（2026-10-29 落地）**：
  - 核心业务及调试模块不再使用固定字符串，支持规范化环境变量动态注入。
  - 客户端标准化规范：`VITE_APP_ENV`、`VITE_APP_TITLE`、`VITE_API_BASE_URL`、`VITE_APP_DEEP_LINK_SCHEME`、`VITE_APP_DOWNLOAD_TEST_URL`。
  - 主进程标准化规范：`APP_NAME`、`APP_USER_MODEL_ID`、`APP_DEEP_LINK_SCHEME`、`APP_LOG_LEVEL`、`APP_UPDATE_URL`、`HOT_UPDATE_URL`。
  - 完善 `.env.example`、`.env.development`、`.env.production`、`.env.testing` 规范模板与完整注释。
- [x] 真实 GitHub Releases 自动构建与发布（`v0.1.0` / `v0.1.1` 云端打包直传 Releases 已打通，本地实测完成新版本发现与更新包拉取）。
- [x] 功能校验中心（Playground）商业化与生产级状态重构（Hero 状态栏、Tab 架构、精确菊花态字典、流水动效 Progress、结构化诊断终端已全部落地并归档）。
- [x] **Naive UI 迁移与双端工程化进阶（2026-10-29 落地）**：
  - 全面移除 `element-plus`，切换为纯 TS 按需 Tree-Shaking 的 `naive-ui`；
  - 集成 `@vueuse/core` 与 `@vueuse/integrations`（`useAxios`），内置 `VITE_DEV_PROXY_TARGET` 代理支持；
  - 收窄 `electron-builder.yml` 产物过滤为 `dist/renderer/**/*`，新增 `v-if-web` 指令、`.github/workflows/hot-release.yml` 热更发布流水线与 `check.yml` Web 构建门禁。
- [x] **跨平台自绘标题栏、系统主题强调色与 Shell 安全集成（2026-10-29 落地）**：
  - 实现无边框自绘标题栏 `TitleBar.vue`（macOS 交通灯安全区自适应、Windows/Linux 控制按钮组、拖拽与双击最大化）；
  - 主进程接入 `nativeTheme` 与 `systemPreferences.getAccentColor`，动态计算 Naive UI 调色板并通过 IPC 实时广播；
  - 封装安全的 Shell 原生操作（`showItemInFolder`、`trashItem`、`openPath`、`openExternal`），支持协议白名单与路径穿越防御；
  - 新增 `tests/shell-integration.test.ts` 与 `tests/theme-system-integration.test.ts` 2 个 Vitest 集成测试套件，全量 39 套件 149 测试全部通过；
  - 完善 `web-shim.ts`，Web 模式与桌面端构建双端平滑兼容。
- [x] **跨平台桌面端应用图标套件生成与适配（2026-10-30 落地）**：
  - 设计并生成科技风格矢量源文件 `resources/icons/icon.svg` 与 1024x1024 超清母图 `resources/icons/icon-1024.png`；
  - 产出各平台官方标准格式：Windows 专用多尺寸复合 `icon.ico` (16~256px)、macOS 原生 Retina `icon.icns`、Linux/通用 512x512 `icon.png`；
  - 产出 Web 端与启动页图标 `public/favicon.ico`、`public/favicon.png`，并在 `src/renderer/index.html` 和 `public/splash.html` 中完成引入；
  - 编写跨平台自动化生成脚本 `scripts/generate-icons.py`，配置 npm 脚本 `pnpm icons:generate`；
  - 更新 `electron-builder.yml` 打包配置与 `resources/icons/README.md` 图标资产规格说明。
- [x] **商业级设置中心与高级桌面特性集成（2026-10-30 落地）**：
  - 基于 Naive UI 搭建科技感设置中心页面 `Settings.vue`（常规、下载、通知、全局快捷键、系统诊断与关于），并在 `TitleBar.vue` 与主导航完整接入路由；
  - 扩展 `src/shared/ipc.ts` 契约与 `store/schema.ts`（升级至 schemaVersion=2），实现常规外观、自启动、下载目录与并发、通知开关的结构化持久化与广播；
  - 实现下载完成/失败系统桌面通知联动，点击通知直接在系统文件管理器高亮定位目标文件（`shell.showItemInFolder`）；
  - 封装主进程全局快捷键模块 `shortcut-module.ts`，支持后台全局呼出/隐藏主窗口与冲突防护；
  - 封装系统诊断与排障模块 `diagnostics.ts`，支持一键导出脱敏日志与系统参数的 ZIP 压缩包；
  - 封装全局网络监听与 `NetworkBanner.vue` 离线提示组件，WebShim 全量对齐新增通道；
  - 新增 `tests/diagnostics-archive.test.ts` 与 `tests/shortcut-policy.test.ts` 测试套件，全量 41 套件 154 项测试用例全部通过，`vp check` 0 错误。
- [x] **主进程与 Preload 核心瘦身及架构规范化（2026-11-02 落地）**：
  - **移除 Smoke 烟雾测试**：彻底删除侵入核心流程的 `src/main/bootstrap/smoke.ts`、相关 CI 脚本与主入口测试目录劫持，净化生产启动链路；
  - **开发环境独立收拢**：新建 `src/main/dev/` 文件夹（`pid-lock.ts`、`dev-server.ts`、`index.ts`），将孤儿进程锁治理与 `--dev-server-url` 还原参数统一封装，主入口 `src/main/index.ts` 精简至单一核心职责；
  - **Preload 架构规范化**：将事件白名单统一定义至 `src/shared/validation.ts` (`allowedEvents`)，消除局部硬编码，Preload 订阅增加类型防御与精确 dispose，新增单测覆盖保障；
  - 全量 48 个测试套件 199 项测试全部通过，`vp check` 0 错误，主进程与渲染进程产物构建成功。
- [ ] 对应生产平台执行最终业务回归并核对 Release 产物。

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

## 跨平台回归修复

- [x] macOS `/var` 与 `/private/var` 路径别名测试已修复；Windows/macOS/Linux `Cross-platform Package Check` 均成功：https://github.com/pure-hearts/electron-starter/actions/runs/39406676893；Linux 完整 Check：https://github.com/pure-hearts/electron-starter/actions/runs/39406676789。

## P7 验收边界

- [x] 最新源码触发 Windows/macOS/Linux 三平台无签名安装包构建，三平台 CI 全部通过。
- [ ] 三平台打包成功不等于签名、安装升级或原生交互验证成功；仍须取得实际系统测试证据。

## 商业级设置中心与全局快捷键组件化（2026-10-30）

- [x] **商业级设置中心 (Settings Center)**：完整落地 `/settings` 路由，包含常规、下载、通知、全局快捷键、系统诊断与关于共 6 大分栏，并在顶部导航与系统托盘中打通入口。
- [x] **全局快捷键独立组件化 (`GlobalShortcutManager` & `ShortcutRecorder`)**：
  - 封装原子按键录制器，支持点击聚焦激活、键盘实体按键监听捕获、呼吸灯与过渡修饰键展示、Escape 取消与清空；
  - 拦截单字符等非法按键，统一标准化为跨平台 Accelerator；
  - 集成主进程热注册与冲突检测，被占用时提供醒目冲突警告并自动回退原值；
  - 内置交互式快捷键排障与帮助指引面板（键位映射表、冲突原理、高频冲突软件案例、低冲突推荐预设）。
- [x] **自动化质量门禁验证**：
  - `pnpm check`: 262 个文件 0 错误；
  - `pnpm typecheck:vue`: 0 TS 错误；
  - `pnpm test`: 42 个测试套件，165 项单测 100% 通过；
  - `pnpm build`: 生产构建成功，无超大 chunk 告警。

## 证书管理、热更白屏防御与桌面通知系统实测（2026-11-03）

- [x] **跨平台自签名证书生成与自动打包集成**：
  - 落地 `scripts/generate-self-signed-certs.mjs`，一键生成 Windows `.pfx` 与 macOS `.p12` 代码签名证书与根证书；
  - 落地 `scripts/build-with-cert.mjs` 包装器，构建打包时智能检测本地 `certs/` 目录并自动注入 `WIN_CSC_LINK` / `MAC_CSC_LINK` 与密码，无证书时平滑降级并输出友好提示；
  - 新增 `tests/scripts/self-signed-certs.test.ts` 测试套件，覆盖证书创建、加密密码、清理与降级流程。
- [x] **macOS 原生通知排障与代码签名闭环**：
  - 精准定位 macOS `UNErrorDomain 错误 1` 根因：苹果 `UserNotifications` 框架严格要求 App 二进制拥有合法签名与资源封条，未签名或签名破损会被系统内核静默阻断；
  - 修复已安装客户端签名，并在本地真机环境实测验证桌面横幅通知弹出与点击激活回调正常。
- [x] **热更新架构兼容性防御（彻底解决跨版本白屏）**：
  - 深度排查旧底包热更新后白屏原因：新版前端代码在顶层调用新事件（`context-menu:action`），而旧宿主 Preload 白名单未声明该事件，导致同步抛错阻断 Vue 挂载；
  - 在 `src/renderer/bridge/index.ts` 抽象 `wrapSafeBridge` 防御切面，捕获未授权通道异常并安全降级为 No-op，实现全项目使用 `useIpcBridge` 彻底免疫此类版本不匹配白屏；
  - 真实验证 GitHub Releases `v0.1.4` 增量热更新拉取、下载验签、桌面提示、平滑激活、与重启后通知能力无损。
- [x] **全量三平台安装介质与代码签名构建闭环**：
  - **macOS**：通过 `pnpm dist:mac` 成功完成 `release/Electron Vue Template-0.1.4-arm64.dmg` 与 `zip` 打包，应用与所有内置 Framework / Helper 均由 `Developer ID Application: Electron Vue Template Dev` 成功签名，严格验证通过 `valid on disk` 且满足 Designated Requirement；配置 `notarize: false` 并防御外部公证环境变量干扰；
  - **Windows**：通过 `pnpm dist:win` 成功完成 `release/Electron Vue Template Setup 0.1.4.exe` NSIS 安装包打包，应用主体、卸载程序与提权工具均由 `certs/windows/code-sign.pfx` 个人 Authenticode 证书成功签名；
  - **Linux**：通过 `pnpm dist:linux` 成功完成 `release/Electron Vue Template-0.1.4-arm64.AppImage` 与 `deb` 产物构建；
  - **工程规范**：配置 `.prettierignore` 规避按需组件声明自动格式化抖动。
- [x] **全量质量门禁**：
  - `pnpm check`: 326 个文件 0 错误 0 告警；
  - `pnpm test`: 53 个测试套件，229 项单元/集成测试 100% 通过。
