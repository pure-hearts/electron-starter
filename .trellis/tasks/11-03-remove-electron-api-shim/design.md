# Design: 移除 Electron API Web 降级垫片 (WebShim)

## 1. 架构调整与模块边界

移除 `web-shim.ts` 后，渲染进程将全面拥抱“Electron 原生桥接优先”的设计范式。不再维持一套平行且庞大的双轨模拟实现。

```mermaid
flowchart TD
    subgraph 原架构 (Dual-Track with WebShim)
        A1[Renderer Call] --> B1{Is Electron Host?}
        B1 -- Yes --> C1[window.$ipcBridge Native]
        B1 -- No --> D1[createWebShimBridge 800+ lines mock]
        D1 --> E1[LocalStorage & Memory VFS]
    end

    subgraph 新架构 (Clean Desktop Bridge)
        A2[Renderer Call] --> B2{window.$ipcBridge Available?}
        B2 -- Yes --> C2[Active DesktopBridge safe wrapper]
        B2 -- No --> D2[Defensive No-op / Error Sentinel]
    end
```

## 2. 核心模块变更方案

### 2.1 `src/renderer/bridge/index.ts`

- **原逻辑**：若 `window.$ipcBridge` 不存在，执行 `createWebShimBridge()` 并在 `window.$ipcBridge` 上挂载垫片对象。
- **新逻辑**：
  - 如果 `window.$ipcBridge` 存在，调用 `wrapSafeBridge(window.$ipcBridge)` 确保防御性事件监听保护；
  - 如果 `window.$ipcBridge` 不存在（例如在纯浏览器开发调试或缺少 Preload 注入）：
    - 维持一个轻量的哨兵 Bridge（Fallback Sentinel Bridge），提供类型安全的 `invoke` 与 `on`：
      - `invoke(channel, ...args)`：抛出友好明确的 `Error("[DesktopBridge] 原生 IPC 桥接对象不可用: 请在 Electron 环境中运行")`，并输出警告日志；
      - `on(channel, callback)`：输出调试警告并返回空清理函数 `() => {}`；
  - 彻底移除 `createWebShimBridge` 依赖。

### 2.2 `src/renderer/bridge/platform.ts`

- 简化 `isElectron` 探测逻辑：
  ```ts
  export const isElectron =
    typeof __IS_WEB__ !== "undefined"
      ? !__IS_WEB__
      : Boolean(
          typeof window !== "undefined" &&
          (window.process?.versions?.electron !== undefined || Boolean(window.$ipcBridge)),
        );
  ```
  不再需要判断 `!window.$ipcBridge.__isWebShim`。

### 2.3 `src/renderer/desktop.d.ts`

- 简化声明：
  ```ts
  import type { DesktopBridge } from "../shared/ipc";

  declare global {
    interface Window {
      $ipcBridge: DesktopBridge;
      process?: {
        versions?: {
          electron?: string;
        };
      };
    }
  }
  export {};
  ```
  删除 `ExtendedDesktopBridge` 与 `__isWebShim` 属性。

### 2.4 测试套件重构 (`tests/shared/web-bridge.test.ts`)

- 重构测试，移去对 `createWebShimBridge` 的依赖；
- 保留 `isWeb` / `isElectron` 互斥判定测试；
- 保留对指令 `v-if-electron` / `v-if-web` / `v-disabled-electron` 的 DOM 控制测试；
- 增加对缺失 `$ipcBridge` 时防御性错误拦截机制的测试。

---

## 3. 受影响文件清单

| 文件路径                            | 变更类型 | 说明                                   |
| ----------------------------------- | -------- | -------------------------------------- |
| `src/renderer/bridge/web-shim.ts`   | **删除** | 彻底移除 791 行的垫片代码              |
| `src/renderer/bridge/index.ts`      | **修改** | 移除 web-shim 引用，简化 Bridge 初始化 |
| `src/renderer/bridge/platform.ts`   | **修改** | 移除 `__isWebShim` 探测逻辑            |
| `src/renderer/desktop.d.ts`         | **修改** | 移除 `__isWebShim` 类型定义            |
| `src/renderer/views/Playground.vue` | **修改** | 移除 Web Shim 标签及样式               |
| `tests/shared/web-bridge.test.ts`   | **修改** | 移除垫片用例，更新测试                 |
| `docs/file-system-api.md`           | **修改** | 修正文档中的 web-shim 描述             |
| `PLAN.md`                           | **修改** | 记录本次任务变更                       |
