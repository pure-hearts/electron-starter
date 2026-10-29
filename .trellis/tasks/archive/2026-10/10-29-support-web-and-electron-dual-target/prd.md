# PRD: 支持 Web 与 Electron 双端独立启动及跨端兼容适配

## 1. 业务背景与问题分析

当前前端工程紧密耦合 Electron 主进程：

1. **启动模式单一**：运行 `vp dev` 强制启动并拉起 Electron 客户端窗口，无法在纯浏览器端（Chrome/Safari/Firefox/移动端）单独运行和调试；
2. **跨端崩溃风险**：渲染层部分代码直接访问全局 `window.$ipcBridge`，在纯 Web 环境下该对象为 `undefined`，调用任何方法均会导致应用崩溃；
3. **部署形态受限**：无法独立构建纯静态 Web 产物部署至 CDN/Nginx/静态托管平台。

为了让项目既能作为高性能的 Electron 桌面客户端，又能作为纯 Web SPA 独立运行与部署，需实现**双端启动解耦**与**跨端适配降级层**。

---

## 2. 核心需求与设计决策（经 /grill-me 确认）

### 2.1 启动与构建流解耦（独立 Web 模式）

- **`pnpm dev:web`**：仅启动前端 Vite 开发服务器，直接在浏览器中打开页面（`http://localhost:5173`），完全不启动 Electron 桌面进程；
- **`pnpm build:web`**：仅编译标准 Web 静态资源（产出到 `dist/web`），支持静态站点部署；
- **`pnpm dev` 与 `pnpm build`**：保持原有完整的 Electron 桌面应用行为 100% 不变。

### 2.2 跨端透明垫片与 API 接入风格

- **全局透明垫片**：在 Web 模式启动时，自动将 Web Shim 挂载到 `window.$ipcBridge`，现有业务代码和 Store 零改动即可平滑运行；
- **Composable 封装**：提供 `usePlatform()` 钩子（导出 `isElectron`、`isWeb`、`platform`）与 `useBridge()` 供组件按需使用。

### 2.3 UI 呈现策略与 Vue 自定义指令

- **桌面专属能力温和反馈**：对于桌面专属功能（自启动、关闭到托盘、整包更新等），Web 端保留操作入口，点击时由系统提供温和明确的提示（“开机自启动为桌面客户端专属能力”）；
- **全局自定义指令**：
  - `v-if-electron`：仅在 Electron 环境下渲染该 DOM 元素（Web 端自动移除）；
  - `v-disabled-electron`：在非 Electron 端自动将元素或按钮置灰禁用，并自动添加 Tooltip 提示“仅 Electron 桌面端可用”。

### 2.4 本地存储降级规范

- Web 端自动降级至浏览器 `localStorage`；
- 采用命名空间前缀 `app:[key]`（如 `app:theme`、`app:locale`），并进行自动 JSON 序列化与类型转换，杜绝同域名键名污染。

### 2.5 统一采用 HTML5 History 路由模式

- 路由统一升级为 `createWebHistory(import.meta.env.VITE_ROUTER_BASE || '/')`；
- Electron 端的自定义协议 `app://renderer` 增加 SPA 路径重写（Rewrite 回退机制：请求非静态资源文件不存在时自动回退返回 `index.html`），确保双端在 History 模式下刷新页面均不 404。

---

## 3. 验收标准

- [ ] 新增 `pnpm dev:web` 与 `pnpm build:web` 脚本，在浏览器中可秒级独立运行；
- [ ] 纯 Web 环境下无任何 `undefined` 运行时白屏异常，控制台保持干净；
- [ ] Web 端下主题切换、语言切换、通知测试、本地存储读写等功能正常可用；
- [ ] 支持 `v-if-electron` 与 `v-disabled-electron` 自定义指令；
- [ ] Electron 桌面端与 Web 端均采用 History 路由，刷新页面不 404；
- [ ] 全量自动化测试、静态类型与代码格式校验全部通过。
