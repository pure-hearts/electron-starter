# PRD: 移除 Electron API Web 降级垫片 (WebShim)

## 1. 目标与背景 (Goal & Background)

在项目早期的跨端探索阶段，为了支持在纯浏览器环境中预览界面与运行部分单测，渲染层引入了庞大的 `src/renderer/bridge/web-shim.ts`（约 800 行代码）。该垫片在纯 Web 端通过 `localStorage`、内存虚拟树、模拟事件总线等方式伪造了 Electron 的全套 IPC 通道（包括文件系统、窗口控制、系统信息、托盘、快捷键、Shell、自动更新等）。

然而随着项目架构向高可靠生产级桌面客户端演进：

1. **维护成本高昂**：每次新增或调整主进程 IPC 通道（如文件系统、快捷键、系统诊断），都必须在 `web-shim.ts` 中手动同步实现一套模拟逻辑；
2. **行为不一致**：内存虚拟实现与真实操作系统存在难以弥合的行为差异，纯 Web 下的伪成功往往掩盖真实桌面环境下的边界缺陷；
3. **架构包袱过重**：单一桌面客户端（Single-package Electron app）无需背负沉重的多端仿真层，渲染进程应直接面向 Preload 注入的严格沙箱类型化 IPC Bridge。

**本次任务目标**：彻底移除 `web-shim.ts` 及渲染进程中所有针对 Electron API 的垫片回退逻辑，精简 Bridge 架构，清理无用类型、指令与测试用例，保证桌面客户端架构的纯净与高效。

---

## 2. 现状调研与代码证据 (Evidence)

经过对当前代码库的排查，相关引用分布如下：

1. **核心垫片文件**：
   - `src/renderer/bridge/web-shim.ts`：791 行代码，包含对 20+ 个 IPC 通道和内存虚拟文件系统的模拟实现。
2. **桥接入口与环境判定**：
   - `src/renderer/bridge/index.ts`：导入 `createWebShimBridge`，在缺失 `window.$ipcBridge` 时回退至 WebShim。
   - `src/renderer/bridge/platform.ts`：通过 `window.$ipcBridge && !window.$ipcBridge.__isWebShim` 辅助判定 `isElectron`。
   - `src/renderer/desktop.d.ts`：声明了 `ExtendedDesktopBridge` 包含 `__isWebShim?: boolean`。
3. **UI 视图与指令**：
   - `src/renderer/views/Playground.vue`：包含 `Web Shim 降级垫片已激活` 文案与 `.web-mode-hint` 样式。
   - `src/renderer/directives/electron.ts`：定义了 `v-if-web` 等指令。
4. **单测套件**：
   - `tests/shared/web-bridge.test.ts`：直接引用 `createWebShimBridge` 测试其存储、版本和事件模拟能力。
5. **文档记录**：
   - `docs/file-system-api.md`、`PLAN.md` 中提及了 WebShim 相关描述。

---

## 3. 详细需求拆解 (Requirements)

### 需求 1：移除 `web-shim.ts` 及其桥接引入

- 删除文件 `src/renderer/bridge/web-shim.ts`。
- 修改 `src/renderer/bridge/index.ts`：
  - 移除 `createWebShimBridge` 的导入与调用；
  - 当不在 Electron 环境（`window.$ipcBridge` 为空）时，提供清晰的安全哨兵或抛出明确友好的错误（提示“当前环境未注入原生 IPC Bridge，请在 Electron 桌面环境中运行”），避免隐性调用导致难以排查的状态问题；
  - 简化 `initBridge` 与 `getBridge` 逻辑。

### 需求 2：清理类型与环境探测中的 Shim 痕迹

- 修改 `src/renderer/desktop.d.ts`：
  - 移除 `__isWebShim` 类型定义，直接将 `window.$ipcBridge` 标为 `DesktopBridge`。
- 修改 `src/renderer/bridge/platform.ts`：
  - 移除对 `__isWebShim` 的判断，基于 `window.process?.versions?.electron` 与 `window.$ipcBridge` 进行纯净的 Electron 桌面环境判定。

### 需求 3：清理 UI 提示与调整相关指令

- 检查 `src/renderer/views/Playground.vue`：
  - 移除 `Web Shim 降级垫片已激活` 标签及对应的 `.web-mode-hint` CSS。
- 检查 `src/renderer/directives/electron.ts` 及相关使用点，确保在无 Shim 状态下表现符合预期。

### 需求 4：重构/更新单测套件

- 重构 `tests/shared/web-bridge.test.ts`（或重命名为 `bridge-platform.test.ts`）：
  - 移除所有对 `createWebShimBridge` 的直接调用与断言；
  - 保留对跨端指令 `v-if-electron` / `v-if-web` / `v-disabled-electron` 以及环境探测标识的测试；
  - 对非 Electron 边界行为添加防御性测试。

### 需求 5：更新项目文档与规划记录

- 更新 `docs/file-system-api.md`，去除关于 WebShim 降级仿真的描述。
- 在 `PLAN.md` 中记录移除 WebShim 的架构优化。

---

## 4. 验收标准 (Acceptance Criteria)

- [ ] 代码库中彻底删除 `src/renderer/bridge/web-shim.ts`，不再存在任何 `__isWebShim` 或 `createWebShimBridge` 代码；
- [ ] `src/renderer/desktop.d.ts` 与 `src/renderer/bridge/` 类型声明完全收敛为纯粹的 `DesktopBridge`；
- [ ] `Playground.vue` 中无多余的 Web Shim 文案或样式残留；
- [ ] 运行 `vp check`（TypeScript 类型检查与 Lint）0 错误、0 告警；
- [ ] 运行 `pnpm test` 全量单测通过；
- [ ] 运行 `vp build` 主进程、预加载脚本与渲染进程构建完全成功。

---

## 5. 超出范围 (Out of Scope)

- 本次任务不废弃 `TARGET_PLATFORM=web` 的纯静态界面打包能力（如果项目仍有纯 Web 静态页面展示需求，但不再为其模拟原生系统 IPC 功能）。
- 本次任务不修改已稳定的主进程 IPC Handler 逻辑与 Preload 白名单配置。
