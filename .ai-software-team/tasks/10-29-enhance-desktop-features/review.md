# Code Review Report: Enhance Desktop Features (Phase 1)

## 1. 审查概览与结论

- **审查对象**：Phase 1 跨平台自绘标题栏、系统主题/强调色联动、Shell 安全集成与 Web 端降级适配
- **审查人**：Code Review Engineer
- **审查结论**：✅ **通过 (PASS)**
- **代码影响面**：
  - 主进程：`shell-module.ts`、`theme-module.ts`、`options.ts`、`main-window.ts`、`ipc/handlers/*`
  - 渲染进程：`TitleBar.vue`、`stores/app.ts`、`App.vue`、`web-shim.ts`、`Playground.vue`、`index.css`
  - 共享层与契约：`src/shared/ipc.ts`、`src/shared/validation.ts`
  - 测试套件：`tests/shell-integration.test.ts`、`tests/theme-system-integration.test.ts`、`tests/ipc-gateway.test.ts`

---

## 2. 核心维度逐项审查

### 2.1 安全性 (Security) — ⭐⭐⭐⭐⭐ (PASS)

- **协议白名单防注入**：
  - `safeExternalUrl` 采用严格白名单限制，仅放行 `http:`、`https:`、`mailto:`；
  - 坚决阻断 `javascript:`、`data:`、`file:`、`vbscript:` 等本地利用与 XSS 伪协议；
  - 在主进程底层调度 `shell.openExternal` 之前与参数校验门禁中双重校验。
- **本地文件路径防逃逸**：
  - `safeLocalPath` 防御空字节（`\0`）截断注入与空路径；
  - `showItemInFolder` 与 `trashItem` 进行了 try/catch 防御，避免底层系统由于文件占用、权限不足抛出未捕获异常。
- **错误信息隔离**：
  - IPC 调度层遇到异常时统一抛出语义化错误，未向渲染进程泄露底层文件系统的敏感物理绝对路径。

### 2.2 正确性与边界行为 (Correctness & Edge Cases) — ⭐⭐⭐⭐⭐ (PASS)

- **跨平台强调色兼容**：
  - `normalizeAccentColor` 针对 Windows/macOS 平台进行 `#RRGGBB` 标准化，兼容了带 `#`、小写、含 Alpha 值的 8 位十六进制色（如 `007affff`）；
  - Linux 平台安全降级返回 `null`，前端对应回退至默认主题色。
- **多窗口架构下的最大化判断**：
  - `window:isMaximized` 使用 `BrowserWindow.fromWebContents(e.sender)`，操作与判断仅针对消息发起窗口自身，非全局硬编码主窗口，完全契合多窗口规范。
- **无边框窗口自绘与原生行为一致性**：
  - Windows/Linux 配置 `titleBarStyle: "hidden"`，右侧集成控制按钮；
  - macOS 配置 `titleBarStyle: "hiddenInset"`，保留 `76px` 留白以避免拖拽区域覆盖原生红绿灯，双击标题栏排除交互控件（`button`、`input`、`.no-drag`）。

### 2.3 并发与内存安全 (Concurrency & Memory Safety) — ⭐⭐⭐⭐⭐ (PASS)

- **事件监听幂等注册**：
  - `appStore.setupBridgeSubscriptions()` 内维护了全局单例标志位与注销引用，多次调用 `hydrate()` 不会重复挂载 `theme:system:changed` 与 `window:maximize-change` 监听器，消除内存泄露风险。
- **窗口移动/缩放防抖**：
  - `main-window.ts` 中针对 `boundsTimer` 保持 400ms 防抖持久化机制，最大化事件单独推送状态广播，两者互不阻塞。

### 2.4 性能与用户体验 (Performance & UX) — ⭐⭐⭐⭐⭐ (PASS)

- **主题色阶毫秒级派生**：
  - `adjustHexBrightness` 采用纯位运算派生 Hover/Pressed 色值，无第三方重型色彩库引入。
  - 联动 CSS 变量 `--app-primary`，使得非 Naive UI 的原生 HTML/CSS 样式也能同步感知系统强调色。
- **双端同构零破坏**：
  - `web-shim.ts` 补充了全部新通道的降级处理，纯浏览器启动模式下不会触发 `undefined IPC` 假报错。

---

## 3. 验证证据 (Verification Evidence)

| 验证项                      | 执行命令             | 状态    | 耗时 / 结果                           |
| :-------------------------- | :------------------- | :------ | :------------------------------------ |
| **全量 Vitest 测试套件**    | `pnpm test`          | ✅ PASS | 39 test files, 149 passed (739ms)     |
| **Vue TypeScript 检查**     | `pnpm typecheck:vue` | ✅ PASS | 0 errors                              |
| **Vite+ 代码质量与格式化**  | `pnpm check`         | ✅ PASS | 0 errors, 241 files formatted         |
| **纯 Web 端构建门禁**       | `pnpm build:web`     | ✅ PASS | dist/web 构建成功 (226ms)             |
| **Electron 桌面端全量打包** | `pnpm build`         | ✅ PASS | dist/renderer + dist-electron (282ms) |
