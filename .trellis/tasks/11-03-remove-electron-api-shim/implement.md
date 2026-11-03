# Implementation Plan: 移除 Electron API Web 降级垫片 (WebShim)

## 阶段一：清理垫片文件与桥接改造 (Phase 1: Bridge & Types Cleanup)

- [x] **1.1 清理类型定义** (`src/renderer/desktop.d.ts`)
  - 移除 `ExtendedDesktopBridge` 及 `__isWebShim` 字段；
  - 直接使用 `DesktopBridge` 作为 `window.$ipcBridge` 的类型。
- [x] **1.2 改造 Bridge 核心** (`src/renderer/bridge/index.ts`)
  - 移除 `createWebShimBridge` 导入；
  - 实现无原生环境下的轻量哨兵拦截实现（返回友好的环境不可用异常或空操作）；
  - 移除对 `__isWebShim` 的条件判断分支。
- [x] **1.3 简化环境探测** (`src/renderer/bridge/platform.ts`)
  - 移除 `!window.$ipcBridge.__isWebShim` 条件；
  - 恢复干净的 `isElectron` 探针。
- [x] **1.4 删除垫片源文件** (`src/renderer/bridge/web-shim.ts`)
  - 彻底删除 `src/renderer/bridge/web-shim.ts`。

## 阶段二：视图与测试适配 (Phase 2: UI & Tests Refactoring)

- [x] **2.1 清理视图组件提示** (`src/renderer/views/Playground.vue`)
  - 删除 `<span v-if-web class="web-mode-hint">Web Shim 降级垫片已激活</span>`；
  - 删除 `.web-mode-hint` 样式。
- [x] **2.2 重构单测用例** (`tests/shared/web-bridge.test.ts`)
  - 移除 `createWebShimBridge` 导入及对其的 mock store/version/event 用例；
  - 保留并完善 `isWeb`、`isElectron` 及 Vue 指令的断言；
  - 添加针对 Bridge 在非 Electron 环境下的哨兵保护测试。

## 阶段三：文档与质量门禁验证 (Phase 3: Verification & Docs)

- [x] **3.1 更新文档**
  - 更新 `docs/file-system-api.md`，清理针对 WebShim 的描述；
  - 更新 `docs/ipc-and-bridge.md` 与 `docs/README.md`；
  - 更新 `PLAN.md` 记录本次移除工作。
- [x] **3.2 全量验证与构建门禁**
  - 运行 `vp check` 验证代码类型与规范（100% 通过）；
  - 运行 `pnpm test` 验证全量测试套件（53 套件 229 项全部通过）；
  - 运行 `vp build` 验证主进程、预加载与渲染进程打包（构建成功）；
  - 运行 `git status` 核对所有变动文件。
