# 开发指南

## 环境要求

需要 Node.js 24 或更高版本、pnpm 11，并通过项目本地安装的 `pnpm exec vp` 使用 Vite+。

```sh
corepack enable
pnpm install
pnpm exec vp dev
pnpm exec vp check
pnpm exec vp test --run
pnpm exec vp build
```

项目使用 `pnpm-lock.yaml` 锁定依赖版本。安装依赖时应优先保持锁文件一致；依赖升级后须审核变更并提交更新后的锁文件。

主进程和预加载脚本由 `vite-plugin-electron/simple` 构建；渲染进程由 Vite+ 构建。源代码分别位于 `src/main`、`src/preload`、`src/renderer` 和 `src/shared`。

安装包会携带 `resources/app-config.json` 中的运行时配置。未配置 HTTPS 更新地址时，对应的自定义更新服务不会启用。

```sh
pnpm run dist:dir
pnpm run dist:win
pnpm run dist:mac
pnpm run dist:linux
```

建议使用对应操作系统的真实设备或 GitHub Actions 运行器构建安装包。

## 为什么不使用 Monorepo（多包仓库）？

项目目前只有一个桌面应用。共享的 IPC 类型定义是普通 TypeScript 文件，无需拆分为独立软件包，也不需要额外的多包构建调度。

## 沙箱模式下的预加载脚本

渲染窗口启用了 `sandbox: true`。Electron 的沙箱预加载环境不能直接使用 ESM 导入，因此 `src/preload/index.ts` 会打包为 CommonJS 格式的 `dist-electron/preload.cjs`。主进程仍采用 ESM，输出文件为 `dist-electron/main.js`。

## 开机自启动行为

Windows 和 macOS 使用 Electron 的登录启动项接口。Linux 使用 XDG 自启动桌面条目 `~/.config/autostart/electron-starter.desktop`，也支持通过 `XDG_CONFIG_HOME/autostart` 指定目录。

Linux 自启动登记必须在已打包应用中执行；开发版本会主动拒绝创建此启动项。

## 当前 CI 已验证的内容

Linux 的 `Check` 工作流依次运行 `vp check`、`vue-tsc --noEmit`、`vp test --run`、`vp build`、开发环境 Electron 运行冒烟测试、Linux 已打包应用冒烟测试，以及通过 HTTPS 签名 ZIP 完成资源安装、激活和异常回滚的集成测试。

独立的 `Cross-platform Package Check` 工作流会在 Windows、macOS、Linux GitHub 运行器上生成未签名的安装包。相关运行链接见仓库根目录的 README。

## P1 配置、下载和 Deep Link

- Electron 的配置文件会自动迁移到结构版本 1。无效字段和异常窗口尺寸会恢复为安全默认值。
- 渲染进程仅在首帧使用 `localStorage` 缓存语言设置；持久化语言切换必须成功写入 `electron-store`。
- 下载任务采用先进先出（FIFO）队列，同一时间仅执行一个任务。失败任务可以通过 `download:retry` 重试，排队中的任务可以单独取消。HTTPS 下载会在重定向后再次检查目标地址；但 DNS 重绑定和操作系统网络路由等风险，在处理不可信下载目标前仍需进一步安全审核。
- Vue 页面订阅之前收到的 Deep Link 会暂存；初始化时通过 `protocol:pending` 一次性领取。
- 渲染进程诊断日志会尽力对常见凭据模式进行脱敏。此处理不能替代权限验证，也不能保证识别所有敏感信息。
