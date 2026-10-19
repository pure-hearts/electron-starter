# Electron Starter

轻量级 Electron + Vue 3 + TypeScript + Vite+ 个人桌面应用模板。

> 当前处于初始开发阶段。以 `PLAN.md` 为实现与验收清单，未完成的模块不得宣称生产可用。

## 架构

- `src/main`：Electron 生命周期与系统模块
- `src/preload`：安全的 contextBridge 桥
- `src/renderer`：Vue 3 + Element Plus 应用
- `src/shared`：跨进程 TypeScript 类型

## 开发

需要 Node.js 24+ 与 pnpm：

```bash
corepack enable
pnpm install
pnpm dev
pnpm build
```

详细任务及完成状态见 [PLAN.md](./PLAN.md)。

## 安全

Renderer 默认启用上下文隔离、沙箱并关闭 Node Integration；不向页面暴露任意 Node/Electron API。

## 许可

MIT
