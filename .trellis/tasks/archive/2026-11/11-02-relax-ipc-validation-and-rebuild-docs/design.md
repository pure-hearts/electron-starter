# Technical Design: Relax IPC Validation and Rebuild Docs

## 1. IPC Validation Simplification

### 当前现状分析

原有 `src/shared/validation.ts` 中的 `validate(channel, args)` 实现了极其冗长的针对每个通道参数个数、类型、格式、字段值的命令式校验（如 `noArgs`、`store:set`、`notification:send` 结构等等）。这种强耦合导致：

1. 上层业务扩展通道时，必须同时在 `ipc.ts`、`allowedChannels` 和 `validate()` 多处重复维护参数逻辑。
2. 部分前端合法调用若参数稍有未列入字段就会抛出 `IPC_INVALID_ARGUMENTS` 异常，灵活性差。

### 改造方案

将 `validate` 的职责收拢为**通道准入网关**：

```typescript
export function validate(channel: InvokeChannel | EventChannel | string, _args?: unknown[]): void {
  if (
    !allowedChannels.has(channel as InvokeChannel) &&
    !allowedEvents.has(channel as EventChannel)
  ) {
    throw new Error("Invalid IPC channel or event: " + channel);
  }
}
```

- 保留 `safeUrl`、`safeLocalPath`、`safeExternalUrl` 作为纯工具函数供具体模块（如 `download-manager`、`shell-module`）在业务层直接调用。
- 保留 `SETTINGS` 集合供 store 模块使用。
- Preload 和 Main 进程的参数类型安全统一由 `src/shared/ipc.ts` 强类型定义（`DesktopInvoke`、`DesktopEvents`）保障。

---

## 2. Docs Architecture Design

重构后的 `docs/` 采用清晰的功能域架构，避免零散的阶段演进日志，转为生产级技术参考手册：

```text
docs/
├── README.md                 # 架构导航与系统能力总览
├── hot-update.md             # 渲染层资源热更新 (Ed25519, ZIP, 回滚)
├── full-update.md            # 整包全量自动更新 (GitHub Releases, electron-updater)
├── ipc-and-bridge.md         # 类型安全 IPC 通信与 Preload 安全隔离
├── download-manager.md       # 多任务文件下载中心与断点续传
├── notification.md           # 桌面系统通知中心与交互联动
├── window-and-tray.md        # 窗口生命周期与系统托盘管理
├── system-integration.md     # 原生系统集成 (Deep Link, 快捷键, Shell, 打印)
├── store-and-diagnostics.md  # 配置持久化与脱敏排障诊断
└── build-and-packaging.md    # 跨平台构建打包与 CI/CD 规范
```

每个文档均遵循统一规范：

1. **功能定位与核心价值**
2. **架构流程与设计思路**（含 Mermaid 流程图或时序图）
3. **关键实现与代码路径**
4. **IPC 契约与配置规范**
5. **常见问题排查与注意事项**
