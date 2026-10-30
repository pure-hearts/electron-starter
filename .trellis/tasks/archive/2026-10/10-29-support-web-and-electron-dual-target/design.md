# Technical Design: Web 与 Electron 双端启动与跨端兼容架构

## 1. 架构总览

```mermaid
graph TD
    App[Vue 3 渲染层视图 (Playground, App, Stores)] --> Directives[自定义指令 (v-if-electron / v-disabled-electron)]
    App --> Bridge[跨端 Bridge 门面 (src/renderer/bridge)]

    Bridge -->|isElectron| NativeAdapter[Electron 原生 IPC (window.$ipcBridge)]
    Bridge -->|isWeb| WebShim[Web 降级适配器 (Web Browser Shim)]

    NativeAdapter --> ElectronMain[Electron 主进程 22 项系统能力]
    WebShim --> LocalStorage[localStorage 命名空间存储 (app:*)]
    WebShim --> NotificationAPI[HTML5 Notification / ElNotification 弹窗]
    WebShim --> FullscreenAPI[HTML5 全屏 / 标签页提示]
    WebShim --> MockTerminal[浏览器控制台 / Blob 文件导出]
```

---

## 2. 构建层设计 (`vite.config.ts`)

```typescript
// 环境变量 TARGET_PLATFORM 控制构建目标：web | electron (默认)
const isWeb = process.env.TARGET_PLATFORM === "web";

export default defineConfig({
  root: "src/renderer",
  // 基础子路径支持环境变量覆写
  base: process.env.VITE_ROUTER_BASE || (isWeb ? "/" : "./"),
  build: {
    outDir: isWeb ? "../../dist/web" : "../../dist/renderer",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    open: isWeb, // 纯 Web 开发模式自动打开浏览器
  },
  plugins: [
    vue(),
    // 仅在非 Web（桌面端）模式挂载 electron 启动与编译插件
    !isWeb &&
      electron({
        main: { entry: "src/main/index.ts" },
        preload: { input: "src/preload/index.ts" },
      }),
  ].filter(Boolean),
});
```

---

## 3. 跨端指令与适配层设计

### 3.1 跨端自定义指令

- `v-if-electron`:
  - 核心逻辑：若 `!isElectron`，直接从父 DOM 移除该节点或设置 `display: none`（推荐使用 `comment` 占位或条件渲染）；
- `v-disabled-electron`:
  - 核心逻辑：若 `!isElectron`，自动为目标元素或组件添加 `is-disabled` 类名、`disabled="true"` 属性，并绑定鼠标悬浮提示“仅 Electron 桌面端支持”。

### 3.2 降级策略实现规范

- **存储 (`store:*`)**：
  - Key 格式：`app:${key}`；
  - 存储时使用 `JSON.stringify` 保持类型，读取时解析，保持与 `electron-store` 行为一致。
- **通知 (`notification:*`)**：
  - 若 `Notification.permission === 'granted'`，使用 `new Notification(title, options)`；
  - 否则请求权限，未授权时降级为 `ElNotification`。
- **窗口 (`window:action`)**：
  - `maximize` / `restore`: 触发 `document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()`；
  - `minimize` / `close`: 触发 `ElMessage.info("纯 Web 环境下窗口由浏览器标签页管理")`。

---

## 4. SPA History 路由双端兼容设计

- 前端：统一采用 `createWebHistory(import.meta.env.VITE_ROUTER_BASE || '/')`；
- Electron 端：在 `src/main/modules/protocol/index.ts` 中的 `app://` 自定义协议增加 SPA fallback 逻辑：
  当请求路径不带扩展名且文件系统不存在时，自动返回 `index.html`，彻底解决桌面端 History 模式在刷新或直接打开深链接时的 404 问题。
