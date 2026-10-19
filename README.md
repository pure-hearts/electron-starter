# Electron Starter

轻量级的 **Electron + Vue 3 + TypeScript + Vite+** 个人桌面应用模板。

[开发计划](PLAN.md) · [开发指南](docs/development.md) · [IPC 规范](docs/ipc.md) · [更新机制](docs/updates.md) · [发布说明](docs/release.md)

## 设计目标

- 单仓库、单应用：不使用 Monorepo
- 清晰的进程目录：`src/main`、`src/preload`、`src/renderer`、`src/shared`
- 类型化 IPC，Preload 白名单、上下文隔离、沙箱及 CSP
- 22 项系统能力：窗口、存储、路由、Element Plus、国际化、托盘、菜单、Splash、通知、下载、打印、Deep Link、自启动、整包更新、ZIP Renderer 热更新、跨平台打包、CI、日志、崩溃恢复、Axios 等
- `src/renderer/views/Playground.vue` 提供交互式系统功能测试面板
- 不包含业务模块和主进程字节码保护

## 开始开发

要求 **Node.js >=24** 和 **pnpm**。本仓库暂未生成依赖锁文件。

```bash
corepack enable
pnpm install
pnpm exec vp dev
```

## 构建与测试

```bash
pnpm exec vp test --run
pnpm exec vp build
pnpm run dist:dir
```

Windows、macOS、Linux 打包命令分别为 `pnpm run dist:win`、`dist:mac`、`dist:linux`。

## 更新

整包更新和 Renderer ZIP 热更新 **默认关闭**，需要在 `resources/app-config.json` 配置 HTTPS 服务器，ZIP 更新另外需要发布公钥及保密的签名私钥。详细步骤见 [更新文档](docs/updates.md)。

## 当前质量状态

这是已推送源代码的**首版实现**，并不代表通过了生产验收。由于当前执行环境无法联网下载依赖，也未在三种系统上运行，构建、安装包、自动更新、热更新回滚、系统集成测试仍待验证。参见 [PLAN.md](PLAN.md)。

## License

MIT
