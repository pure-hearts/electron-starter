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
}
// 只允许存取这些明确列出的设置，不能把任意名称映射成文件系统操作。
export type SettingKey = "theme" | "locale" | "closeToTray" | "windowBounds";
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
  state: "queued" | "started" | "progress" | "paused" | "completed" | "cancelled" | "failed";
  percent?: number;
  path?: string;
  error?: string;
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
}
export type EventChannel = keyof DesktopEvents;
// Preload 中的 bridge 必须满足此接口，因此页面调用时拥有类型提示。
export interface DesktopBridge {
  invoke<C extends InvokeChannel>(channel: C, ...args: InvokeArgs<C>): Promise<InvokeResult<C>>;
  on<E extends EventChannel>(channel: E, callback: (payload: DesktopEvents[E]) => void): () => void;
}
