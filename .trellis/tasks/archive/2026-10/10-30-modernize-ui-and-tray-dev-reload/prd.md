# PRD: Modernize UI & Auto-reload Tray Icon in Development

## 1. 背景与痛点

1. **界面体验生硬割裂（“UI太难看了”）**：
   - 窗口顶部存在 `TitleBar.vue` 与 `App.vue` 中的 `<header class="header">` 两个导航条垂直叠罗汉，浪费垂直视野，标题与入口重复（两个 Electron Starter 标题、两套设置与下拉菜单）；
   - 首页 `Home.vue` 仅有极简文本和绿色虚线边框，缺乏现代桌面客户端（如 Raycast, Arc, Linear）的精致感、层级对比与仪表盘属性。
2. **开发体验断层（“托盘图标开发时没有更新”）**：
   - `vite-plugin-electron` 在开发时不监视 `resources/icons`；
   - 开发者生成或替换托盘图标（如 `pnpm icons:generate`）后，正在运行的 Electron 应用完全不感知，必须杀掉进程重启才能查看效果；
   - `tray.ts` 存在单例阻断，主进程局部重载不会重新读取图标；
   - macOS 下开发态未设置 Dock 栏图标，导致 Dock 图标显示 Electron 默认图标。

## 2. 目标与范围

- **目标 1**：将顶部双 Header 重构为统一的一体化现代桌面顶栏（一体化 WindowBar），完美适配 macOS 原生 Traffic Lights 避让、Windows/Linux 无边框窗口控制与 Web 端响应式。
- **目标 2**：将 `Home.vue` 重塑为高颜值、科技感的 Bento Grid 现代化仪表盘，展示应用环境运行状态、核心能力磁贴、四层架构指引与快捷操作。
- **目标 3**：在 `src/main/modules/system/tray.ts` 实现开发环境热重载（基于 `fs.watch` 监听 `resources/icons`），当托盘图标更新时自动通过 `tray.setImage(...)` 实时重载，无需重启应用；macOS 开发态启动时自动同步 Dock 图标。
- **目标 4**：通过 MCP（`vitest` MCP、DevTools/页面检查）完成完整验证，达到验收标准。

## 3. 功能需求详细说明

### 3.1 托盘图标开发态热重载

- 在 `!app.isPackaged` 时启动 watcher 监听 `resources/icons`；
- 防抖 300ms 触发 `reloadTrayIcon()`；
- 支持根据操作系统自动选取 `trayTemplate.png`（macOS）、`tray.ico`（Windows）或 `tray.png`（Linux）；
- 提供 `destroyTray()` 彻底销毁 watcher，无内存泄漏；
- macOS 启动时自动同步更新 `app.dock.setIcon`。

### 3.2 一体化现代 WindowBar 重构

- 移除 `App.vue` 内部冗余的 `<header class="header">`；
- 在 `TitleBar.vue` 内部整合：
  - macOS 左侧安全留白区（80px）；
  - 胶囊式导航组件（首页、能力实验室、设置中心），路由激活时优雅高亮；
  - 窗口拖拽区域（`-webkit-app-region: drag`）；
  - 右侧统一操作区：下载中心徽标按钮、主题切换快捷按钮（图标式或紧凑下拉）、多语言快捷切换、设置快捷入口以及 Windows/Linux 原生自绘控制按钮。

### 3.3 现代化 Bento Grid 首页仪表盘

- **Hero Header**：应用名称、科技感渐变标签、运行环境动态状态（Electron 桌面端 vs 纯 Web 端、平台与系统版本）；
- **Bento 核心卡片**：
  - **能力实验室 (Playground)**：涵盖窗口矩阵、IPC 调试、网络监控、热更新演练；
  - **系统运行状态 (System Status)**：展示当前 Electron 版本、Chromium 内核、Node.js 版本、系统架构；
  - **四层同构架构 (Architecture)**：清晰展示 `main`、`preload`、`renderer`、`shared` 职责与模块边界；
  - **传输与下载快速通道 (Transfers)**：直达下载管理抽屉。

## 4. 验收标准 (Acceptance Criteria)

1. **托盘热重载**：`reloadTrayIcon` 能在图标变化或重新生成时成功刷新托盘图像，在非打包状态下自动建立文件监听，应用退出时安全解绑。
2. **顶栏视觉**：顶部只保留一层统一的精致 WindowBar，彻底消除双 Header 叠罗汉问题；macOS 原生红绿灯无重叠遮挡，Windows 控件与操作按钮整齐。
3. **首页视觉**：`Home.vue` 呈现现代 Bento Grid 卡片布局，深色与浅色模式切换自然，无排版破损。
4. **质量验证**：
   - 单元测试与类型检查全部通过；
   - 通过 MCP（vitest MCP 工具）执行并通过自动化测试。
