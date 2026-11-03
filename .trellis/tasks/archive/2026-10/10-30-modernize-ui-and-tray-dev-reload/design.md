# Technical Design: Modernize UI & Auto-reload Tray Icon in Development

## 1. 架构总览与模块设计

```
┌─────────────────────────────────────────────────────────────┐
│                       Window Frame                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ TitleBar.vue (一体化现代 WindowBar)                       │ │
│ │ [Traffic Lights/Logo] [Nav Tabs] [Drag Area] [Actions]  │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ NetworkBanner.vue                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ RouterView: Home.vue (Bento Grid 仪表盘)                 │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 Main Process: tray.ts                       │
│ ┌───────────────────┐    file change    ┌─────────────────┐ │
│ │  resources/icons/ │ ────────────────> │   fs.watch      │ │
│ └───────────────────┘                   └────────┬────────┘ │
│                                                  │ debounce │
│                                                  ▼          │
│                                         ┌─────────────────┐ │
│                                         │ reloadTrayIcon  │ │
│                                         │ tray.setImage() │ │
│                                         └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 2. 详细设计

### 2.1 托盘图标热重载 (src/main/modules/system/tray.ts)

- `loadTrayImage()`:
  - 提取公共图标加载逻辑。
  - macOS 优先加载 `trayTemplate.png`，调用 `img.setTemplateImage(true)`，若不存在则回退至 `icon.png`；
  - Windows 优先加载 `tray.ico`，Linux 加载 `tray.png`。
- `reloadTrayIcon()`:
  - 若 `tray` 存在，调用 `loadTrayImage()` 重新获得 `NativeImage` 并 `tray.setImage(trayImage)`。
- `initTrayWatcher()`:
  - 仅在 `!app.isPackaged` 时启动。
  - 使用 `fs.watch(iconsDir)` 监听 `resources/icons`；
  - 采用 300ms 防抖，过滤非托盘相关文件；
  - 遇到重载异常时安全捕获并记录日志。
- `syncDockIcon()`:
  - 在 macOS 平台且 `!app.isPackaged` 时，调用 `app.dock?.setIcon(getIconPath("icon.png"))`，解决 Dock 栏显示默认 Electron 图标的问题。
- `destroyTray()`:
  - 关闭 watcher，调用 `tray.destroy()`，置空单例。

### 2.2 一体化现代 WindowBar (src/renderer/components/TitleBar.vue)

- 结构组织：
  - **Left**:
    - macOS: 76px 留白占位供红绿灯显示；
    - Windows/Linux/Web: 精致应用 Logo SVG + "Electron Starter" 品牌标识。
  - **Center-Left**: 胶囊风格导航（Pill Tabs）
    - 首页（Home）、能力实验室（Playground）、设置中心（Settings）。
    - 活跃状态使用深浅色自适应的高亮背景与平滑过渡。
  - **Center**:
    - 拖拽区域 (`-webkit-app-region: drag`)，双击触发最大化/还原。
  - **Right**:
    - 下载状态按钮（带活跃下载数字 Badge）；
    - 主题切换按钮（一键在 System / Light / Dark 循环切换，或精致下拉菜单）；
    - 语言切换按钮（简/En）；
    - 设置按钮（齿轮图标）；
    - Windows/Linux 无边框窗口控制按钮（最小化、最大化/还原、关闭）。
- 高度统一定为 44px，既保证窗口控制的点击热区，又轻巧精致，完全替代原有的 38px + 52px 叠罗汉。

### 2.3 首页仪表盘 (src/renderer/views/Home.vue)

- **Hero 欢迎横幅**：
  - 现代深邃渐变背景卡片，带微光光晕效果；
  - 标语与运行环境动态药丸标签（如 `macOS Sonoma · Electron 44 · 桌面端就绪` 或 `Web 预览环境`）。
- **Bento 核心栅格**：
  - **磁贴 1: 能力实验室 (Playground)**：一键直达窗口管理、文件下载、IPC 通信、热更新等 10+ 项系统级 API 演练；
  - **磁贴 2: 客户端内核状态**：直接展示当前 Chromium、V8、Node 与 Electron 版本号；
  - **磁贴 3: 四层同构架构速览**：可视化清晰列出 `main` / `preload` / `renderer` / `shared` 职责；
  - **磁贴 4: 快速操作区**：打开下载中心抽屉、快速访问设置。

## 3. 安全性与规范

- 严格遵循 `AGENTS.md`：
  - 不引入额外的通用后端或多包构建；
  - 渲染进程通过已有 typed IPC 与 bridge 交互，不泄露 Node 原生模块；
  - 主进程热监听仅在 `!app.isPackaged` 激活，确保生产包无开销。
