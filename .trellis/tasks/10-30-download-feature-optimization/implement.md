# Implementation Plan: Download Feature Optimization and Architecture Encapsulation

## 1. 实施检查清单 (Ordered Checklist)

### 阶段一：共享契约与主进程领域核心 (IPC & Main Process Core)

- [x] **1.1 扩展 IPC 契约** (`src/shared/ipc.ts`):
  - 扩展 `DownloadState`：添加 `receivedBytes`, `totalBytes`, `speed`, `eta`, `filename`, `canResume`, `createdAt`, `completedAt`, `fileExists` 等。
  - 新增 `interrupted` 状态。
  - 声明历史记录与文件操作 IPC 契约（`download:history:get`, `download:history:remove`, `download:history:clear`）。
- [x] **1.2 速度与 ETA 计算模块** (`src/main/modules/download/speed-tracker.ts`):
  - 实现基于 EMA（$\alpha = 0.3$）的平滑下载速率与剩余时间计算器。
- [x] **1.3 文件安全策略与原子落盘** (`src/main/modules/download/file-policy.ts`):
  - 临时文件路径生成（`.download`）、智能递增重命名（`filename (1).ext`）、原子落盘与异常异步清理。
- [x] **1.4 状态机与节流增强** (`src/main/modules/download/manager.ts`):
  - 接入 `speed-tracker`，增强 `interrupted` 状态机与手动 `resume` 交互。
  - 实现 250ms IPC 节流调度（关键状态立推，进度字节合并）。
- [x] **1.5 原生 SQLite 数据库持久化** (`src/main/modules/download/database.ts`):
  - 基于 Node 24 原生 `node:sqlite` 创建 `downloads.db`，实现 CRUD、历史分页与存活性异步检测。

### 阶段二：Electron 适配层与系统通知 (Adapter & System Integration)

- [x] **2.1 主进程适配层接入** (`src/main/modules/download/index.ts`):
  - 串联 Database、FilePolicy、SpeedTracker 与 Manager。
  - 系统通知集成：完成通知点击高亮文件（`shell.showItemInFolder`）。
  - 应用退出时清理临时文件与关闭数据库连接。
- [x] **2.2 IPC 处理器与 Web 桥接** (`src/main/ipc/handlers/transfer.ts` & `src/renderer/bridge/web-shim.ts`):
  - 注册 `download:history:*` 等新增 IPC 处理函数，并在 Web 模式下提供等价 Mock。

### 阶段三：前端状态层与全局抽屉交互 (Frontend Store & UI)

- [x] **3.1 封装下载 Pinia Store** (`src/renderer/stores/download.ts`):
  - 集中管理响应式下载队列、历史任务、总带宽速率计算与操作指令。
- [x] **3.2 创建全局下载抽屉组件** (`src/renderer/components/GlobalDownloadDrawer.vue`):
  - 实现活动任务卡片（进度、速度、ETA、暂停/恢复/取消）、中断提示、历史记录与失效文件标注。
- [x] **3.3 标题栏下载徽标入口** (`src/renderer/components/TitleBar.vue`):
  - 常驻下载图标，展示活跃下载数 Badge 与抽屉切换交互。
- [x] **3.4 重构 Playground 页面** (`src/renderer/views/Playground.vue`):
  - 接入 `useDownloadStore`，保留专业压测入口。

### 阶段四：自动化测试与门禁验证 (Testing & Verification)

- [x] **4.1 核心单测编写与更新**:
  - `tests/download-manager.test.ts`：更新测试覆盖节流、速度/ETA 与 interrupted 状态。
  - `tests/download-file-policy.test.ts`：测试防重名递增、临时文件生成与原子重命名。
  - `tests/download-database.test.ts`：测试原生 SQLite CRUD、统计与异步存在性检测。
  - `tests/download-speed-tracker.test.ts`：测试 EMA 速率与剩余秒数算法。
  - `tests/download-store.test.ts`：测试前端 Store 状态响应与格式化逻辑。
- [x] **4.2 全量验证命令**:
  - `npx vitest run tests/download-*.test.ts` -> 7 文件 36 单测 100% 通过。
  - `npm run check` -> 格式化与类型检查 0 errors。
  - `npm test` -> 46 个测试文件 182 个测试 100% 通过。
  - `npm run build` -> 生产包打包构建顺利通过。

---

## 2. 验证命令 (Validation Commands)

```bash
# 1. 运行下载模块全部单元测试
npx vitest run tests/download-*.test.ts

# 2. 全量单元测试
npm test

# 3. 类型与代码质量检查
npm run check
```

---

## 3. 高风险文件与回滚考量 (Risky Files & Rollback)

| 目标文件                                   | 关键风险                     | 应对策略                                                                                                      |
| :----------------------------------------- | :--------------------------- | :------------------------------------------------------------------------------------------------------------ |
| `src/main/modules/download/database.ts`    | 数据库路径与 SQL 语法兼容    | 路径绑定到 `app.getPath("userData")`，使用预编译语句（prepared statements），初始化失败时平滑降级为纯内存运行 |
| `src/main/modules/download/manager.ts`     | 节流定时器管理与重入风险     | 保持纯逻辑可测性，终态与 dispose 统一清理 timer，杜绝内存泄漏                                                 |
| `src/main/modules/download/file-policy.ts` | 跨分区移动与原子重命名失败   | 临时文件与最终文件强制创建在同一目录，重命名失败安全捕获并清理                                                |
| `src/renderer/components/TitleBar.vue`     | 样式变动与窗口拖拽区域受影响 | 严格保留 `-webkit-app-region: no-drag`，避免拖拽手势失效                                                      |
