# Relax IPC Validation and Rebuild Docs by Feature

## Goal

1. 优化并放宽 `src/shared/validation.ts` 中 `validate` 的校验逻辑，仅保留对 `allowedChannels`（请求通道）和 `allowedEvents`（事件订阅）的白名单准入核验，移除对参数内容/格式的强行校验。
2. 彻底清理 `docs/` 目录下的全部历史废旧文档。
3. 按照功能域全面重构并新增详细、体系化的中文技术文档，涵盖热更新、全量更新、IPC 与安全隔离、下载中心、通知系统、窗口与托盘、原生系统集成、配置存储与排障诊断、打包构建等。

## Requirements

### 1. IPC 校验简化 (Validation Simplification)

- **`validate` 函数行为调整**：
  - 签名兼容：`validate(channel: string, _args?: unknown[]): void`；
  - 核心逻辑：若 `channel` 存在于 `allowedChannels` 或 `allowedEvents` 中，则判定合法放行；
  - 异常处理：若两者皆不满足，抛出 `Error("Invalid IPC channel or event: " + channel)`；
  - 移除冗长且过于严苛的具体参数类型、数量、正则、长度等校验；
  - 保留 `safeUrl`、`safeLocalPath`、`safeExternalUrl`、`SETTINGS` 工具函数供具体业务域独立使用。
- **单测与集成测试适配**：
  - 更新 `tests/ipc/validation.test.ts`、`tests/system/notification-center.test.ts`、`tests/system/shell-integration.test.ts` 中的参数拒绝断言；
  - 确保全量 48 个测试套件 100% 绿灯通过。

### 2. 清理 `docs/` 目录 (Docs Cleanup)

- 删除当前 `docs/` 下的历史陈旧、分阶段中间态文件（共 17 个 `.md` 文件）。

### 3. 按功能重构 `docs/` 详细中文文档 (Functional Documentation)

- 新增以下全量详细中文文档：
  1. `docs/README.md`：架构概览与功能导航
  2. `docs/hot-update.md`：渲染层资源热更新（ZIP、Ed25519 签名、版本隔离、回滚机制）
  3. `docs/full-update.md`：整包全量自动更新（GitHub Releases / electron-updater、升级门禁）
  4. `docs/ipc-and-bridge.md`：类型安全 IPC 通信与 Preload 安全隔离（双向通道、事件广播、白名单、WebShim）
  5. `docs/download-manager.md`：多任务文件下载中心（并发控制、断点续传、速度计算、通知联动）
  6. `docs/notification.md`：桌面系统通知（频率控制、Tag 覆盖更新、点击路由唤醒）
  7. `docs/window-and-tray.md`：窗口生命周期与系统托盘（自绘无边框标题栏、托盘右键菜单、关闭到托盘）
  8. `docs/system-integration.md`：原生系统集成（Deep Link 协议唤起、全局快捷键、系统主题自适应、Shell 操作、自启动、打印机）
  9. `docs/store-and-diagnostics.md`：数据持久化与排障诊断（electron-store、Schema 迁移、脱敏日志分级、排障压缩包导出）
  10. `docs/build-and-packaging.md`：跨平台打包与发布（electron-builder、环境变量、CI/CD 流水线）

## Acceptance Criteria

- [x] `validate` 仅基于 `allowedChannels` 与 `allowedEvents` 白名单校验，携带任意参数合法通道均能正常放行。
- [x] 无法通过白名单的非法通道/事件一律抛出异常拒绝。
- [x] 全量 Vitest 测试套件全部通过（`vp test` 0 failure）。
- [x] TypeScript 类型检查与代码校验通过（`vp check` 0 error）。
- [x] `docs/` 目录历史旧文档已全部移除，10 篇全新功能中文文档编写完成且内容详实、结构规范。
- [x] 不进行 Git 自动提交。
