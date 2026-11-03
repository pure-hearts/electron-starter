# 文件系统 API 设计与使用指南 (File System API Guide)

## 1. 架构概览与设计哲学

在现代 Electron 桌面客户端开发中，由于 Chromium 渲染进程运行在沙箱隔离环境，直接向页面暴露 Node.js 原生 `fs` 存在严重的代码注入（RCE）与越权访问风险。本项目遵循四层隔离架构（`src/main`、`src/preload`、`src/renderer`、`src/shared`），设计了一套兼顾**高安全性**、**极致易用性**与**行业标准兼容性**的文件系统 API：

1. **统一 `invoke` 调度**：渲染层与主进程之间通过强类型管道 `window.$ipcBridge.invoke("fs:<method>", ...args)` 通信，严格拒绝宽泛的系统句柄外泄。
2. **Vue Composition API 赋能**：在渲染层导出 `useIpcBridge()` Hook，支持直接解构获取强类型 `invoke` 与 `on` 函数。
3. **100% 异步 Promise 契约**：全链路采用 `async/await` 与 `Promise`，彻底摒弃 Node 传统的错误优先回调（Callback）风格。
4. **对齐经典 `fs-extra` 实用封装**：
   - **智能保底**：如 `ensureDir`（不存在则递归建目录并返回 true）、`ensureFile`（自动补全父目录并创建空文件）；
   - **自动父目录创建**：`writeJson` / `outputJson`、`writeText` / `outputFile` 在写入前自动递归补齐父级目录；
   - **安全容错与默认值**：`readJson` 与 `readText` 原生支持 `fallback` 兜底，读缺失或异常时安全降级，避免前端白屏；
   - **幂等删除**：`remove`（类似 `rm -rf`），针对原本不存在的目标静默返回 `true`。
5. **桌面级扩展集成**：内置系统废纸篓交互（`trash`）、主进程大文件流式秒级验签（`checksum`）、系统常用基准目录字典（`appPaths`）、路径结构分析（`pathInfo`）以及原生打开/保存弹框（`dialog`）。

---

## 2. API 分类与接口速查

所有方法均通过 `useIpcBridge().invoke("fs:<method>", ...args)` 触发。

### 2.1 存在性与智能保底 (Ensure & Existence)

| 通道名称                      | 入参签名                             | 返回值             | 功能说明                                                         |
| :---------------------------- | :----------------------------------- | :----------------- | :--------------------------------------------------------------- |
| `fs:ensureDir` / `fs:mkdirs`  | `(path: string)`                     | `Promise<boolean>` | 确认目录是否存在，存在返回 `true`；不存在则递归创建后返回 `true` |
| `fs:ensureFile`               | `(path: string)`                     | `Promise<boolean>` | 确认文件是否存在，存在返回 `true`；不存在自动创建父目录及空文件  |
| `fs:ensureLink`               | `(src: string, dest: string)`        | `Promise<boolean>` | 确认硬链接存在，自动补全目标父级目录                             |
| `fs:ensureSymlink`            | `(src: string, dest: string, type?)` | `Promise<boolean>` | 确认符号链接存在，自动补全目标父级目录                           |
| `fs:exists` / `fs:pathExists` | `(path: string)`                     | `Promise<boolean>` | 检查目标路径（文件或目录）是否存在                               |
| `fs:isEmpty`                  | `(path: string)`                     | `Promise<boolean>` | 检查目录是否为空目录，或文件大小是否为 0 字节                    |

### 2.2 结构化读写与便捷 I/O (Convenient Read/Write)

| 通道名称                         | 入参签名                                    | 返回值             | 功能说明                                                  |
| :------------------------------- | :------------------------------------------ | :----------------- | :-------------------------------------------------------- |
| `fs:readJson`                    | `(path: string, fallback?: unknown)`        | `Promise<unknown>` | 读取并解析 JSON，失败或缺失时可安全返回 `fallback`        |
| `fs:writeJson` / `fs:outputJson` | `(path: string, data: unknown, options?)`   | `Promise<boolean>` | 写入 JSON 数据，**自动递归创建缺失的父级目录**            |
| `fs:readText`                    | `(path: string, options?)`                  | `Promise<string>`  | 读取 UTF-8 文本内容，支持传入 `fallback` 兜底             |
| `fs:writeText` / `fs:outputFile` | `(path: string, content: string, options?)` | `Promise<boolean>` | 写入文本，**自动补全父级目录**，支持覆盖或 `append: true` |
| `fs:readBinary`                  | `(path: string)`                            | `Promise<string>`  | 快速读取二进制文件并转为 Base64 字符串（带 50MB 保护）    |
| `fs:writeBinary`                 | `(path: string, base64Data: string)`        | `Promise<boolean>` | 将 Base64 数据写入二进制文件，自动补全父级目录            |
| `fs:readFile`                    | `(path: string, options?)`                  | `Promise<string>`  | 标准文件读取（支持 `utf-8` 或 `base64`）                  |
| `fs:writeFile`                   | `(path: string, data: string, options?)`    | `Promise<boolean>` | 标准文件写入（支持 `utf-8` 或 `base64`）                  |
| `fs:appendFile`                  | `(path: string, data: string, options?)`    | `Promise<boolean>` | 追加文件内容                                              |

### 2.3 文件与目录高级管理 (Copy, Move, Remove, Clean)

| 通道名称      | 入参签名                                | 返回值             | 功能说明                                                         |
| :------------ | :-------------------------------------- | :----------------- | :--------------------------------------------------------------- |
| `fs:copy`     | `(src: string, dest: string, options?)` | `Promise<boolean>` | 递归复制文件或整个目录树，支持 `overwrite` 控制                  |
| `fs:move`     | `(src: string, dest: string, options?)` | `Promise<boolean>` | 移动/重命名，底层自动兼容跨分区 `EXDEV` 并补全父级目录           |
| `fs:remove`   | `(path: string)`                        | `Promise<boolean>` | 幂等安全删除文件或目录（类似 `rm -rf`，路径不存在亦返回 `true`） |
| `fs:emptyDir` | `(path: string)`                        | `Promise<boolean>` | 清空目录内所有文件与子目录，保留目录自身                         |
| `fs:trash`    | `(path: string)`                        | `Promise<boolean>` | 安全将文件或目录移入操作系统废纸篓/回收站（防误删）              |
| `fs:mkdir`    | `(path: string, options?)`              | `Promise<boolean>` | 标准目录创建（默认 `recursive: true`）                           |

### 2.4 目录检索与元数据完整性 (Inspection & Integrity)

| 通道名称                    | 入参签名                                   | 返回值                    | 功能说明                                                                 |
| :-------------------------- | :----------------------------------------- | :------------------------ | :----------------------------------------------------------------------- |
| `fs:readDir` / `fs:readdir` | `(path: string, options?)`                 | `Promise<FsEntry[]>`      | 列出目录下所有条目（名称、路径、类型、大小、修改时间），支持 `recursive` |
| `fs:stat` / `fs:lstat`      | `(path: string)`                           | `Promise<FsStat \| null>` | 获取文件/目录详细元数据（大小、时间戳、权限等）                          |
| `fs:checksum`               | `(path: string, algo?: "md5" \| "sha256")` | `Promise<string>`         | **主进程流式秒级计算哈希散列**，大文件零内存挤占                         |

### 2.5 桌面级路径与原生对话框 (Paths & Dialogs)

| 通道名称                               | 入参签名         | 返回值                      | 功能说明                                                               |
| :------------------------------------- | :--------------- | :-------------------------- | :--------------------------------------------------------------------- |
| `fs:appPaths`                          | `()`             | `Promise<AppPaths>`         | 获取系统常用路径（`userData`, `documents`, `downloads`, `desktop` 等） |
| `fs:pathInfo`                          | `(path: string)` | `Promise<FsPathInfo>`       | 解析路径结构（`dirname`, `basename`, `extname`, `name`, `isAbsolute`） |
| `fs:dialog:open` / `fs:showOpenDialog` | `(options?)`     | `Promise<string[] \| null>` | 唤起原生打开文件/目录对话框                                            |
| `fs:dialog:save` / `fs:showSaveDialog` | `(options?)`     | `Promise<string \| null>`   | 唤起原生保存文件对话框                                                 |

---

## 3. 在 Vue 3 组件中使用实战

```vue
<script setup lang="ts">
import { ref } from "vue";
import { useIpcBridge } from "@/bridge";

// 1. 获取统一强类型 IPC Bridge 实例
const { invoke } = useIpcBridge();

const status = ref("");

async function initWorkspace() {
  // 获取系统文档与应用配置根目录
  const paths = await invoke("fs:appPaths");
  const workspace = `${paths.documents}/MyAppWorkspace`;

  // 确保工作区目录存在
  await invoke("fs:ensureDir", workspace);

  // 读取配置文件，若不存在则回退至默认配置，绝不抛出破坏性异常
  const config = await invoke("fs:readJson", `${workspace}/config.json`, {
    theme: "dark",
    autoSave: true,
  });

  // 修改并美化写入（无需手工先创建子目录）
  await invoke("fs:outputJson", `${workspace}/subfolder/settings.json`, config, { spaces: 2 });

  // 快速判断
  const hasSettings = await invoke("fs:pathExists", `${workspace}/subfolder/settings.json`);

  // 计算大文件 SHA256 哈希
  const hash = await invoke("fs:checksum", `${workspace}/subfolder/settings.json`, "sha256");

  status.value = `工作区就绪: ${workspace}, Hash: ${hash}, 存在: ${hasSettings}`;
}

async function handleOpenFile() {
  const result = await invoke("fs:showOpenDialog", {
    title: "选择导入文件",
    filters: [{ name: "文本文件", extensions: ["txt", "md", "json"] }],
    properties: ["openFile", "multiSelections"],
  });

  if (result && result.length > 0) {
    const content = await invoke("fs:readText", result[0], { fallback: "" });
    console.log("读取文件内容:", content);
  }
}
</script>
```
