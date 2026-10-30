# Implementation Plan: Web 与 Electron 双端启动与跨端兼容架构

## Phase 1: 构建与启动流解耦 [已完成]

- [x] 改造 `vite.config.ts`：通过 `TARGET_PLATFORM=web` 控制是否挂载 `electron` 插件并支持 `open: true` 与 `dist/web` 输出。
- [x] 在 `package.json` 添加 `"dev:web": "TARGET_PLATFORM=web vp dev"` 与 `"build:web": "TARGET_PLATFORM=web vp build"` 脚本。

## Phase 2: 跨端 Bridge 与 Web Shim 实现 [已完成]

- [x] 封装平台探针 `src/renderer/bridge/platform.ts`，导出 `isElectron`、`isWeb` 与 `usePlatform()`。
- [x] 编写 Web 端降级适配器 `src/renderer/bridge/web-shim.ts`，基于浏览器 API 实现完整 22 项能力降级（存储命名空间、通知、全屏等）。
- [x] 导出统一门面 `src/renderer/bridge/index.ts`，在启动时自动挂载到 `window.$ipcBridge`。

## Phase 3: Vue 全局自定义指令与路由升级 [已完成]

- [x] 实现并注册 `v-if-electron` 与 `v-disabled-electron` 全局自定义指令。
- [x] 将路由升级为统一的 `createWebHistory`，支持环境变量 `VITE_ROUTER_BASE`。
- [x] 增强 Electron 主进程 `app://` 协议：增加 SPA 页面重写回退，保障 History 模式在桌面端刷新正常。

## Phase 4: 视图层适配与状态展示 [已完成]

- [x] 在 `Playground.vue` 顶部 Hero 状态栏根据当前平台动态渲染：“🖥️ Electron 桌面客户端” vs “🌐 Web 纯浏览器模式”。
- [x] 在桌面专属操作项（自启动、托盘、更新）上应用自定义指令与温和提示。

## Phase 5: 质量门禁与全量验证 [已完成]

- [x] 运行 `npx vp fmt` 与 `npx vp check` 确保 0 警告、0 错误、0 类型问题。
- [x] 运行 `npx vp test run` 确保现有 35 个测试套件，125 项测试 100% 通过。
- [x] 分别验证 `pnpm build:web` 纯 Web 模式构建与常规 Electron 构建全部成功通过。
