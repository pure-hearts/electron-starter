# PRD: Download Feature Optimization and Architecture Encapsulation

## 1. 目标与用户价值 (Goal & User Value)

全面升级应用内的下载管理能力，重构目前散落在 Playground 视图中的下载逻辑，打造工业级、低资源消耗、高可靠性的全功能下载系统。通过 Node.js 原生 SQLite 持久化、主进程 IPC 节流、EMA 平滑速度算法、原子临时文件落盘，以及全局抽屉式下载中心，为用户提供丝滑、稳定且可控的文件下载体验。

---

## 2. 现状与已确认事实 (Confirmed Facts)

1. **主进程核心架构**：
   - [`manager.ts`](file:///Users/vyron/Mine/electron-starter/src/main/modules/download/manager.ts) 实现了基于状态机的 `DownloadManager`，只依赖抽象接口 `DownloadPorts` 与 `NativeDownload`，具备零依赖单测能力。
   - [`queue.ts`](file:///Users/vyron/Mine/electron-starter/src/main/modules/download/queue.ts) 实现了 `DownloadQueue`，支持动态并发上限（1~50）与启动握手严格串行认领（解决 Electron `will-download` 缺乏任务元数据关联的竞态痛点）。
   - [`index.ts`](file:///Users/vyron/Mine/electron-starter/src/main/modules/download/index.ts) 适配了 Electron `session.defaultSession`，持久化配置并发数，并集成系统通知。
2. **运行环境支持**：
   - 项目运行在 Node >= 24，内建原生 `node:sqlite`（`DatabaseSync`），无需引入外部 C++ 编译依赖（如 `better-sqlite3`），可安全高效地实现下载历史全量持久化。

---

## 3. 核心需求与设计决议 (Decided Requirements)

### 3.1 下载历史全量持久化 (SQLite Storage)

- **存储方案**：使用 Node 24 原生 `node:sqlite`（位于用户数据目录 `userData/downloads.db`）。
- **数据结构**：记录任务 `id`, `url`, `filename`, `path`, `total_bytes`, `received_bytes`, `state`, `created_at`, `completed_at`, `error_message`。
- **存活性检查**：加载历史记录时，异步检测本地磁盘文件是否存在（`fs.existsSync`），若被手动删除，UI 明确标红“文件已失效/已移除”并禁用“打开”按钮。
- **历史管理**：支持按时间排序检索、单条删除、清空已完成记录、统计累计下载流量。

### 3.2 发起下载与并发调度 (Task Initiation & Concurrency)

- **协议白名单**：通过 `safeUrl` 严格拦截非法协议（仅允许 http/https），防止协议注入。
- **并发与排队**：沿用串行启动握手机制，超出并发上限的任务平滑进入 `queued` 队列，按 FIFO 调度。
- **任务唯一性**：每次启动分配独立 UUID，支持传入自定义保存文件名或自动解析 Content-Disposition。

### 3.3 进程性能优化与进度计算 (Process Optimization & Progress)

- **主进程 IPC 节流（250ms）**：
  - 对单个任务高频触发的 `progress` 字节增长事件做 `250ms` 时间窗口节流合并；
  - 关键状态改变（`queued`, `started`, `paused`, `interrupted`, `completed`, `cancelled`, `failed`）立即发出，零延迟；
  - 彻底规避大文件高速下载时高频 IPC 阻塞主事件循环与渲染进程帧率（FPS）。
- **平滑速度 (EMA) 与 ETA 计算**：
  - 主进程使用指数移动平均（EMA，$\alpha = 0.3$）平滑瞬时网速抖动，输出稳定的每秒速率（B/s）；
  - 基于剩余未完成字节数精确计算预估剩余时间（ETA 秒数），流式未知大小时安全置空。

### 3.4 大文件下载与原子落盘 (Large Files & Atomic Disk Writes)

- **临时文件机制**：下载进行中保存为 `${targetPath}.download` 临时文件，杜绝未完成文件的脏读风险。
- **智能防覆盖**：目标目录若已存在同名文件，自动追加递增序号（如 `filename (1).ext`），绝不静默覆盖已有文件。
- **原子重命名**：文件完整传输且终态校验通过后，使用 `fs.promises.rename` 原子落盘为正式文件。
- **异常清扫**：任务取消或彻底失败时，异步清理未完成的 `.download` 残留文件，防止磁盘碎片积压。

### 3.5 网络中断与断点续传 (Interrupted & Manual Resumption)

- **中断感知**：Electron `interrupted` 事件捕获，结合 `item.canResume()` 判断服务端 `Range` 支持。
- **严格手动触发决议**：
  - 遇到断网或网络波动时，状态平滑进入 `interrupted` 并保留下载断点；
  - UI 明确展示“网络已中断，可点击恢复”标签；
  - **绝不在后台隐式重试**，完全由用户点击“恢复/重试”按钮触发，给用户最高确定性与带宽掌控权。

### 3.6 系统通知与文件定位 (Notifications & Action)

- **下载完成通知**：触发系统原生桌面通知，展示文件名与文件体积。
- **定位文件决议**：用户点击系统通知时，唤醒主窗口并调用 `shell.showItemInFolder(path)` 在系统文件管理器中高亮定位该文件。
- **免打扰**：遵循全局偏好设置 `notifyOnDownload` 与任务去重。

### 3.7 UI 表现层设计 (Global Drawer & Badge)

- **全局下载抽屉 (Global Drawer)**：在应用顶部 TitleBar 常驻下载图标按钮：
  - 动态徽标展示：当前正在进行的下载任务数量；
  - 环形/线性微型进度条：展示全局下载进度概览；
  - 点击按钮：滑出全局统一的“下载中心”抽屉面板，支持全局查看全部任务、历史记录、速度、暂停/恢复/重试/定位文件。
- **Playground 页面协同**：重构 `Playground.vue`，接入统一的 Pinia `useDownloadStore`，保留专业调试与压测入口。

---

## 4. 验收标准 (Acceptance Criteria)

- [x] **性能保护**：
  - [x] 10 路满速大文件并发下载时，IPC 派发频率严格受控在每秒 $\le 4$ 次/任务（250ms 窗口），界面滚动与窗口拖拽 60fps 丝滑无卡顿。
  - [x] 主进程与渲染进程均无定时器与事件监听器泄漏。
- [x] **数据库持久化**：
  - [x] 任务创建、进度完成、错误与路径完整存入 SQLite `downloads.db`。
  - [x] 应用重启后，历史任务能完整恢复并在界面展示，手动删除的文件能正确识别并标记为“已失效”。
- [x] **断点续传与网络中断**：
  - [x] 支持 Range 请求的文件在暂停或 interrupted 后，手动点击“恢复”能从断点继续传输，不从零重下。
- [x] **文件安全与原子落盘**：
  - [x] 过程中为 `.download`，完成后原子变为正式文件名；同名文件自动追加 `(1)`，未完成取消时临时文件被彻底清除。
- [x] **通知与操作**：
  - [x] 完成通知点击精准唤起系统文件管理器并选中目标文件。
- [x] **全局 UI 交互**：
  - [x] 标题栏下载徽标与抽屉工作正常，任务状态操作与历史清理功能完整。
- [x] **工程质量**：
  - [x] 单元测试全覆盖新增逻辑，`npm run check` 与 `npm test` 100% 通过。
