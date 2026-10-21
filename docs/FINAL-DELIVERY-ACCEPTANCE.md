# Electron Starter 最终交付清单与人工验收手册

> 更新日期：2026-10-21；仓库：`pure-hearts/electron-starter`。本清单以已合并至 `main` 的代码和已核查的 CI 为准。**“源码已完成”“CI 通过”“真实设备验收通过”“可正式发布”是四个不同状态。**

## 一、总验收结论

- **基础模板开发：已覆盖最初 22 项系统功能的源码实现。** 包括 Electron + Vue 3 + TypeScript + Vite+、Main/Preload/Renderer 分层、进程安全、双向 IPC、安装包、整包更新、签名 ZIP Renderer 热更新。
- **自动化质量检查：已通过。** 主进程/Preload/Renderer 编译、TypeScript/Vue 检查、单元测试、Electron/Linux Smoke、Windows/macOS/Linux 无签名打包以及 Linux 的 ZIP 热更新模拟集成均有项目 CI 证据。具体应以 GitHub Actions 对应提交的成功运行记录为准。
- **最近新增需求：源码已交付。** 默认 10 路并发、1–50 并发可配置且持久化；统一平台判断；Vite+ 三模式环境；Main Bootstrap、生命周期和 IPC Handlers 领域拆分；NotificationCenter 通知 ID、事件、限频、去重。
- **尚不可判定正式全部验收合格。** 真实 Windows/macOS 桌面交互、正式签名和 Apple 公证、旧版到新版的已签名整包升级、生产 HTTPS CDN/签名密钥的 ZIP 热更新和异常场景没有用户设备验收记录。

## 二、最初 22 项功能交付状态

这里的“已实现”仅指源码中有对应能力，不表示每一种系统已通过真人验收。

| 编号 | 功能 | 源码 | 还需人工确认 |
| --- | --- | --- | --- |
| F01 | Main ↔ Renderer 类型安全 IPC、请求响应、事件推送 | 已实现 | 打开主/子窗口双向收发 |
| F02 | 多窗口、单实例、应用生命周期 | 已实现 | 第二次打开是否唤醒、窗口关闭/重开 |
| F03 | electron-store 持久化及迁移 | 已实现 | 重启后配置保留、损坏配置恢复 |
| F04 | Vue Router | 已实现 | 页面导航和子窗口路由 |
| F05 | Element Plus | 已实现 | 组件正常展示 |
| F06 | 中英双语 | 已实现 | 切换和重启持久化 |
| F07 | 系统托盘 | 已实现 | 最小化/关闭至托盘、托盘唤醒 |
| F08 | 原生菜单和快捷键 | 已实现 | Windows/macOS/Linux 各自显示与快捷键 |
| F09 | Splash 启动画面 | 已实现 | 冷启动可见、主窗口正常接管 |
| F10 | 系统通知 | 已实现；通知中心已升级 | 系统权限、弹窗、点击、关闭与勿扰 |
| F11 | 文件下载 | 已实现；默认 10 并发 | 10 个真实文件同时下载、排队、暂停、取消、失败重试 |
| F12 | 打印及打印机发现 | 已实现 | 连接真实打印机或 PDF 打印 |
| F13 | Deep Link | 已实现 | 点击自定义链接唤醒已安装应用 |
| F14 | Windows/macOS/Linux 开机自启 | 已实现 | 安装后的真实开机登录行为 |
| F15 | electron-updater 整包更新 | 已实现框架 | 实际已签名版本跨版本更新 |
| F16 | Ed25519 签名 ZIP 热更新和回滚 | 已实现；Linux CI 集成验证 | 正式 CDN、真实密钥、Windows/macOS 验收 |
| F17 | Windows NSIS、macOS DMG/ZIP、Linux AppImage/deb | 构建通过 | 下载、安装、卸载、首次启动 |
| F18 | CI、打包、签名发布工作流 | 工作流已有 | 正式发布证书和凭据验证 |
| F19 | Sandbox、ContextIsolation、CSP、安全 IPC | 已实现 | 发布前安全回归及外部导航测试 |
| F20 | electron-log 和日志脱敏 | 已实现 | 故障复现、日志导出和敏感信息确认 |
| F21 | 异常捕获与有限恢复 | 已实现 | 崩溃、重启和异常恢复演练 |
| F22 | Axios 封装与错误分类 | 已实现 | 超时、取消、离线与错误提示 |

## 三、后续需求状态

| 追加需求 | 当前结论 | 判定依据/剩余事项 |
| --- | --- | --- |
| 默认 10 路同时下载 | 已合并源码 | PR #25；真实网络 10 路并发仍需用户验收 |
| 下载并发 1–50，可动态保存 | 已合并源码 | PR #25；重启保留需实际验证 |
| Main/Renderer 统一 `window.$ipcBridge` | 已合并源码 | PR #22；Smoke/Playground 可核实 |
| 平台判断集中 `platform.ts` | 已合并源码 | PR #26 |
| Vite+ development/testing/production | 已合并源码 | PR #26；各环境实际参数需独立检查 |
| Main 入口、Bootstrap、生命周期拆分 | 已合并源码 | PR #26、#27、#28 |
| 按业务域拆分 IPC handlers | 已合并源码 | PR #32，Check/三平台打包通过 |
| 通知 ID、点击、关闭失败事件、限频去重 | 已合并源码 | PR #30、#31；真实操作系统通知仍需检查 |
| 通知偏好持久化 | **未实现** | 需要新增配置键、迁移、Renderer 设置界面、关闭时生效测试 |
| 下载完成/失败自动调用通知中心 | **未实现** | 需要对下载状态去重后触发通知，避免频繁弹窗 |
| 更新就绪的业务通知 | **未实现** | 更新器 ready 事件接入，不能直接自动安装 |
| 通知历史/未读中心 UI | **未实现（可选 P2）** | 不是最初 22 项的阻断目标 |
| 关闭应用后下载任务恢复 | **未实现** | 当前为运行时队列；不能把“pause/resume”误称为跨重启恢复 |
| 所有 Main 业务逻辑逐行解释注释 | **未能确认全部逐行完成** | 核查整库 Main/Preload 的注释覆盖度；新模块有中文解释注释 |
| 所有 docs 使用中文 | **部分存在英文术语，未做全库逐字审计** | 技术标识、代码不应机械翻译；文字段落仍需专项审阅 |

## 四、按顺序执行的验收操作

### A. 先确认源码与 CI

1. 打开 [GitHub Actions](https://github.com/pure-hearts/electron-starter/actions)，进入最新 `main` 的 `Check`、`Cross-platform Package Check`。
2. 确认两项均为绿色 **Success**，并查看提交 SHA 与要测试的安装包来源完全一致。
3. 在开发机执行：

```bash
git clone https://github.com/pure-hearts/electron-starter.git
cd electron-starter
corepack enable
pnpm install --frozen-lockfile
pnpm exec vp check
pnpm run typecheck:vue
pnpm exec vp test --run
pnpm exec vp build
```

**通过标准：** 所有命令退出码为 0；不得仅靠 GitHub 页面显示成功来声称本地环境已经通过。

### B. 三环境验证

```bash
pnpm dev
pnpm dev:testing
pnpm build:testing
pnpm build:production
```

检查仓库根目录 `.env.development`、`.env.testing`、`.env.production`，用无敏感性的测试标识区分对应产物。注意 `VITE_*` 字段会打包进 Renderer，**绝不能写入 API Secret、签名私钥或访问令牌**。编译 mode 不等于 `app.isPackaged`，这两项要分别验证。

**通过标准：** 开发、测试和生产模式均可构建；对应环境标识不串用；正式产物无测试服务地址或秘密。

### C. 下载与 IPC 操作验证

1. 通过 Playground 查询和设置并发上限：先设置为 2，再分别设置为 10 和 20；关闭应用重新启动，确认保存值仍一致。
2. 下载 **11 个合法 HTTPS 文件**，观察默认 10 个传输，第 11 个排队；完成一个后第 11 个才开始。再设置为 2，验证新任务按新上限排队；已经运行的下载不应被强制停止。
3. 为不同任务分别测试暂停、恢复、取消、重试；重复提交相同 URL，确认任务 ID 不串号。
4. 在主窗口和子窗口尝试 `window.$ipcBridge.invoke('app:version')` 和事件订阅，检查请求返回、事件只分发已白名单内容，非法参数被拒绝。

**通过标准：** 每个任务有独立 ID 和进度，任务操作互不影响。需要记录任务截图、下载文件 SHA-256、应用日志。**应用重启后下载继续属于未实现的独立需求，不算当前失败项，但也不能勾选为完成。**

### D. 三平台真实安装与桌面交互（尚未完成）

建议准备一台 Windows 10/11、一台受支持的 macOS 设备和一台常用桌面发行版 Linux；由 GitHub Actions 下载与当前 SHA 一致的 **未签名测试产物**（通常有 7 天保留期）。

依次做：安装 → 首次启动 → 托盘与退出 → 窗口和快捷键 → 通知允许/拒绝 → Deep Link 唤醒 → 打印 → 自启动 → 卸载。Windows 测试包括 SmartScreen 提示的记录；macOS 包括 Gatekeeper、权限和应用重启；Linux 包括 AppImage/deb 及桌面环境差异。

**通过标准：** 每个操作记录「操作系统版本、安装包 SHA-256、步骤、预期结果、实际结果、截图/日志、通过/失败」；测试未签名安装包时安全警告是预期边界，**不应为了测试而建议关闭系统整体安全保护**。

### E. 正式签名、发布和整包升级（尚未完成）

1. 在 `package.json`、`electron-builder.yml` 更新真实产品名称、应用 ID、维护者邮箱、协议、图标、发布仓库；不能继续使用模板身份。
2. 配置合法 Windows 代码签名证书；为 macOS 准备 Apple Developer ID、公证权限和所需 GitHub Secrets：
   `WIN_CSC_LINK`、`WIN_CSC_KEY_PASSWORD`、`MAC_CSC_LINK`、`MAC_CSC_KEY_PASSWORD`、`APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`。
3. 在受保护的测试发布环境建立两个递增版本，例如 `0.1.0` 与 `0.1.1`，分别完成受控发布；标签必须严格匹配 `package.json.version`。
4. 在真实 Windows/macOS 设备安装旧版，检查更新 → 下载新版 → 安装重启 → 比较版本 → 确认用户配置保留。
5. 分别覆盖无网络、下载中断、无权限、取消更新、下载文件不完整等情形。

**通过标准：** 真实设备上证实签名/公证有效并完成旧版到新版的更新，提供安装包和更新元数据的校验值、CI Run、Release 地址、运行日志。GitHub Actions 的签名工作流文件存在 **不意味着已完成正式签名发布**。

### F. ZIP Renderer 热更新（仅 Linux CI 集成已验证）

1. 使用受信任 HTTPS 更新源和自行管理的 Ed25519 公私钥，安装包仅携带**公钥**；在 `resources/app-config.json` 配置 `hotUpdateUrl`。
2. 参考 `docs/updates.md`，生成 Renderer ZIP 和签名清单并上传 CDN；必须保持所发布的 Main/Preload 与 Renderer 接口兼容。
3. 安装旧 Renderer → 触发热更新 → 退出重启 → 检查新界面生效；再分别模拟签名错误、SHA-256 不一致、恶意 ZIP、网络中断、磁盘不足、启动失败。
4. 核验失败时旧资源自动恢复，应用不会卡在白屏。

**通过标准：** Windows/macOS/Linux 所需平台记录真实测试证据；不能以 Linux CI 的临时证书和测试服务替代生产发布验收。绝不可提交 Ed25519 私钥。

## 五、最小验收记录表（每个场景复制一行）

| 编号 | 平台/版本 | 安装包 SHA-256 | 操作 | 预期 | 实际 | 证据链接 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EX-01 | Windows 11 | 待填 | 安装、启动、关闭 | 正常退出或托盘 | 待填 | 待填 | 未验收 |
| EX-02 | macOS | 待填 | 通知点击 | 主窗口恢复并收到 ID | 待填 | 待填 | 未验收 |
| EX-03 | Linux | 待填 | 11 个下载任务 | 默认 10 并发，1 排队 | 待填 | 待填 | 未验收 |
| EX-04 | Windows/macOS | 待填 | 已签名旧版升级新版 | 安装完成且配置保留 | 待填 | 待填 | 未验收 |
| EX-05 | 目标生产平台 | 待填 | ZIP 更新失败回滚 | 返回上次可用资源 | 待填 | 待填 | 未验收 |

## 六、剩余事项优先级与需要用户提供的条件

**发布阻断（P0）**：真实 Windows/macOS 安装测试、有效代码签名与 Apple 公证、签名整包升级、应用发布身份替换、安全回归与生产热更新验收。需要提供目标平台测试设备、开发者/证书权限和测试发布渠道；敏感凭据只放 GitHub Secrets，不应发送在聊天中。

**增强需求（P1）**：通知开关及持久化、下载和更新事件自动通知、下载跨重启恢复；需继续新增模块与测试，可分别独立 PR 实施。

**质量完善（P2）**：通知历史/未读 UI、全部中文文档文字审计、Main/Preload 解释注释覆盖度审计、跨平台打印与多显示器专项回归。部分 P2 可在内部版本发布后继续优化，但如属于实际产品强制要求，应提升优先级。

## 七、结论及签字门槛

- **开发验收：** 最初 22 项源码功能已覆盖，基础项目和后续重构已通过已核查的 CI；不能据此认定每个功能在所有系统环境都通过。
- **交付判定：** 当前适合作为可开发、可构建、可测试的 Electron 企业项目模板；**尚不能签字认定为已完成的正式生产发行版**。
- **最终结项条件：** 发布阻断项的真实设备验收记录全部有证据且通过；正式签名与更新发布成功；没有未解决的 P0 缺陷，最后一次构建的 commit SHA、Release 资产哈希和验收表三者相互对应。

## 八、证据索引

- 已合并：PR #22（IPC 桥接），#25（默认 10 并发及持久化），#26（平台与环境），#27（启动），#28（生命周期），#30/#31（通知中心），#32（Handlers 领域拆分）。
- 最初交付范围：仓库 `PLAN.md`。
- 开发说明：`README.md`、`docs/ipc.md`、`docs/updates.md`、`docs/release.md`。
- 自动化入口：<https://github.com/pure-hearts/electron-starter/actions>。
- 注：文档中的人工验收「未完成」是**未发现可验证的真实设备证据**，并非断言功能在设备上必然失败。
