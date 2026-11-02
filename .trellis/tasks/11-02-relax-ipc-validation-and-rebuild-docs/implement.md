# Implementation Plan: Relax IPC Validation and Rebuild Docs

## Steps

### Step 1: Relax `validate` in `src/shared/validation.ts`

- [x] 简化 `validate(channel, _args)` 实现，仅检查 `allowedChannels.has(channel)` 或 `allowedEvents.has(channel)`。
- [x] 保留 `safeUrl`、`safeExternalUrl`、`safeLocalPath` 与 `SETTINGS` 导出。

### Step 2: Update Tests

- [x] 修改 `tests/ipc/validation.test.ts`，验证白名单内合法通道和事件放行（无论参数内容），验证白名单外非法通道抛出错误。
- [x] 修改 `tests/system/notification-center.test.ts`，去除对 `validate` 参数严苛校验的断言。
- [x] 修改 `tests/system/shell-integration.test.ts`，调整 `IPC Validation Channel Integration` 测试。
- [x] 运行 `vp test` 确保 48 个套件全部通过。

### Step 3: Remove All Existing Docs in `docs/`

- [x] 删除 `docs/` 下原有的 17 个历史旧文件。

### Step 4: Write New Functional Documentation in `docs/`

- [x] `docs/README.md`
- [x] `docs/hot-update.md`
- [x] `docs/full-update.md`
- [x] `docs/ipc-and-bridge.md`
- [x] `docs/download-manager.md`
- [x] `docs/notification.md`
- [x] `docs/window-and-tray.md`
- [x] `docs/system-integration.md`
- [x] `docs/store-and-diagnostics.md`
- [x] `docs/build-and-packaging.md`

### Step 5: Verification & Quality Gate

- [x] 运行 `vp check` 验证代码类型与语法规范（0 errors）。
- [x] 运行 `vp test` 运行完整测试套件（48 suites, 192 tests all passed）。
- [x] 检查 git 状态，确保未执行 git 提交。
