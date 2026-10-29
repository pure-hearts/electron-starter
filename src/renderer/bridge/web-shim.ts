/**
 * @file web-shim.ts
 * @description Web 浏览器环境垫片适配器：
 * 当应用在纯 Web 端单独启动时，提供与 Electron IPC 契约（DesktopBridge）完全一致的降级实现，
 * 避免视图层与业务逻辑出现 `undefined` 错误，实现零改动平滑运行。
 */

import { feedback } from "../utils/feedback";
import type {
  DesktopBridge,
  DesktopEvents,
  DownloadState,
  EventChannel,
  HotUpdateInfo,
  HotUpdateResult,
  InvokeArgs,
  InvokeChannel,
  InvokeResult,
  SettingKey,
} from "@shared/ipc";
import type { NotificationOptions } from "@shared/notification";

/** 本地存储命名空间前缀，防止同域污染 */
const STORAGE_PREFIX = "app:";

/** 内存回退字典（在 Node 单元测试或无 DOM 环境下防御性工作） */
const memoryStore = new Map<string, string>();

function getStorageItem(key: string): string | null {
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    return window.localStorage.getItem(key);
  }
  return memoryStore.get(key) ?? null;
}

function setStorageItem(key: string, val: string): void {
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    window.localStorage.setItem(key, val);
  } else {
    memoryStore.set(key, val);
  }
}

function removeStorageItem(key: string): void {
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    window.localStorage.removeItem(key);
  } else {
    memoryStore.delete(key);
  }
}

/** 具备 DOM 安全检查的提示工具 */
function notifyMessage(type: "info" | "success" | "warning" | "error", message: string): void {
  if (typeof document !== "undefined") {
    feedback.message[type](message);
  } else {
    console.log(`[WebShim:${type}] ${message}`);
  }
}

/** 事件订阅发布总线（用于模拟主进程向页面的主动广播） */
const eventListeners: Partial<Record<EventChannel, Array<(payload: any) => void>>> = {};

function emitEvent<E extends EventChannel>(channel: E, payload: DesktopEvents[E]): void {
  const listeners = eventListeners[channel];
  if (listeners) {
    listeners.forEach((callback) => callback(payload));
  }
}

/**
 * 创建纯 Web 端的透明降级 Bridge
 */
export function createWebShimBridge(): DesktopBridge & { __isWebShim: true } {
  return {
    __isWebShim: true,

    /**
     * 核心调用通道分发与优雅降级
     */
    async invoke<C extends InvokeChannel>(
      channel: C,
      ...args: InvokeArgs<C>
    ): Promise<InvokeResult<C>> {
      switch (channel) {
        // ----------------- 1. 应用与生命周期 -----------------
        case "app:version": {
          return "0.1.3 (Web)" as InvokeResult<C>;
        }

        case "app:restart": {
          notifyMessage("info", "Web 模式：正在刷新页面重新加载资源...");
          if (typeof window !== "undefined") {
            setTimeout(() => window.location.reload(), 300);
          }
          return undefined as InvokeResult<C>;
        }

        case "app:quit": {
          notifyMessage("info", "Web 模式：请直接关闭当前浏览器标签页。");
          return undefined as InvokeResult<C>;
        }

        // ----------------- 2. 窗口控制 -----------------
        case "window:action": {
          const action = args[0] as string;
          if (typeof document !== "undefined") {
            if (action === "maximize" || action === "restore") {
              if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen().catch(() => undefined);
              } else {
                await document.exitFullscreen().catch(() => undefined);
              }
            } else if (action === "close" || action === "minimize") {
              notifyMessage("info", `Web 模式：窗口由浏览器管理，不支持模拟 ${action} 操作。`);
            }
          }
          return undefined as InvokeResult<C>;
        }

        case "window:open": {
          const route = (args[0] as string) || "/";
          if (typeof window !== "undefined") {
            window.open(route, "_blank");
          }
          return 1 as InvokeResult<C>;
        }

        // ----------------- 3. 本地持久化存储 (localStorage) -----------------
        case "store:get": {
          const key = args[0] as SettingKey;
          const raw = getStorageItem(`${STORAGE_PREFIX}${key}`);
          if (raw === null) return null as InvokeResult<C>;
          try {
            return JSON.parse(raw) as InvokeResult<C>;
          } catch {
            return raw as InvokeResult<C>;
          }
        }

        case "store:set": {
          const key = args[0] as SettingKey;
          const val = args[1];
          setStorageItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(val));
          return undefined as InvokeResult<C>;
        }

        case "store:delete": {
          const key = args[0] as SettingKey;
          removeStorageItem(`${STORAGE_PREFIX}${key}`);
          return undefined as InvokeResult<C>;
        }

        // ----------------- 4. 开机自启 (Web 降级) -----------------
        case "startup:get": {
          return false as InvokeResult<C>;
        }

        case "startup:set": {
          notifyMessage("info", "Web 模式：浏览器无法控制操作系统开机自启动。");
          return false as InvokeResult<C>;
        }

        // ----------------- 5. 系统通知 (HTML5 Notification API) -----------------
        case "notification:capabilities": {
          const supported = typeof window !== "undefined" && "Notification" in window;
          return { supported } as InvokeResult<C>;
        }

        case "notification:send":
        case "notification:show": {
          let title = "通知";
          let body = "";
          if (channel === "notification:show") {
            const rawTitle = args[0];
            const rawBody = args[1];
            title = typeof rawTitle === "string" ? rawTitle : "系统通知";
            body = typeof rawBody === "string" ? rawBody : "";
          } else {
            const opts = args[0] as NotificationOptions | undefined;
            title = opts?.title || "系统通知";
            body = opts?.body || "";
          }

          if (typeof window !== "undefined" && "Notification" in window) {
            if (Notification.permission === "granted") {
              new Notification(title, { body });
            } else if (Notification.permission !== "denied") {
              void Notification.requestPermission()
                .then((permission) => {
                  if (permission === "granted") {
                    new Notification(title, { body });
                  } else if (typeof document !== "undefined") {
                    feedback.notification.info(title, body);
                  }
                })
                .catch(() => undefined);
            } else if (typeof document !== "undefined") {
              feedback.notification.info(title, body);
            }
          } else if (typeof document !== "undefined") {
            feedback.notification.info(title, body);
          }

          return { id: `web-notify-${Date.now()}` } as InvokeResult<C>;
        }

        case "notification:close": {
          return true as InvokeResult<C>;
        }

        // ----------------- 6. 下载模拟 (Web 模拟) -----------------
        case "download:concurrency:get": {
          return 5 as InvokeResult<C>;
        }

        case "download:concurrency:set": {
          return ((args[0] as number) || 5) as InvokeResult<C>;
        }

        case "download:start": {
          const rawUrl = args[0];
          const url = typeof rawUrl === "string" ? rawUrl : "";
          const id = `web-dl-${Date.now()}`;
          if (typeof document !== "undefined") {
            const a = document.createElement("a");
            a.href = url;
            a.download = url.split("/").pop() || "download";
            a.target = "_blank";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }

          const progressState: DownloadState = {
            id,
            url,
            state: "completed",
            percent: 100,
          };
          emitEvent("download:state", progressState);
          return id as InvokeResult<C>;
        }

        case "download:cancel":
        case "download:pause":
        case "download:resume":
        case "download:retry": {
          notifyMessage("info", "Web 模式：下载直接由浏览器下载管理器处理。");
          return (channel === "download:retry" ? "retry-id" : undefined) as InvokeResult<C>;
        }

        // ----------------- 7. 打印 -----------------
        case "print:printers": {
          return [
            { name: "default", displayName: "系统默认打印机 (Browser Print)" },
          ] as InvokeResult<C>;
        }

        case "print:execute": {
          if (typeof window !== "undefined") {
            window.print();
          }
          return { success: true } as InvokeResult<C>;
        }

        // ----------------- 8. 全量与增量更新 (Web 模式无需更新客户端) -----------------
        case "updater:check": {
          notifyMessage("success", "Web 模式：页面直接加载自服务器最新构建，已是最新状态。");
          emitEvent("update:state", { kind: "full", status: "up-to-date" });
          return undefined as InvokeResult<C>;
        }

        case "updater:install": {
          notifyMessage("info", "Web 模式：无需安装整包。");
          return undefined as InvokeResult<C>;
        }

        case "hot:check": {
          notifyMessage("success", "Web 模式：已加载当前服务器最新静态资源。");
          emitEvent("update:state", { kind: "hot", status: "up-to-date" });
          const res: HotUpdateResult = { status: "up-to-date", message: "Web 端始终保持最新资源" };
          return res as InvokeResult<C>;
        }

        case "hot:state": {
          const info: HotUpdateInfo = {
            currentRevision: 20261029180000,
            currentVersionTag: "0.1.3_web",
            currentCommit: "web-live",
            phase: "active",
            previousDirectory: null,
            activeDirectory: "Web Origin (Browser)",
          };
          return info as InvokeResult<C>;
        }

        case "hot:restart": {
          if (typeof window !== "undefined") {
            window.location.reload();
          }
          return undefined as InvokeResult<C>;
        }

        case "hot:confirm": {
          return undefined as InvokeResult<C>;
        }

        // ----------------- 9. 日志与协议 -----------------
        case "log:write": {
          const [level, text] = args as [string, string];
          if (level === "error") console.error("[WebLogger]", text);
          else if (level === "warn") console.warn("[WebLogger]", text);
          else console.log("[WebLogger]", text);
          return undefined as InvokeResult<C>;
        }

        case "log:export": {
          if (typeof document !== "undefined") {
            const blob = new Blob(
              [
                `[Web Session Log - ${new Date().toISOString()}]\nSystem initialized in Web Browser mode.\n`,
              ],
              { type: "text/plain" },
            );
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "web-client.log";
            a.click();
            URL.revokeObjectURL(a.href);
          }
          return "web-client.log" as InvokeResult<C>;
        }

        case "protocol:scheme": {
          return "web-protocol-not-available" as InvokeResult<C>;
        }

        case "protocol:pending": {
          return [] as InvokeResult<C>;
        }

        case "clipboard:write": {
          const text = (args[0] as string) || "";
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            void navigator.clipboard.writeText(text).catch(() => undefined);
          }
          return true as InvokeResult<C>;
        }

        // ----------------- 10. 窗口状态与系统外观 -----------------
        case "window:isMaximized": {
          const isMax = typeof document !== "undefined" && Boolean(document.fullscreenElement);
          return isMax as InvokeResult<C>;
        }

        case "theme:system:get": {
          const dark =
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches;
          return { shouldUseDarkColors: dark, accentColor: null } as InvokeResult<C>;
        }

        // ----------------- 11. 原生 Shell 操作模拟 -----------------
        case "shell:showItemInFolder": {
          const targetPath = typeof args[0] === "string" ? args[0] : "";
          notifyMessage("info", `Web 模式：浏览器无法定位本地文件 (${targetPath})`);
          return true as InvokeResult<C>;
        }

        case "shell:openPath": {
          const targetPath = typeof args[0] === "string" ? args[0] : "";
          notifyMessage("info", `Web 模式：浏览器无法打开本地路径 (${targetPath})`);
          return "" as InvokeResult<C>;
        }

        case "shell:openExternal": {
          const url = typeof args[0] === "string" ? args[0] : "";
          if (typeof window !== "undefined") {
            window.open(url, "_blank", "noopener,noreferrer");
          }
          return true as InvokeResult<C>;
        }

        case "shell:trashItem": {
          const targetPath = typeof args[0] === "string" ? args[0] : "";
          notifyMessage("info", `Web 模式：浏览器无法移至回收站 (${targetPath})`);
          return true as InvokeResult<C>;
        }

        default: {
          console.warn(`[WebShim] 未知通道调用: ${String(channel)}`, args);
          return undefined as InvokeResult<C>;
        }
      }
    },

    /**
     * 订阅主进程广播事件（Web 端由模拟总线支持）
     */
    on<E extends EventChannel>(
      channel: E,
      callback: (payload: DesktopEvents[E]) => void,
    ): () => void {
      if (!eventListeners[channel]) {
        eventListeners[channel] = [];
      }
      eventListeners[channel]!.push(callback);
      return () => {
        const list = eventListeners[channel];
        if (list) {
          const idx = list.indexOf(callback);
          if (idx !== -1) list.splice(idx, 1);
        }
      };
    },
  };
}
