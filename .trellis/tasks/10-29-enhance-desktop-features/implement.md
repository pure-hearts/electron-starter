# Implementation Checklist: Enhance Desktop Capabilities (Phase 1)

## Ordered Implementation Plan

- [x] **Step 1: 扩展共享 IPC 协议与校验契约**
  - 在 `src/shared/ipc.ts` 中增加 `window:isMaximized`、`theme:system:get`、`shell:*` 接口定义与事件定义。
  - 在 `src/shared/validation.ts` 中补充 shell 路径与 URL 安全校验函数。

- [x] **Step 2: 主进程实现 Shell 与 Theme 系统模块及 IPC 注册**
  - 创建 `src/main/modules/system/theme-module.ts`，获取系统深浅色与强调色，监听 `nativeTheme.updated` 并广播。
  - 创建 `src/main/modules/system/shell-module.ts`，实现安全的 Shell 打开、回收站、定位操作。
  - 在 `src/main/ipc/handlers/` 中注册对应的 IPC Handler。
  - 在 `src/main/window/main-window.ts` 中注册 `maximize` / `unmaximize` 事件广播。
  - 调整 `src/main/window/options.ts` 窗口选项，支持 Windows/Linux `titleBarStyle: "hidden"`。

- [x] **Step 3: 渲染层自绘标题栏与状态管理**
  - 创建 `src/renderer/components/TitleBar.vue`，实现自绘标题栏与 macOS/Windows/Linux 条件渲染。
  - 更新 `src/renderer/stores/app.ts`，集成系统强调色（Accent Color）与实时最大化状态跟踪。
  - 更新 `src/renderer/App.vue`，引入 `TitleBar.vue` 并绑定 Naive UI 的 `theme-overrides`。

- [x] **Step 4: Playground 集成与功能验证**
  - 在 `src/renderer/views/PlaygroundView.vue` 增加“系统原生 Shell 与外观体验”卡片。
  - 覆盖文件定位、回收站、安全外链打开、强调色展示测试。

- [x] **Step 5: 编写 Vitest 集成测试套件与全量质量校验**
  - 新增 `tests/shell-integration.test.ts`：验证 Shell 路径规范化、文件定位存在性检查、恶意协议注入拦截（如 `file://`、`javascript:`、畸形格式与未授权协议阻断）、回收站模拟等集成策略。
  - 新增 `tests/theme-system-integration.test.ts`：验证系统原生深浅主题策略、原生强调色提取/格式化转换、`theme:system:changed` 广播机制。
  - 运行 `pnpm test` 执行全部 Vitest 测试用例。
  - 运行 `pnpm check` (Vite+ linter & TS check) 与 `pnpm typecheck:vue`。
  - 运行 `pnpm dev:web` 确保 Web 端兼容无报错。

## Validation Commands

```bash
pnpm check
pnpm test
pnpm typecheck:vue
pnpm build
```
