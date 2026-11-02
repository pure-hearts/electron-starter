# 文件系统扩展 API 技术设计 (File System API Technical Design)

## 1. 架构定位与模块边界

遵循本项目四层单包架构，全链路异步 `Promise` 通信，并在渲染层提供 `useIpcBridge` Hook：

```
[src/renderer] (Vue 3 页面与组合式函数)
       │ import { useIpcBridge } from "@/bridge";
       │ const { invoke } = useIpcBridge();
       │ await invoke("fs:readText", filePath, { fallback: "" });
       ▼
[src/preload/index.ts] (Preload 隔离层: 检查 allowedChannels 白名单)
       │ ipcRenderer.invoke -> 返回 Promise
       ▼
[src/main/ipc] (主进程 IPC 网关: assertSender 来源审查 -> withTimeoutAndMetrics 熔断)
       │
       ▼
[src/main/ipc/handlers/fs.ts] (IPC 处理路由分发与通道别名映射)
       │
       ▼
[src/main/modules/fs/fs-module.ts] (纯 async/Promise 异步原生模块: node:fs/promises + crypto + electron.dialog)
```

---

## 2. 渲染层 Hook 设计 (`src/renderer/bridge/index.ts`)

```typescript
/**
 * Composition API: 获取统一强类型 IPC Bridge 实例
 * 提供解构支持：const { invoke, on } = useIpcBridge();
 */
export function useIpcBridge(): DesktopBridge {
  return getBridge();
}

/** 兼容旧命名别名 */
export const useBridge = useIpcBridge;
```

在组件中使用示例：

```typescript
import { defineComponent } from "vue";
import { useIpcBridge } from "@/bridge";

export default defineComponent({
  setup() {
    const { invoke } = useIpcBridge();

    async function handleSaveConfig() {
      // 100% 纯 Promise 风格异步调用
      const ok = await invoke("fs:outputJson", "/path/to/config.json", { theme: "dark" });
      const paths = await invoke("fs:appPaths");
    }

    return { handleSaveConfig };
  },
});
```

---

## 3. 接口契约定义 (`src/shared/ipc.ts`)

```typescript
export interface FsStat {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  mtime: number;
  birthtime: number;
  mode: number;
}

export interface FsEntry {
  name: string;
  path: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  size?: number;
  mtime?: number;
}

export interface FsCopyOptions {
  overwrite?: boolean;
  errorOnExist?: boolean;
}

export interface FsMoveOptions {
  overwrite?: boolean;
}

export interface FsOpenDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: { name: string; extensions: string[] }[];
  properties?: Array<
    | "openFile"
    | "openDirectory"
    | "multiSelections"
    | "showHiddenFiles"
    | "createDirectory"
    | "promptToCreate"
  >;
}

export interface FsSaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: { name: string; extensions: string[] }[];
}

export interface FsPathInfo {
  root: string;
  dir: string;
  base: string;
  ext: string;
  name: string;
  isAbsolute: boolean;
}

export interface AppPaths {
  home: string;
  appData: string;
  userData: string;
  temp: string;
  desktop: string;
  documents: string;
  downloads: string;
  pictures?: string;
  music?: string;
  videos?: string;
}

export interface DesktopInvoke {
  // === 1. 存在性与智能保底 (Ensure & Existence) ===
  "fs:ensureDir": { args: [path: string]; result: boolean };
  "fs:mkdirs": { args: [path: string]; result: boolean };
  "fs:ensureFile": { args: [path: string]; result: boolean };
  "fs:ensureLink": { args: [src: string, dest: string]; result: boolean };
  "fs:ensureSymlink": {
    args: [src: string, dest: string, type?: "dir" | "file" | "junction"];
    result: boolean;
  };
  "fs:exists": { args: [path: string]; result: boolean };
  "fs:pathExists": { args: [path: string]; result: boolean };
  "fs:isEmpty": { args: [path: string]; result: boolean };

  // === 2. 便捷读写与自动补全 (Convenient Read/Write) ===
  "fs:readJson": { args: [path: string, fallback?: unknown]; result: unknown };
  "fs:writeJson": {
    args: [path: string, data: unknown, options?: { spaces?: number }];
    result: boolean;
  };
  "fs:outputJson": {
    args: [path: string, data: unknown, options?: { spaces?: number }];
    result: boolean;
  };
  "fs:readText": {
    args: [path: string, options?: { encoding?: "utf-8" | "ascii"; fallback?: string }];
    result: string;
  };
  "fs:writeText": {
    args: [
      path: string,
      content: string,
      options?: { encoding?: "utf-8" | "base64"; append?: boolean },
    ];
    result: boolean;
  };
  "fs:outputFile": {
    args: [path: string, data: string, options?: { encoding?: "utf-8" | "base64" }];
    result: boolean;
  };
  "fs:readBinary": { args: [path: string]; result: string }; // Base64
  "fs:writeBinary": { args: [path: string, base64Data: string]; result: boolean };
  "fs:readFile": {
    args: [path: string, options?: { encoding?: "utf-8" | "base64" }];
    result: string;
  };
  "fs:writeFile": {
    args: [path: string, data: string, options?: { encoding?: "utf-8" | "base64" }];
    result: boolean;
  };
  "fs:appendFile": {
    args: [path: string, data: string, options?: { encoding?: "utf-8" }];
    result: boolean;
  };

  // === 3. 高级文件管理 (Copy, Move, Remove, Clean) ===
  "fs:copy": { args: [src: string, dest: string, options?: FsCopyOptions]; result: boolean };
  "fs:move": { args: [src: string, dest: string, options?: FsMoveOptions]; result: boolean };
  "fs:remove": { args: [path: string]; result: boolean };
  "fs:emptyDir": { args: [path: string]; result: boolean };
  "fs:trash": { args: [path: string]; result: boolean };
  "fs:mkdir": { args: [path: string, options?: { recursive?: boolean }]; result: boolean };

  // === 4. 目录检索与元数据完整性 (Inspection & Integrity) ===
  "fs:readDir": {
    args: [path: string, options?: { recursive?: boolean; maxDepth?: number }];
    result: FsEntry[];
  };
  "fs:readdir": { args: [path: string, options?: { recursive?: boolean }]; result: FsEntry[] };
  "fs:stat": { args: [path: string]; result: FsStat | null };
  "fs:lstat": { args: [path: string]; result: FsStat | null };
  "fs:checksum": { args: [path: string, algorithm?: "md5" | "sha256"]; result: string };

  // === 5. 系统路径与原生对话框 (Paths & Dialogs) ===
  "fs:appPaths": { args: []; result: AppPaths };
  "fs:pathInfo": { args: [path: string]; result: FsPathInfo };
  "fs:dialog:open": { args: [options?: FsOpenDialogOptions]; result: string[] | null };
  "fs:dialog:save": { args: [options?: FsSaveDialogOptions]; result: string | null };
  "fs:showOpenDialog": { args: [options?: FsOpenDialogOptions]; result: string[] | null };
  "fs:showSaveDialog": { args: [options?: FsSaveDialogOptions]; result: string | null };
}
```

---

## 4. 主进程原生异步实现 (`src/main/modules/fs/fs-module.ts`)

全量基于 `node:fs/promises` 异步编写，绝无任何阻塞同步方法与回调式写法：

```typescript
// 示例实现模式：
export async function ensureDir(targetPath: string): Promise<boolean> {
  const verified = safeLocalPath(targetPath);
  await fs.mkdir(verified, { recursive: true });
  return true;
}

export async function readJson(targetPath: string, fallback?: unknown): Promise<unknown> {
  const verified = safeLocalPath(targetPath);
  try {
    const raw = await fs.readFile(verified, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    if (fallback !== undefined) return fallback;
    throw error;
  }
}
```

---

## 5. WebShim 降级实现 (`src/renderer/bridge/web-shim.ts`)

在纯 Web 浏览器环境中，通过 `async` 函数与 `Promise.resolve` 仿真全量 API，提供无差异的异步调用体验。
