# 文件系统扩展 API 实施计划 (Implementation Plan)

## 实施阶段与步骤

### 阶段 1：类型契约与白名单声明

- [x] 1.1 在 `src/shared/ipc.ts` 声明 `FsStat`, `FsEntry`, `FsCopyOptions`, `FsMoveOptions`, `FsOpenDialogOptions`, `FsSaveDialogOptions`, `FsPathInfo`, `AppPaths` 接口。
- [x] 1.2 在 `DesktopInvoke` 中添加全量 `fs:*` 通道映射（100% Promise 异步契约）。
- [x] 1.3 在 `src/shared/validation.ts` 的 `allowedChannels` 白名单中注册新增的全部 `fs:*` 通道。

### 阶段 2：渲染层 `useIpcBridge` Hook 导出

- [x] 2.1 在 `src/renderer/bridge/index.ts` 中导出 `useIpcBridge` 组合式函数（保留 `useBridge` 别名兼容）。

### 阶段 3：主进程文件核心模块实现 (`src/main/modules/fs/fs-module.ts`)

- [x] 3.1 纯异步原生依赖 `node:fs/promises`、`node:path`、`node:crypto` 实现（全部使用 `async/await`，绝无回调方式）：
  - 智能保底与存在性：`exists`, `pathExists`, `ensureDir`, `mkdirs`, `ensureFile`, `ensureLink`, `ensureSymlink`, `isEmpty`；
  - 便捷读写与结构化：`readJson`, `writeJson`, `outputJson`, `readText`, `writeText`, `outputFile`, `readBinary`, `writeBinary`, `readFile`, `writeFile`, `appendFile`（含 50MB 保护及自动补全父目录）；
  - 高级文件管理：`copy`（递归）, `move`（支持 EXDEV 跨分区降级）, `remove`（幂等安全删除）, `emptyDir`, `trash`, `mkdir`；
  - 目录与元数据校验：`readDir`, `readdir`, `stat`, `lstat`, `checksum`（流式哈希验签）；
  - 路径与原生对话框：`appPaths`, `pathInfo`, `showOpenDialog`, `showSaveDialog`。

### 阶段 4：主进程 IPC Handler 注册

- [x] 4.1 创建 `src/main/ipc/handlers/fs.ts`，映射所有 `fs:*` 通道至 `fs-module.ts`（包含别名映射）。
- [x] 4.2 在 `src/main/ipc/handlers/index.ts` 中整合 `fsHandlers` 并确保满足 `allHandlers`。

### 阶段 5：Web 端降级垫片支持

- [x] 5.1 在 `src/renderer/bridge/web-shim.ts` 中针对所有 `fs:*` 方法实现基于内存虚拟树的平滑降级（返回 Promise）。

### 阶段 6：单元测试验证与质量门禁

- [x] 6.1 创建 `tests/modules/fs-module.test.ts`，覆盖异步 Promise 读写、智能保底、目录清空与文件操作。
- [x] 6.2 运行 `vp test`（全部通过，0 failure）。
- [x] 6.3 运行 `vp check`（TypeScript 与代码规范零报错）。

### 阶段 7：技术文档编制

- [x] 7.1 编写 `docs/file-system-api.md`，给出完整的通道说明、入参、返回值与 `useIpcBridge` 调用示例。
- [x] 7.2 更新 `docs/README.md`，添加文件系统 API 文档索引。

---

## 验证指令 (Validation Commands)

```bash
# 类型检查
vp check # 或 npm run check

# 单元测试
vp test # 或 npm run test
```

---

## 风险文件与回滚点

- **`src/shared/ipc.ts`**：关键契约，需保证不破坏已有通道。
- **`src/renderer/bridge/index.ts`**：Bridge 导出点。
- **`src/shared/validation.ts`**：白名单集成点。
- **`src/main/ipc/handlers/index.ts`**：处理器聚合点。
