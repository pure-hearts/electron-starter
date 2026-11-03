# Implementation Plan: Commercial Settings Center & Advanced Desktop Features

## Execution Checklist

### Phase 1: Shared 契约与主进程配置/基础服务扩展

- [x] 1.1 **扩展 IPC 契约定义 (`src/shared/ipc.ts`)**：
  - 新增 `settings:all:get`、`settings:all:set`、`dialog:selectDirectory`、`shortcut:register`、`diagnostics:exportLogs`、`app:networkStatus` 等信道与载荷类型。
- [x] 1.2 **扩展配置 Schema (`src/main/modules/store/schema.ts`)**：
  - 增加常规、下载、通知、快捷键的用户偏好结构与严格校验迁移策略（升级至 schemaVersion=2）。
- [x] 1.3 **下载持久化与路径联动 (`src/main/modules/download/`)**：
  - 实现下载目标路径优先使用用户自定义目录；完成状态联动。
- [x] 1.4 **通知中心业务驱动联动 (`src/main/modules/notification/`)**：
  - 支持下载完成通知点击事件定位文件（`shell.showItemInFolder`），接入用户通知偏好开关。
- [x] 1.5 **全局快捷键与系统诊断模块 (`src/main/modules/system/`)**：
  - 封装 `shortcut-module.ts`（快捷键安全注册与主窗口显隐切换）；
  - 封装 `diagnostics.ts`（系统参数采集与日志 ZIP 压缩导出）；
  - 增加网络连接监听与广播机制（`network-module.ts`）。
- [x] 1.6 **IPC Handler 接入与网关注册 (`src/main/ipc/`)**：
  - 挂载新增领域 Handlers 并确保白名单、Frame 校验与错误脱敏。

### Phase 2: 渲染层设置中心 UI 搭建与路由整合

- [x] 2.1 **创建设置状态管理 (`src/renderer/stores/settings.ts`)**：
  - Pinia 响应式偏好状态仓库，初始化读取并自动同步主进程。
- [x] 2.2 **搭建商业级设置中心页面 (`src/renderer/views/Settings.vue`)**：
  - 采用 Naive UI 构建专业分栏/Tabs 布局（常规、下载、通知、快捷键、系统诊断、关于）；
  - 封装各子模块面板与交互表单。
- [x] 2.3 **导航与全局入口整合**：
  - 在 `src/renderer/router/index.ts` 注册 `/settings` 路由；
  - 在 `src/renderer/components/TitleBar.vue` 与主导航增加进入设置的按钮图标；
  - 增加全局离线提示横幅组件 `NetworkBanner.vue`。

### Phase 3: 自动化测试套件与全量门禁验收

- [x] 3.1 **编写新增功能测试套件 (`tests/`)**：
  - 扩展 `settings-schema.test.ts` 支持全量设置与迁移；
  - 新增 `tests/shortcut-policy.test.ts` 快捷键格式与安全性校验；
  - 新增 `tests/diagnostics-archive.test.ts` 诊断与日志脱敏压缩测试。
- [x] 3.2 **代码质量与全端验证**：
  - 运行 `pnpm check`（0 Lint/Type error，全量格式化通过）；
  - 运行 `pnpm typecheck:vue`（0 TS error）；
  - 运行 `pnpm test`（41 个套件 154 项测试用例全部通过）；
  - 运行 `pnpm build`（验证 Renderer / Main / Preload 构建正常）；
  - 运行 `pnpm smoke`（真实 Electron 启动与生命周期回归通过）。

## Risky Areas & Mitigations

- **快捷键热键冲突**：操作系统或其他应用可能占用了所选快捷键。
  - _缓解措施_：在注册时使用 `globalShortcut.isRegistered` 探测，失败时安全降级并给用户清晰反馈。
- **日志导出大文件与内存保护**：日志可能积累过多占用主进程内存。
  - _缓解措施_：仅截取最近 7 天日志，并限制单文件最大大小，压缩采用流式或轻量无阻断分片。
- **跨平台窗口控制与布局**：macOS 与 Windows 标题栏对齐差异。
  - _缓解措施_：在 `TitleBar.vue` 中复用既有的平台判断逻辑与平台专属 padding。
