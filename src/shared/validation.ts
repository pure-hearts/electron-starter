/**
 * IPC 运行时安全校验。
 * 通道与事件白名单限制可调用的功能，validate 校验通道与事件白名单准入。
 * safeUrl、safeLocalPath 等工具函数用于具体的独立安全约束。
 */
import type { InvokeChannel, EventChannel, SettingKey } from "./ipc";
/** Runtime validation is required even if TS types compile. */
// 设置键也使用白名单，避免 IPC 可以操作任意配置项。
export const SETTINGS = new Set<SettingKey>([
  "theme",
  "locale",
  "closeToTray",
  "windowBounds",
  "autoStart",
  "defaultDownloadDir",
  "downloadConcurrency",
  "autoResumeDownloads",
  "notificationsEnabled",
  "notificationSound",
  "notifyOnDownload",
  "notifyOnUpdate",
  "globalShortcutToggle",
]);
// Preload 和 Main 共同使用此集合；只有列出的通道才允许被调用。
export const allowedChannels = new Set<InvokeChannel>([
  "app:version",
  "app:quit",
  "app:restart",
  "window:action",
  "window:open",
  "store:get",
  "store:set",
  "store:delete",
  "startup:get",
  "startup:set",
  "notification:show",
  "notification:send",
  "notification:close",
  "notification:capabilities",
  "download:start",
  "download:cancel",
  "download:pause",
  "download:resume",
  "download:retry",
  "download:concurrency:get",
  "download:concurrency:set",
  "download:history:get",
  "download:history:remove",
  "download:history:clear",
  "download:file:exists",
  "print:printers",
  "print:execute",
  "updater:check",
  "updater:install",
  "hot:check",
  "hot:state",
  "hot:restart",
  "hot:confirm",
  "log:write",
  "log:export",
  "protocol:scheme",
  "protocol:pending",
  "clipboard:write",
  "window:isMaximized",
  "theme:system:get",
  "shell:showItemInFolder",
  "shell:openPath",
  "shell:openExternal",
  "shell:trashItem",
  "settings:all:get",
  "settings:all:set",
  "dialog:selectDirectory",
  "shortcut:register",
  "shortcut:get",
  "diagnostics:system:get",
  "diagnostics:exportLogs",
  "app:networkStatus",
  "fs:ensureDir",
  "fs:mkdirs",
  "fs:ensureFile",
  "fs:ensureLink",
  "fs:ensureSymlink",
  "fs:exists",
  "fs:pathExists",
  "fs:isEmpty",
  "fs:readJson",
  "fs:writeJson",
  "fs:outputJson",
  "fs:readText",
  "fs:writeText",
  "fs:outputFile",
  "fs:readBinary",
  "fs:writeBinary",
  "fs:readFile",
  "fs:writeFile",
  "fs:appendFile",
  "fs:copy",
  "fs:move",
  "fs:remove",
  "fs:emptyDir",
  "fs:trash",
  "fs:mkdir",
  "fs:readDir",
  "fs:readdir",
  "fs:stat",
  "fs:lstat",
  "fs:checksum",
  "fs:appPaths",
  "fs:pathInfo",
  "fs:dialog:open",
  "fs:dialog:save",
  "fs:showOpenDialog",
  "fs:showSaveDialog",
]);

// 事件白名单：仅允许页面订阅下载进度、更新状态、协议唤起和通知交互等受控系统事件。
export const allowedEvents = new Set<EventChannel>([
  "download:state",
  "update:state",
  "protocol:open",
  "notification:clicked",
  "notification:activated",
  "notification:settled",
  "window:maximize-change",
  "theme:system:changed",
  "network:change",
  "settings:changed",
]);
export function safeExternalUrl(input: string): URL {
  if (typeof input !== "string" || input.length > 4096) throw new Error("Invalid URL");
  const url = new URL(input);
  if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
    throw new Error("Protocol not permitted: " + url.protocol);
  }
  return url;
}

export function safeLocalPath(input: string): string {
  if (typeof input !== "string" || input.trim().length === 0 || input.length > 4096) {
    throw new Error("Invalid path string");
  }
  if (input.includes("\0")) {
    throw new Error("Null bytes are not permitted in path");
  }
  return input.trim();
}

export function safeUrl(input: string): URL {
  if (typeof input !== "string" || input.length > 4096) throw new Error("Invalid URL");
  // 解析失败会抛异常，从而拒绝不合法的字符串地址。
  const url = new URL(input);
  // 限制 HTTPS，避免普通 HTTP 明文传输下载地址及内容。
  if (url.protocol !== "https:") throw new Error("Only HTTPS downloads are allowed");
  // 禁止用户名/密码嵌入 URL，降低认证信息误记录或外泄的风险。
  if (url.username || url.password) throw new Error("Credentials in URLs are not permitted");
  // 统一大小写后比较，防止大小写差异绕过主机名限制。
  const host = url.hostname.toLowerCase();
  // 拒绝常见回环、私网、链路本地等主机地址，以降低 SSRF 风险。
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "[::1]" ||
    host === "[::]" ||
    host.startsWith("[::ffff:") ||
    /^\[(?:fc|fd|fe8|fe9|fea|feb|ff)/i.test(host) ||
    host === "0.0.0.0" ||
    host.startsWith("127.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.") ||
    /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)
  )
    throw new Error("Private network addresses are not permitted");
  return url;
}
/**
 * 校验 IPC 通道或事件是否在受控白名单中。
 * 只要属于 allowedChannels 或 allowedEvents 即可放行，参数校验交由具体业务层或 TypeScript 类型契约。
 */
export function validate(channel: string, _args?: unknown[]): void {
  if (
    !allowedChannels.has(channel as InvokeChannel) &&
    !allowedEvents.has(channel as EventChannel)
  ) {
    throw new Error("Invalid IPC channel or event: " + channel);
  }
}
