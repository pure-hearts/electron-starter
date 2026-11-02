/**
 * 主进程和 Preload 共用的通信协议。
 * DesktopInvoke 约定每个请求的参数与返回值；DesktopEvents 约定主动推送的消息。
 * TypeScript 类型只负责开发期检查，主进程仍需做运行时校验。
 */
import type {
  NotificationOptions,
  NotificationReceipt,
  NotificationActivation,
  NotificationSettled,
} from "./notification";

/** Shared IPC channel names, payloads, and subscription events. */
// 以通道名称作为键，args 是可传入参数元组，result 是 Promise 解析后的结果类型。
export interface DesktopInvoke {
  "app:version": { args: []; result: string };
  "app:quit": { args: []; result: void };
  "app:restart": { args: []; result: void };
  // 字符串字面量联合类型限制可执行的窗口动作，防止拼错任意传入字符串。
  "window:action": {
    args: [action: "minimize" | "maximize" | "restore" | "hide" | "show" | "close"];
    result: void;
  };
  "window:open": { args: [route: string]; result: number };
  // SettingKey 统一限定可以读写的设置键；具体值还需运行时检查。
  "store:get": { args: [key: SettingKey]; result: string | boolean | null };
  "store:set": { args: [key: SettingKey, value: string | boolean]; result: void };
  "store:delete": { args: [key: SettingKey]; result: void };
  "startup:get": { args: []; result: boolean };
  "startup:set": { args: [enabled: boolean]; result: boolean };
  "notification:capabilities": { args: []; result: { supported: boolean } };
  "notification:send": { args: [options: NotificationOptions]; result: NotificationReceipt };
  "notification:close": { args: [id: string]; result: boolean };
  "notification:show": { args: [title: string, body: string]; result: void };
  "download:concurrency:get": { args: []; result: number };
  "download:concurrency:set": { args: [count: number]; result: number };
  "download:start": { args: [url: string]; result: string };
  "download:cancel": { args: [id: string]; result: void };
  "download:pause": { args: [id: string]; result: void };
  "download:resume": { args: [id: string]; result: void };
  "download:retry": { args: [failedId: string]; result: string };
  "download:history:get": { args: [limit?: number]; result: DownloadState[] };
  "download:history:remove": { args: [id: string]; result: boolean };
  "download:history:clear": { args: []; result: number };
  "download:file:exists": { args: [path: string]; result: boolean };
  "print:printers": { args: []; result: { name: string; displayName: string }[] };
  "print:execute": { args: []; result: { success: boolean; failureReason?: string } };
  // 整包更新的操作通道，实际下载和安装行为都在主进程实现。
  "updater:check": { args: []; result: void };
  "updater:install": { args: []; result: void };
  // 增量热更新（Hot Update）通道
  "hot:check": { args: []; result: HotUpdateResult };
  "hot:state": { args: []; result: HotUpdateInfo };
  "hot:restart": { args: []; result: void };
  "hot:confirm": { args: []; result: void };
  "log:write": { args: [level: "info" | "warn" | "error", message: string]; result: void };
  "log:export": { args: []; result: string | null };
  "protocol:scheme": { args: []; result: string };
  "protocol:pending": { args: []; result: string[] };
  "clipboard:write": { args: [text: string]; result: boolean };
  "window:isMaximized": { args: []; result: boolean };
  "theme:system:get": {
    args: [];
    result: {
      shouldUseDarkColors: boolean;
      accentColor: string | null;
    };
  };
  "shell:showItemInFolder": { args: [path: string]; result: boolean };
  "shell:openPath": { args: [path: string]; result: string };
  "shell:openExternal": { args: [url: string]; result: boolean };
  "shell:trashItem": { args: [path: string]; result: boolean };
  // 设置中心批量与多字段读取/保存
  "settings:all:get": { args: []; result: UserSettings };
  "settings:all:set": { args: [settings: Partial<UserSettings>]; result: UserSettings };
  // 原生系统目录选择对话框
  "dialog:selectDirectory": { args: [defaultPath?: string]; result: string | null };
  // 全局快捷键注册与状态获取
  "shortcut:register": {
    args: [accelerator: string];
    result: { success: boolean; error?: string };
  };
  "shortcut:get": { args: []; result: string };
  // 系统环境参数与脱敏排障日志导出
  "diagnostics:system:get": { args: []; result: SystemDiagnostics };
  "diagnostics:exportLogs": {
    args: [];
    result: { success: boolean; filePath?: string; error?: string };
  };
  // 网络连通状态
  "app:networkStatus": { args: []; result: { isOnline: boolean } };

  // === 文件系统 API: 存在性与智能保底 (Ensure & Existence) ===
  /** 确保目录存在；存在返回 true，不存在则递归创建后返回 true */
  "fs:ensureDir": { args: [path: string]; result: boolean };
  /** 兼容 mkdirs 别名 */
  "fs:mkdirs": { args: [path: string]; result: boolean };
  /** 确保文件存在；不存在则自动创建父级目录及空文件 */
  "fs:ensureFile": { args: [path: string]; result: boolean };
  /** 确保硬链接存在，自动补齐目标父级目录 */
  "fs:ensureLink": { args: [src: string, dest: string]; result: boolean };
  /** 确保符号链接存在，自动补齐目标父级目录 */
  "fs:ensureSymlink": {
    args: [src: string, dest: string, type?: "dir" | "file" | "junction"];
    result: boolean;
  };
  /** 判断目标路径是否存在 */
  "fs:exists": { args: [path: string]; result: boolean };
  /** 兼容 pathExists 别名 */
  "fs:pathExists": { args: [path: string]; result: boolean };
  /** 检查目录是否为空目录，或文件是否为 0 字节 */
  "fs:isEmpty": { args: [path: string]; result: boolean };

  // === 文件系统 API: 便捷读写与结构化数据 (Convenient Read/Write) ===
  /** 读取并反序列化 JSON，支持 fallback 兜底默认值 */
  "fs:readJson": { args: [path: string, fallback?: unknown]; result: unknown };
  /** 写入 JSON 数据，自动创建父级目录并格式化缩进 */
  "fs:writeJson": {
    args: [path: string, data: unknown, options?: { spaces?: number }];
    result: boolean;
  };
  /** 兼容 outputJson 别名 */
  "fs:outputJson": {
    args: [path: string, data: unknown, options?: { spaces?: number }];
    result: boolean;
  };
  /** 读取 UTF-8 文本内容，支持 fallback 兜底与 50MB 阈值保护 */
  "fs:readText": {
    args: [path: string, options?: { encoding?: "utf-8" | "ascii"; fallback?: string }];
    result: string;
  };
  /** 写入文本内容，自动补齐父级目录，支持覆盖或 append 追加 */
  "fs:writeText": {
    args: [
      path: string,
      content: string,
      options?: { encoding?: "utf-8" | "base64"; append?: boolean },
    ];
    result: boolean;
  };
  /** 兼容 outputFile 别名 */
  "fs:outputFile": {
    args: [
      path: string,
      data: string,
      options?: { encoding?: "utf-8" | "base64"; append?: boolean },
    ];
    result: boolean;
  };
  /** 读取二进制文件并转为 Base64 编码字符串（带 50MB 保护） */
  "fs:readBinary": { args: [path: string]; result: string };
  /** 将 Base64 编码数据写入二进制文件，自动补齐父目录 */
  "fs:writeBinary": { args: [path: string, base64Data: string]; result: boolean };
  /** 标准文件异步读取 */
  "fs:readFile": {
    args: [path: string, options?: { encoding?: "utf-8" | "base64" }];
    result: string;
  };
  /** 标准文件异步写入 */
  "fs:writeFile": {
    args: [path: string, data: string, options?: { encoding?: "utf-8" | "base64" }];
    result: boolean;
  };
  /** 追加文件内容 */
  "fs:appendFile": {
    args: [path: string, data: string, options?: { encoding?: "utf-8" }];
    result: boolean;
  };

  // === 文件系统 API: 高级文件管理 (Copy, Move, Remove, Clean) ===
  /** 递归复制文件或整个目录树 */
  "fs:copy": { args: [src: string, dest: string, options?: FsCopyOptions]; result: boolean };
  /** 移动文件或目录，底层支持跨分区 EXDEV 自动降级与目标父目录补齐 */
  "fs:move": { args: [src: string, dest: string, options?: FsMoveOptions]; result: boolean };
  /** 幂等安全删除文件或目录（类似 rm -rf，路径不存在静默返回 true） */
  "fs:remove": { args: [path: string]; result: boolean };
  /** 清空目录内所有子文件与子目录，保留目录本身 */
  "fs:emptyDir": { args: [path: string]; result: boolean };
  /** 安全移至系统废纸篓/回收站（防误删） */
  "fs:trash": { args: [path: string]; result: boolean };
  /** 创建目录 */
  "fs:mkdir": { args: [path: string, options?: { recursive?: boolean }]; result: boolean };

  // === 文件系统 API: 目录检索与元数据完整性 (Inspection & Integrity) ===
  /** 扫描目录下所有条目清单（含名称、类型、大小、修改时间） */
  "fs:readDir": {
    args: [path: string, options?: { recursive?: boolean; maxDepth?: number }];
    result: FsEntry[];
  };
  /** 兼容 readdir 别名 */
  "fs:readdir": {
    args: [path: string, options?: { recursive?: boolean; maxDepth?: number }];
    result: FsEntry[];
  };
  /** 获取文件或目录属性元数据 */
  "fs:stat": { args: [path: string]; result: FsStat | null };
  /** 获取符号链接属性元数据 */
  "fs:lstat": { args: [path: string]; result: FsStat | null };
  /** 主进程管道流式计算文件散列摘要（MD5 / SHA256） */
  "fs:checksum": { args: [path: string, algorithm?: "md5" | "sha256"]; result: string };

  // === 文件系统 API: 系统路径与原生对话框 (Paths & Dialogs) ===
  /** 获取常用预设标准基准路径字典（userData, documents, downloads 等） */
  "fs:appPaths": { args: []; result: AppPaths };
  /** 解析路径结构信息（root, dir, base, ext, name, isAbsolute） */
  "fs:pathInfo": { args: [path: string]; result: FsPathInfo };
  /** 唤起系统原生文件/目录打开选择对话框 */
  "fs:dialog:open": { args: [options?: FsOpenDialogOptions]; result: string[] | null };
  /** 唤起系统原生文件保存对话框 */
  "fs:dialog:save": { args: [options?: FsSaveDialogOptions]; result: string | null };
  /** 兼容 showOpenDialog 别名 */
  "fs:showOpenDialog": { args: [options?: FsOpenDialogOptions]; result: string[] | null };
  /** 兼容 showSaveDialog 别名 */
  "fs:showSaveDialog": { args: [options?: FsSaveDialogOptions]; result: string | null };
}
// 只允许存取这些明确列出的设置，不能把任意名称映射成文件系统操作。
export type SettingKey =
  | "theme"
  | "locale"
  | "closeToTray"
  | "windowBounds"
  | "autoStart"
  | "defaultDownloadDir"
  | "downloadConcurrency"
  | "autoResumeDownloads"
  | "notificationsEnabled"
  | "notificationSound"
  | "notifyOnDownload"
  | "notifyOnUpdate"
  | "globalShortcutToggle";

/** 商业化通用设置中心结构 */
export interface UserSettings {
  theme: "light" | "dark" | "system";
  locale: "zh-CN" | "en-US";
  closeToTray: boolean;
  autoStart: boolean;
  defaultDownloadDir: string;
  downloadConcurrency: number;
  autoResumeDownloads: boolean;
  notificationsEnabled: boolean;
  notificationSound: boolean;
  notifyOnDownload: boolean;
  notifyOnUpdate: boolean;
  globalShortcutToggle: string;
}

/** 系统诊断环境信息 */
export interface SystemDiagnostics {
  appVersion: string;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  v8Version: string;
  osPlatform: string;
  osRelease: string;
  osArch: string;
  cpuModel: string;
  totalMemoryMb: number;
  freeMemoryMb: number;
  uptimeSeconds: number;
  isPackaged: boolean;
  logPath: string;
}
// keyof 自动从协议接口推导全部合法调用通道，避免维护第二份字符串联合类型。
export type InvokeChannel = keyof DesktopInvoke;
// 泛型类型根据通道 C 提取参数，例如 app:version 的参数是空元组 []。
export type InvokeArgs<C extends InvokeChannel> = DesktopInvoke[C]["args"];
// 泛型类型根据通道 C 提取结果类型，例如 app:version 返回 string。
export type InvokeResult<C extends InvokeChannel> = DesktopInvoke[C]["result"];
// 下载状态消息会从主进程持续推送给页面，用于显示进度和错误。
export interface DownloadState {
  id: string;
  url: string;
  state:
    | "queued"
    | "started"
    | "progress"
    | "paused"
    | "interrupted"
    | "completed"
    | "cancelled"
    | "failed";
  filename?: string;
  percent?: number;
  receivedBytes?: number;
  totalBytes?: number;
  speed?: number;
  eta?: number;
  canResume?: boolean;
  path?: string;
  error?: string;
  createdAt?: number;
  completedAt?: number;
  fileExists?: boolean;
}
export interface UpdateState {
  kind: "full" | "hot";
  status: string;
  percent?: number;
  error?: string;
}
export interface HotUpdateResult {
  status: "disabled" | "up-to-date" | "ready" | "error";
  message?: string;
}
/** 增量热更新当前生效状态与指针信息 */
export interface HotUpdateInfo {
  currentRevision: number;
  currentVersionTag: string;
  currentCommit: string;
  phase: "none" | "staged" | "trying" | "active";
  previousDirectory: string | null;
  activeDirectory: string;
}
export interface DesktopEvents {
  "download:state": DownloadState;
  "update:state": UpdateState;
  "protocol:open": string;
  "notification:clicked": string;
  "notification:activated": NotificationActivation;
  "notification:settled": NotificationSettled;
  "window:maximize-change": boolean;
  "theme:system:changed": {
    shouldUseDarkColors: boolean;
    accentColor: string | null;
  };
  "network:change": {
    isOnline: boolean;
  };
  "settings:changed": UserSettings;
}
export type EventChannel = keyof DesktopEvents;
// Preload 中的 bridge 必须满足此接口，因此页面调用时拥有类型提示。
export interface DesktopBridge {
  invoke<C extends InvokeChannel>(channel: C, ...args: InvokeArgs<C>): Promise<InvokeResult<C>>;
  on<E extends EventChannel>(channel: E, callback: (payload: DesktopEvents[E]) => void): () => void;
}

/** 文件或目录元数据属性 */
export interface FsStat {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  mtime: number;
  birthtime: number;
  mode: number;
  readonly: boolean;
}

/** 目录检索条目信息 */
export interface FsEntry {
  name: string;
  path: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  size?: number;
  mtime?: number;
}

/** 文件/目录复制选项 */
export interface FsCopyOptions {
  overwrite?: boolean;
  errorOnExist?: boolean;
}

/** 文件/目录移动选项 */
export interface FsMoveOptions {
  overwrite?: boolean;
}

/** 原生打开文件/目录对话框选项 */
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

/** 原生保存文件对话框选项 */
export interface FsSaveDialogOptions {
  title?: string;
  defaultPath?: string;
  buttonLabel?: string;
  filters?: { name: string; extensions: string[] }[];
}

/** 路径结构解析信息 */
export interface FsPathInfo {
  root: string;
  dir: string;
  dirname: string;
  base: string;
  basename: string;
  ext: string;
  extname: string;
  name: string;
  isAbsolute: boolean;
}

/** 常用系统基准目录字典 */
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
