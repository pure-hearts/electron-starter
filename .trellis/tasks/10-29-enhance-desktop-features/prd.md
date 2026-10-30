# Enhance Desktop Capabilities and DX

## Goal

为 `electron-starter` 模板构建一套现代化、生产级的桌面功能扩展体系，完善桌面特有体验（自定义自绘标题栏、系统主题/强调色联动）、系统原生底层交互（Shell 文件与回收站、全局快捷键、电源状态监听）、观测性（性能诊断、遥测）与双端适配，使模板具备支撑商业级复杂客户端的能力。

## Requirements

### Phase 1: 桌面交互体验与外观核心扩展 (MVP / P1)

1. **无边框自绘标题栏 (Custom Frameless Titlebar)**:
   - 支持跨平台沉浸式自绘标题栏组件 `TitleBar.vue`。
   - macOS 适配原生交通灯按钮占位，支持隐藏/内嵌样式。
   - Windows/Linux 提供标准的最小化、最大化/还原、关闭窗口控制按钮与悬停状态。
   - 支持 `-webkit-app-region: drag` 与 `no-drag` 控制，支持双击标题栏最大化/还原。
2. **系统外观与强调色深度集成 (Native Theme & Accent Color)**:
   - 接入 `nativeTheme`，支持深色模式、浅色模式和跟随系统三模动态切换与持久化。
   - 获取系统原生强调色（Windows/macOS `systemPreferences.getAccentColor()`），动态注入 Naive UI 主题覆盖配置。
   - 窗口创建与初始化避免白屏闪烁（Background Color 匹配）。
3. **原生 Shell 与文件系统能力增强 (Native Shell Integration)**:
   - 封装并在 IPC 中暴露：在文件管理器中定位（`shell.showItemInFolder`）。
   - 安全移至回收站（`shell.trashItem`），替代直接硬删除。
   - 打开系统默认应用或外部链接（`shell.openPath` / `shell.openExternal` 严格安全协议校验）。

### Phase 2: 硬件系统感知与桌面生产力 (P2)

1. **用户自定义全局快捷键管理器 (Global Shortcut Center)**:
   - 主进程注册与反注册 `globalShortcut`，具备冲突检测与错误捕获。
   - 渲染层提供快捷键录制组件（Key Recorder）与持久化存储。
2. **电源与设备休眠状态感知 (Power Monitor)**:
   - 监听系统休眠（suspend）、唤醒（resume）、锁屏/解锁。
   - 提供事件广播，支持应用在休眠前安全提交数据、唤醒后恢复连接。
3. **进程资源监控面板 (In-App Task Manager)**:
   - 采集主进程、渲染进程实时 CPU/内存指标（`app.getAppMetrics()`）。
   - 在 Playground 诊断面板中可视化展示资源消耗。

### Phase 3: 观测性与高级架构 (P3 / 进阶)

1. **崩溃转储与监控 (Crashpad / Sentry 集成范式)**:
   - 主进程 CrashReporter 规范配置与 minidump 收集。
2. **本地结构化数据库 (SQLite) 与 UtilityProcess 进阶示例**:
   - 提供原生依赖编译安全规范与后台密集计算进程模式。

## Acceptance Criteria

- [x] 新增 `src/renderer/components/TitleBar.vue` 并在各页面自适应渲染（Win/Mac/Linux 布局一致且符合平台规范）。
- [x] 主进程与渲染进程实现主题切换（Dark / Light / Auto）及系统强调色（Accent Color）的 IPC 管道与 Naive UI 适配。
- [x] 扩展 `src/shared/ipc.ts` 契约，新增 `shell:showItemInFolder`、`shell:trashItem`、`shell:openPath` 等类型化 IPC 接口，并在 Playground 页面提供测试用例。
- [x] 新增 Vitest 自动化集成测试套件（如 `tests/shell-integration.test.ts` 与 `tests/theme-system-integration.test.ts`），覆盖 Shell 安全过滤、防注入、系统主题与强调色生命周期验证。
- [x] 代码通过 `vp check`、`vue-tsc` 与测试套件验证，严格符合 `AGENTS.md` 规范（沙箱隔离、CSP、单一职责、单包架构）。

## Non-Goals & Out of Scope (当前阶段)

- 不在此任务中引入侵入式的第三方重型框架或破坏现有的单包目录结构（遵循 `AGENTS.md`）。
- 不破坏现有 Web 端编译（`vp dev:web` / `vp build:web`），桌面特有 API 在 Web 模式下必须优雅降级或做条件编译判断。
