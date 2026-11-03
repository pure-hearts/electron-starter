# Electron Starter 功能与技术文档总览

欢迎查阅 `electron-starter` 官方技术与架构文档。本项目是一个面向商业化生产环境的单仓库（Single-package）轻量级 Electron 桌面应用脚手架，采用 **Vue 3 + TypeScript + Vite+ (`vp`) + Naive UI** 技术栈，预置并验证了桌面端生产所需的 22 项核心通用系统能力。

---

## 目录索引与功能导航

| 功能模块             | 文档链接                                               | 核心技术点与解决问题                                                         |
| :------------------- | :----------------------------------------------------- | :--------------------------------------------------------------------------- |
| **资源热更新**       | [hot-update.md](./hot-update.md)                       | 纯渲染层增量更新、ZIP 解包安全、Ed25519 签名防篡改、崩溃自动回滚             |
| **整包全量更新**     | [full-update.md](./full-update.md)                     | 基于 GitHub Releases 与 electron-updater、静默下载、安装门禁与降级防范       |
| **IPC 与安全隔离**   | [ipc-and-bridge.md](./ipc-and-bridge.md)               | 强类型双向 IPC 契约、Preload 沙箱最小暴露、白名单准入、防御性哨兵拦截        |
| **多任务下载中心**   | [download-manager.md](./download-manager.md)           | 并发调度队列、断点续传（Range）、速度计算、历史持久化、通知定位联动          |
| **桌面系统通知**     | [notification.md](./notification.md)                   | 原生桌面通知中心封装、10秒防刷屏频控、Tag 替换覆盖、点击聚焦与路由联动       |
| **窗口与系统托盘**   | [window-and-tray.md](./window-and-tray.md)             | 自绘无边框标题栏、交通灯自适应、关闭到托盘、托盘菜单、窗口位置尺寸持久化     |
| **系统原生集成**     | [system-integration.md](./system-integration.md)       | Deep Link 协议唤起、全局快捷键、系统主题自适应、安全 Shell、开机自启、打印   |
| **配置持久化与诊断** | [store-and-diagnostics.md](./store-and-diagnostics.md) | electron-store 配置存储与 Schema 版本迁移、分级脱敏日志、一键导出排障 ZIP    |
| **文件系统 API**     | [file-system-api.md](./file-system-api.md)             | 全功能异步 Promise 文件操作、fs-extra 兼容、智能保底、流式哈希、类型安全契约 |
| **构建、打包与部署** | [build-and-packaging.md](./build-and-packaging.md)     | electron-builder 多平台打包配置、环境变量注入、代码签名策略与 CI/CD 流水线   |

---

## 架构核心原则

1. **严格的四目录分层**：
   - `src/main`：主进程代码（系统模块、原生 API 集成、生命周期控制、安全网关）。
   - `src/preload`：受限沙箱预加载脚本，仅暴露强类型安全桥接对象 `window.$ipcBridge`。
   - `src/renderer`：Vue 3 渲染层（路由、Pinia 状态、Naive UI 组件库与业务视图）。
   - `src/shared`：主进程与渲染进程共享的代码（IPC 接口契约、白名单、常量与安全工具函数）。

2. **单文件单一模块**：
   - 不引入过度设计的依赖注入（DI）容器或臃肿的后端服务层，每个系统能力封装在独立清晰的模块中。

3. **纵深防御与最小特权**：
   - 渲染层禁止访问 Node 原生 API 与 Electron 内部事件对象；
   - 所有 IPC 通信经由 `allowedChannels` 和 `allowedEvents` 白名单隔离；
   - 敏感文件读写、下载与 Shell 打开均进行协议与路径穿越校验。
