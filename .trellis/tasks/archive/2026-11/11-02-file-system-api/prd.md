# 文件系统 API 规划与实现 (File System API Planning and Implementation)

## Goal (目标)

为应用设计并实现一套类型安全、符合 Electron 最佳实践、全功能高兼容度的文件系统 IPC API 超集。
同时满足以下核心开发要求：

1. **100% 采用 Promise 异步风格**：全链路采用 `async/await` 与 `Promise`，杜绝任何传统 Node 回调（callback）方式；
2. **在渲染层提供 `useIpcBridge` Hook**：在 Vue 组合式 API 中提供开箱即用的 `useIpcBridge`，方便组件便捷获取类型安全的 `invoke` 与 `on`；
3. **保持纯粹 IPC 架构**：通过 `invoke("fs:<method>", ...args)` 触发调用，不引入多余中间层；
4. **纯 Web 垫片兼容**：提供 Web 环境下的虚拟文件系统降级。

---

## Confirmed Facts & Architecture Alignment (已确认事实与架构契约)

1. **异步 Promise 规范**：
   - 主进程 `src/main/modules/fs/fs-module.ts` 纯原生使用 `node:fs/promises` 实现，所有业务函数均为 `async` 返回 `Promise`；
   - 流式计算（如 `checksum`）通过 `Promise` 包装完成；
   - Preload 的 `bridge.invoke` 返回强类型 `Promise<InvokeResult<C>>`。
2. **渲染层 `useIpcBridge` Hook**：
   - 在 `src/renderer/bridge/index.ts` 中导出 `useIpcBridge()`（同时保留 `useBridge()` 别名向后兼容）；
   - 在 Vue 页面中支持解构：`const { invoke } = useIpcBridge(); await invoke("fs:ensureDir", path);`。
3. **安全与性能保护**：
   - 开放本地合法路径，使用 `safeLocalPath` 校验路径及防御空字节（`\0`）截断；
   - 读写单次载荷实施 **50MB** 安全阈值防 IPC 卡顿；
   - 接入 `withTimeoutAndMetrics` 超时熔断保护，异常脱敏返回。

---

## Detailed Requirements (IPC 通道功能清单)

全部通过 `useIpcBridge().invoke("fs:<method>", ...args)` 触发，100% 返回 Promise：

### 1. 存在性与智能保底 (Ensure & Existence)

- **`fs:ensureDir` / `fs:mkdirs`**: `(path: string) => Promise<boolean>`  
  确认目录是否存在，存在返回 `true`；不存在则递归创建并返回 `true`。
- **`fs:ensureFile`**: `(path: string) => Promise<boolean>`  
  确认文件是否存在，存在返回 `true`；不存在则自动创建父目录及空文件并返回 `true`。
- **`fs:ensureLink`**: `(src: string, dest: string) => Promise<boolean>`  
  确保硬链接存在，自动补齐目标父目录。
- **`fs:ensureSymlink`**: `(src: string, dest: string, type?: "dir" | "file" | "junction") => Promise<boolean>`  
  确保符号链接存在，自动补齐目标父目录。
- **`fs:exists` / `fs:pathExists`**: `(path: string) => Promise<boolean>`  
  快速判断文件或目录是否存在，返回布尔值。
- **`fs:isEmpty`**: `(path: string) => Promise<boolean>`  
  检查目录是否为空目录，或文件大小是否为 0 字节。

### 2. 便捷读写与自动补全 (Convenient Read/Write)

- **`fs:readJson`**: `(path: string, fallback?: unknown) => Promise<unknown>`  
  读取并自动反序列化 JSON，支持异常或不存在时返回 `fallback` 兜底默认值。
- **`fs:writeJson` / `fs:outputJson`**: `(path: string, data: unknown, options?: { spaces?: number }) => Promise<boolean>`  
  美化写入 JSON，**自动检测并创建不存在的父级目录**。
- **`fs:readText`**: `(path: string, options?: { encoding?: "utf-8" | "ascii"; fallback?: string }) => Promise<string>`  
  读取 UTF-8 文本内容，支持配置 `fallback` 兜底。
- **`fs:writeText` / `fs:outputFile`**: `(path: string, content: string, options?: { encoding?: "utf-8" | "base64"; append?: boolean }) => Promise<boolean>`  
  写入文本或文件内容（支持覆盖或追加模式），**自动补齐不存在的父级目录**。
- **`fs:readBinary`**: `(path: string) => Promise<string>`  
  快速读取二进制文件并转为 Base64 字符串（受 50MB 保护）。
- **`fs:writeBinary`**: `(path: string, base64Data: string) => Promise<boolean>`  
  将 Base64 数据快速写入二进制文件，**自动创建父级目录**。
- **`fs:readFile`**: `(path: string, options?: { encoding?: "utf-8" | "base64" }) => Promise<string>`  
  标准文件读取。
- **`fs:writeFile`**: `(path: string, data: string, options?: { encoding?: "utf-8" | "base64" }) => Promise<boolean>`  
  标准文件写入。
- **`fs:appendFile`**: `(path: string, data: string, options?: { encoding?: "utf-8" }) => Promise<boolean>`  
  追加文件内容。

### 3. 高级文件管理 (Copy, Move, Remove, Clean)

- **`fs:copy`**: `(src: string, dest: string, options?: FsCopyOptions) => Promise<boolean>`  
  递归复制文件或整个目录树。
- **`fs:move`**: `(src: string, dest: string, options?: FsMoveOptions) => Promise<boolean>`  
  移动/重命名文件或目录（底层自动兼容跨分区 `EXDEV` 并自动补全目标父目录）。
- **`fs:remove`**: `(path: string) => Promise<boolean>`  
  幂等安全删除（类似 `rm -rf`，即使路径原本不存在也静默返回 `true`，绝不抛错）。
- **`fs:emptyDir`**: `(path: string) => Promise<boolean>`  
  清空目录内所有子条目，保留目录本身。
- **`fs:trash`**: `(path: string) => Promise<boolean>`  
  安全将文件/目录移至系统废纸篓/回收站（防误删）。
- **`fs:mkdir`**: `(path: string, options?: { recursive?: boolean }) => Promise<boolean>`  
  标准目录创建。

### 4. 目录检索与元数据完整性 (Inspection & Integrity)

- **`fs:readDir` / `fs:readdir`**: `(path: string, options?: { recursive?: boolean; maxDepth?: number }) => Promise<FsEntry[]>`  
  列出目录下所有条目的详细属性（名称、完整路径、文件/目录类型、大小、修改时间）。
- **`fs:stat` / `fs:lstat`**: `(path: string) => Promise<FsStat | null>`  
  获取文件/目录的详细元数据（大小、时间戳、权限等）。
- **`fs:checksum`**: `(path: string, algorithm?: "md5" | "sha256") => Promise<string>`  
  主进程流式秒级计算哈希散列，大文件零内存挤占。

### 5. 系统路径与原生对话框 (Paths & Dialogs)

- **`fs:appPaths`**: `() => Promise<AppPaths>`  
  获取常用的系统标准路径字典（`documents`, `downloads`, `desktop`, `userData`, `temp`, `home`, `appData`）。
- **`fs:pathInfo`**: `(path: string) => Promise<FsPathInfo>`  
  解析路径结构（`dirname`, `basename`, `extname`, `name`, `isAbsolute`）。
- **`fs:dialog:open` / `fs:showOpenDialog`**: `(options?: FsOpenDialogOptions) => Promise<string[] | null>`  
  统一的原生打开文件/目录弹框。
- **`fs:dialog:save` / `fs:showSaveDialog`**: `(options?: FsSaveDialogOptions) => Promise<string | null>`  
  统一的原生保存文件弹框。

### 6. 纯 Web 环境垫片 (WebShim)

- 在 `src/renderer/bridge/web-shim.ts` 中构建内存虚拟文件树仿真，保证所有上述通道在纯 Web 调试时不报错、可交互。

---

## Acceptance Criteria (验收标准)

- [ ] `src/renderer/bridge/index.ts` 导出 `useIpcBridge` Hook，支持在 Vue 组件中解构 `invoke` 与 `on`；
- [ ] 保证全部文件系统相关操作 100% 采用 Promise 异步风格，绝无回调传参；
- [ ] `src/shared/ipc.ts` 补齐上述所有 `fs:*` 通道签名与数据类型；
- [ ] `src/shared/validation.ts` 将所有 `fs:*` 通道加入 `allowedChannels` 白名单；
- [ ] `src/main/modules/fs/fs-module.ts` 纯原生使用 `node:fs/promises` 异步实现全部逻辑；
- [ ] `src/main/ipc/handlers/fs.ts` 实现全部映射与别名转发，汇入 `allHandlers`；
- [ ] `src/renderer/bridge/web-shim.ts` 覆盖全部上述通道的虚拟内存降级；
- [ ] 编写全面的 Vitest 单元测试；
- [ ] `vp test` 与 `vp check` 零报错通过；
- [ ] 编写详细中文技术文档 `docs/file-system-api.md` 并更新 `docs/README.md`。
