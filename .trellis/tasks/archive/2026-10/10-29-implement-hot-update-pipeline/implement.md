# Implementation Plan: 增量更新机制与多源发布链路

## Phase 1: 密钥工具与构建打包流升级 [已完成]

- [x] 编写 `scripts/generate-hot-keys.mjs`，生成 Ed25519 私钥 (`hot-update-private-key.pem`) 与公钥 (`resources/hot-update-public-key.pem`)。
- [x] 在 `package.json` 添加 `"hot:keygen"` 与完善 `"hot:pack"` 脚本。
- [x] 升级 `scripts/pack-hot.ts`：自动读取当前 Git Short Hash 与生成时间戳版本，输出标准格式 `[timestamp]_[gitHash]`，同时支持从环境变量注入私钥内容或路径。

## Phase 2: 主进程热更新核心与多源适配 [已完成]

- [x] 在 `src/shared/ipc.ts` 补充 `HotUpdateInfo` 结构体、`hot:state` 与 `hot:restart` IPC 契约。
- [x] 升级 `src/main/modules/update/hot/pointer.ts`：增加 `versionTag` 与 `commit` 字段支持，增加主版本不兼容时的旧缓存自动清理。
- [x] 升级 `src/main/modules/update/hot/manifest.ts`：增加 `versionTag`、`commit` 与 `provider` 解析。
- [x] 升级 `src/main/modules/update/hot/index.ts`：
  - 实现 `getHotUpdateInfo()`；
  - 实现 `applyHotRestart()`（包装 `app.relaunch()` 与 `app.exit(0)`）；
  - 支持 `HOT_UPDATE_DEV_MODE=1` 环境变量，允许开发模式下直接调试热更新全流程；
  - 支持多源 Provider 解析（GitHub Releases / OSS / S3 / Generic）。
- [x] 在 `src/main/ipc/handlers/transfer.ts` 注册对应 IPC 处理器。

## Phase 3: 渲染层交互与控制台升级 (Playground) [已完成]

- [x] 在 `src/renderer/views/Playground.vue` 的更新卡片中，展示当前生效热更版本号徽章（`[timestamp]_[gitHash]`）与生命周期状态（active/staged/none）。
- [x] 增量更新支持检查、显示进度条、温和提示以及就绪后的“立即重启应用”按钮。
- [x] 调试终端输出结构化热更新日志（包含 Provider、目标 URL、Hash、验签结果）。

## Phase 4: 质量验证与自动化测试 [已完成]

- [x] 补充/更新热更新单元测试（覆盖新的 manifest 结构与指针序列化）。
- [x] 运行 `npx vp fmt`、`npx vp check`、`npx vp test run` 确保 100% 格式与测试通过（121 项测试全绿）。
