# 主进程函数式重构与工程可靠性计划 (PRD)

## 1. 目标概述

根据“保持精简、函数式模块化、零过度设计、代码直观易懂”的原则，对 `src/main` 进行函数式解耦与工程可靠性增强：

1. **纯函数与组合化设计 (Functional Style)**：
   - 拒绝引入复杂的 Hooks/类继承体系，采用纯函数、高阶函数（Higher-Order Functions）与单文件模块模式；
   - 核心决策逻辑（版本比较、目录过滤、策略校验、超时控制）抽离为无副作用的纯函数，100% 易测且简单易读。
2. **IPC 超时熔断与性能告警 (Timeout & Slow Profiling)**：
   - 通过高阶纯函数 `withTimeout(handler, timeoutMs)` 统一注入超时控制（默认 10s，长任务 60s），超时抛出 `IPC_TIMEOUT`；
   - 记录 IPC 耗时，对超过 200ms 的调用输出慢调用日志。
3. **增量热更历史版本垃圾回收 (GC)**：
   - 实现纯函数 `findStaleRevisions(directories, keepList)`；
   - 启动并标记健康后安全清理多余的历史版本目录，仅保留活跃与上一稳定版本。
4. **下载临时文件 `.part` 隔离与原子落盘**：
   - 写入时使用 `.part` 临时后缀，完成后原子 `fs.rename`，避免脏数据。
5. **详尽的中文化规范注释**：
   - 关键模块与导出函数全部补充清晰结构化的中文 JSDoc，做到代码一目了然。

---

## 2. 详细改造范围

### 2.1 IPC 调度与超时高阶函数 (`src/main/ipc/`)

- 在 `src/main/ipc/timeout.ts` 抽象出无副作用的高阶函数：
  - `withTimeout<T>(fn: () => Promise<T>, timeoutMs: number, channelName: string): Promise<T>`；
  - 自动测量执行耗时，>200ms 输出告警，超时抛出受控的 `IPC_TIMEOUT` 错误；
- 在 `src/main/ipc/index.ts` 中直接组合该高阶函数。

### 2.2 增量热更垃圾回收纯函数 (`src/main/modules/update/hot/`)

- 在 `src/main/modules/update/hot/index.ts` 新增：
  - `filterStaleRevisions(existingDirs: string[], activeDir?: string | null, prevDir?: string | null): string[]` (纯算法)；
  - `cleanupStaleRevisions()` (I/O 副作用执行)，在 `markRendererHealthy` 时触发。

### 2.3 下载临时隔离与原子重命名 (`src/main/modules/download/manager.ts`)

- 落地 `.part` 写入并在完成时原子重命名。

### 2.4 主进程核心模块 JSDoc 注释补全与代码精简

- 对 `src/main` 下的启动生命周期、IPC 调度、窗口管理增加清晰易懂的中文注释。

---

## 3. 验收标准

1. `pnpm check` 零警告零错误；
2. `pnpm typecheck:vue` 通过；
3. `pnpm test` 全部 35 个测试套件通过；
4. `pnpm build` 与 `pnpm smoke` 通过；
5. 代码轻量、简洁、没有任何臃肿抽象。
