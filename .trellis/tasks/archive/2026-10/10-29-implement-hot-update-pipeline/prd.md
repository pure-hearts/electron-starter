# PRD: 增量更新机制与多源发布链路

## 1. 业务背景与目标

整包更新（100MB+）涉及下载安装向导并覆盖应用，耗费带宽且流程较长。增量更新（Hot Update）专注于在**不替换主进程、Preload 与原生二进制**的前提下，对 `dist/renderer` 静态前端资源进行轻量热替换（通常仅 2~5MB）。
本任务旨在建立一套安全、可靠、支持多源分发并兼顾开发体验的增量热更新全链路机制。

---

## 2. 核心需求与设计决策（经 /grill-me 确认）

### 2.1 多源托管与分发支持

- **支持多源切换**：系统支持通过环境变量动态配置分发源：
  - `github`: 从 GitHub Releases 获取 `hot-manifest.json` 与 `renderer-[rev].zip`；
  - `oss` / `s3` / `generic`: 从自定义云存储或 CDN 地址获取。
- 环境变量规范：
  - `HOT_UPDATE_PROVIDER`: 分发渠道（`github` | `oss` | `s3` | `generic`，默认 `generic`）；
  - `HOT_UPDATE_URL`: Manifest 地址（如 `https://cdn.example.com/hot-manifest.json`，或 GitHub Releases 对应的 Raw/API 地址）。

### 2.2 版本号体系与问题追溯

- **版本号格式**：`时间戳_Git提交版本号`（例如 `20261029173000_be18d80`）。
- **比较逻辑**：使用数值型时间戳（`20261029173000`）进行单调递增比对，判断是否存在新版本。
- **问题排查**：Git 提交 Hash 随 Manifest 与当前运行时指针（`current.json`）落盘，并在 Playground 诊断终端中高亮展示，便于快速定位线上问题对应的代码版本。
- **主版本兼容与清空**：严格记录 `compatibleApp`（客户端大版本），整包升级后自动清理旧版本热更缓存，防止版本冲突。

### 2.3 温和生效与用户自主重启策略

- **下载阶段**：后台静默下载、SHA-256 校验与解压到隔离目录（`userData/renderer-updates/rev-[timestamp]`）。
- **生效交互**：
  - 下载并校验就绪后写入指针（`phase = "staged"`）；
  - 界面与系统通知温和提醒：“资源更新已就绪，重启应用后生效”；
  - 提供显式“立即重启”按钮（调用 `app.relaunch()` 与 `app.exit(0)`）；
  - 用户若不重启，不中断当前操作，应用在下次正常启动时静默生效。

### 2.4 安全密钥与签名机制

- **签名算法**：Ed25519 非对称加密数字签名 + ZIP 文件 SHA-256 哈希校验。
- **密钥管理**：
  - 提供 `pnpm hot:keygen` 命令行工具一键生成公私钥；
  - 客户端通过 `resources/hot-update-public-key.pem` 内置公钥；
  - 私钥绝不打包进客户端，通过环境变量 `HOT_UPDATE_PRIVATE_KEY`（私钥内容）或 `HOT_UPDATE_PRIVATE_KEY_PEM_PATH`（私钥路径）安全注入；
  - 提供 `HOT_UPDATE_DEV_MODE=1` 环境变量，允许开发期免打包联调。

### 2.5 构建与发布支持（本地 + CI/CD 双模）

- **本地命令**：`pnpm hot:pack`，一键编译前端、自动提取时间戳与当前 Git SHA、读取私钥签名、在 `release/hot-update/` 生成产物。
- **CI/CD 流水线**：支持通过 GitHub Actions 等外部流水线读取云端 Secrets 私钥自动打出热更包并上传对应分发源。

### 2.6 启动自愈与崩溃回滚

- 生命周期遵循 `staged` -> `trying` -> `active`；
- 主窗口加载成功触发 `hot:confirm` 后才转为 `active`；
- 若新资源启动崩溃未能完成健康确认，下次启动自动回退至上一稳定版本（`previous`）。

---

## 3. 验收标准

- [ ] 提供一键生成 Ed25519 密钥对脚本 `scripts/generate-hot-keys.mjs`；
- [ ] 完善热更新打包构建脚本 `scripts/pack-hot.ts`，自动生成 `时间戳_Git提交版本号` 并支持环境变量注入私钥；
- [ ] 主进程热更新协调器支持多源配置、环境变量解析、`hot:state` 查询与 `hot:restart` 一键重启；
- [ ] 视图层 Playground 完美接入增量更新状态展示（版本号徽章、Git Hash、下载进度条、立即重启按钮）；
- [ ] 自动化测试全部通过（`npx vp check` 0 错误、`npx vp test run` 100% 通过）。
