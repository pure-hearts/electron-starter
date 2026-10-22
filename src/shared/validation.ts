/**
 * IPC 运行时安全校验。
 * 通道白名单限制可调用的功能，validate 检查参数数量、类型和内容。
 * safeUrl 约束下载地址；TypeScript 类型不能替代这些实际运行时检查。
 */
import type { InvokeChannel, SettingKey } from "./ipc";
/** Runtime validation is required even if TS types compile. */
// 设置键也使用白名单，避免 IPC 可以操作任意配置项。
export const SETTINGS = new Set<SettingKey>(["theme", "locale", "closeToTray", "windowBounds"]);
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
  "print:printers",
  "print:execute",
  "updater:check",
  "updater:install",
  "hot:check",
  "hot:confirm",
  "log:write",
  "log:export",
  "protocol:scheme",
  "protocol:pending",
]);
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
export function validate(channel: InvokeChannel, args: unknown[]): void {
  // 通用字符串校验辅助函数：同时限制类型、非空和最大长度。
  const str = (i: number, max = 512) =>
    typeof args[i] === "string" &&
    (args[i] as string).length > 0 &&
    (args[i] as string).length <= max;
  // 不需要参数的通道只能携带空参数数组，额外参数不会被静默忽略。
  const noArgs = [
    "app:version",
    "app:quit",
    "app:restart",
    "startup:get",
    "notification:capabilities",
    "download:concurrency:get",
    "print:printers",
    "print:execute",
    "updater:check",
    "updater:install",
    "hot:check",
    "hot:confirm",
    "log:export",
    "protocol:scheme",
    "protocol:pending",
  ];
  if (noArgs.includes(channel) && args.length === 0) return;
  if (
    channel === "window:action" &&
    args.length === 1 &&
    ["minimize", "maximize", "restore", "hide", "show", "close"].includes(args[0] as string)
  )
    return;
  if (
    channel === "window:open" &&
    args.length === 1 &&
    str(0) &&
    /^\/[\w/-]*$/.test(args[0] as string)
  )
    return;
  if (
    (channel === "store:get" || channel === "store:delete") &&
    args.length === 1 &&
    SETTINGS.has(args[0] as SettingKey)
  )
    return;
  // 写入配置要按 key 检查具体值，防止错误类型污染持久化配置。
  if (channel === "store:set" && args.length === 2 && SETTINGS.has(args[0] as SettingKey)) {
    const [key, value] = args;
    if (key === "closeToTray" && typeof value === "boolean") return;
    if (key === "locale" && (value === "zh-CN" || value === "en-US")) return;
    if (key === "theme" && (value === "light" || value === "dark" || value === "system")) return;
    if (key === "windowBounds" && typeof value === "string" && value.length <= 512) return;
  }
  if (channel === "startup:set" && args.length === 1 && typeof args[0] === "boolean") return;
  if (channel === "notification:show" && args.length === 2 && str(0, 128) && str(1, 1000)) return;
  if (channel === "notification:close" && args.length === 1 && str(0, 64)) return;
  if (channel === "notification:send" && args.length === 1) {
    const value = args[0];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const o = value as Record<string, unknown>;
      // 对象必须是已知字段，拒绝潜在的命令/URL 或未定义扩展字段。
      const keys = Object.keys(o);
      if (
        keys.every((key) => ["title", "body", "kind", "dedupeKey", "action"].includes(key)) &&
        typeof o.title === "string" &&
        o.title.length > 0 &&
        o.title.length <= 128 &&
        typeof o.body === "string" &&
        o.body.length > 0 &&
        o.body.length <= 1000 &&
        (o.kind === undefined ||
          ["info", "success", "warning", "error"].includes(o.kind as string)) &&
        (o.dedupeKey === undefined ||
          (typeof o.dedupeKey === "string" &&
            o.dedupeKey.length > 0 &&
            o.dedupeKey.length <= 128)) &&
        (o.action === undefined ||
          (typeof o.action === "string" && /^\/[A-Za-z0-9_/-]{0,128}$/.test(o.action)))
      )
        return;
    }
  }
  // 只允许 1～50 的整数，拒绝小数、NaN、Infinity 和越界值。
  if (
    channel === "download:concurrency:set" &&
    args.length === 1 &&
    typeof args[0] === "number" &&
    Number.isInteger(args[0]) &&
    args[0] >= 1 &&
    args[0] <= 50
  )
    return;
  if (channel === "download:start" && args.length === 1 && str(0, 4096)) {
    safeUrl(args[0] as string);
    return;
  }
  if (
    ["download:cancel", "download:pause", "download:resume", "download:retry"].includes(channel) &&
    args.length === 1 &&
    str(0, 64)
  )
    return;
  if (
    channel === "log:write" &&
    args.length === 2 &&
    ["info", "warn", "error"].includes(args[0] as string) &&
    str(1, 2048)
  )
    return;
  // 未匹配任何合法参数组合时一律拒绝；默认失败而不是默认放行。
  throw new Error("Invalid IPC arguments: " + channel);
}
