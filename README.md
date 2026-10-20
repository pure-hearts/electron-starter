# Electron Starter

**轻量级 Electron + Vue 3 + TypeScript + Vite+ 通用桌面项目模板。**

[开发与验收计划](PLAN.md) · [快速开发](docs/development.md) · [IPC 规范](docs/ipc.md) · [更新机制](docs/updates.md) · [发布指南](docs/release.md) · [GitHub Actions](https://github.com/pure-hearts/electron-starter/actions)

## 特点

- **单仓库、单应用**，源码按 `src/main`、`src/preload`、`src/renderer`、`src/shared` 分层
- **Vite+** 构建、类型检查和自动化测试，使用 `vite-plugin-electron` 集成 Electron
- 沙箱化 Renderer + CommonJS Preload + ContextBridge 白名单 + typed IPC + CSP
- Vue 3、Pinia、Vue Router、Element Plus、vue-i18n 和 Axios
- 窗口、菜单、系统托盘、启动界面、通知、下载、打印、Deep Link、开机自启
- electron-store、electron-log、崩溃恢复
- `electron-updater` 整包更新；默认 GitHub Releases 更新源
- 签名的 **Renderer-only** ZIP 热更新，支持下载、校验、重启激活和异常回滚
- Windows NSIS、macOS DMG/ZIP、Linux AppImage/deb
- [Playground](src/renderer/views/Playground.vue) 内置系统功能测试面板

不包含业务模块、Monorepo、后端框架及 V8 字节码保护。

## 环境和运行

需要 Node.js 24+ 和 pnpm 11：

```bash
git clone https://github.com/pure-hearts/electron-starter.git
cd electron-starter
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

## 检查和构建

```bash
pnpm exec vp check
pnpm run typecheck:vue
pnpm exec vp test --run
pnpm exec vp build

pnpm run dist:dir
pnpm run dist:win      # 在 Windows 上执行
pnpm run dist:mac      # 在 macOS 上执行
pnpm run dist:linux    # 在 Linux 上执行
```

## 已获得的自动化验收证据（2026-10-20）

- CI 已通过依赖安装、Vite+ 检查、Vue 类型检查、测试及三个进程的构建。
- Linux CI 已实际启动 Electron，并检查沙箱 Preload 和 IPC；同时对**已打包 Linux 应用**进行了启动烟雾测试。
- Windows/macOS/Linux 无签名测试安装包均由对应平台的 GitHub Actions Runner 构建成功。
- 集成测试在已打包 Linux 应用中，使用**临时 HTTPS 服务和 Ed25519 测试密钥**验证了 ZIP 资源下载、签名校验、激活和中途异常回滚。临时私钥不会打包或提交。

对应流程： [Linux、IPC 和热更新验收](https://github.com/pure-hearts/electron-starter/actions/runs/39367415682) · [Windows/macOS/Linux 安装包构建](https://github.com/pure-hearts/electron-starter/actions/runs/39367187847)。

**重要：这些并不等于正式签名发布已经完成。** Windows/macOS 真实安装使用、Apple 公证及真实签名整包升级需要平台设备和合法发布凭证，仍列为 [待验收事项](PLAN.md)。正式发布工作流对签名凭证实行前置门禁。

## 自定义应用

替换 `electron-builder.yml` 的 `appId`、`productName`、GitHub Releases 仓库信息以及 `package.json` 中的示例邮箱；同步更新 `electron-starter://` 相关协议配置和 `resources/icons/icon.png`。

ZIP 热更新默认不启用，需要配置 `resources/app-config.json` 的可信 HTTPS 更新源及应用中内置的发布公钥。**绝对不要将资源更新签名私钥提交到仓库。**

## License

MIT
