/** Electron 原生通知适配器：统一持有对象，并向安全的 Renderer 桥接发送事件。 */
import { Notification, BrowserWindow, app } from "electron";
import path from "node:path";
import fs from "node:fs";
import type { NotificationOptions } from "../../../shared/notification";
import { broadcast, focusMainWindow, getMainWindow } from "../../window";
import { NotificationCenter } from "./center";
import { log } from "../core/logger";
import { getSetting } from "../store";

function getNotificationIcon(customIcon?: string): string | undefined {
  if (customIcon && typeof customIcon === "string") return customIcon;
  const base = app.isPackaged
    ? path.join(process.resourcesPath, "resources", "icons")
    : path.join(process.cwd(), "resources", "icons");
  const defaultIcon = path.join(base, "icon.png");
  return fs.existsSync(defaultIcon) ? defaultIcon : undefined;
}

function calculateSilent(): boolean {
  const soundEnabled = getSetting("notificationSound") ?? true;
  if (!soundEnabled) return true;
  const mainWindow = getMainWindow();
  if (
    mainWindow &&
    !mainWindow.isDestroyed() &&
    mainWindow.isFocused() &&
    !mainWindow.isMinimized()
  ) {
    return true;
  }
  return false;
}

export const notificationCenter = new NotificationCenter({
  supported: () => Notification.isSupported(),
  create: (options: NotificationOptions) => {
    const silent = calculateSilent();
    const icon = getNotificationIcon(options.icon);
    const notice = new Notification({
      title: options.title,
      body: options.body,
      silent,
      icon,
    });
    notice.on("failed", (_event, error) => {
      log.warn("Notification failed to display", error);
    });
    return notice;
  },
  settled: (payload) => broadcast("notification:settled", payload),
  activated: (payload, title) => {
    // 兼容旧版只接收 title 的通知点击监听器。
    broadcast("notification:clicked", title);
    const target =
      payload.sourceWindowId === undefined
        ? undefined
        : BrowserWindow.getAllWindows().find((w) => w.webContents.id === payload.sourceWindowId);
    // 恢复并聚焦窗口；具体业务动作统一由 Renderer 监听 notification:activated 自主响应。
    if (target && !target.isDestroyed()) {
      target.show();
      target.focus();
    } else focusMainWindow();
    broadcast("notification:activated", payload);
  },
});
/** 旧接口原样保留，内部接入新的通知中心。 */
export function notify(title: string, body: string): void {
  const enabled = getSetting("notificationsEnabled");
  if (enabled === false) return;
  const result = notificationCenter.send({ title, body });
  if (!result.accepted && result.reason === "unsupported")
    throw new Error("Notifications are not supported by this OS");
}

/** 业务通知属于辅助反馈；系统不支持或通知失败不能改变下载/更新的真实结果。 */
export function notifyBusiness(options: NotificationOptions): void {
  try {
    const enabled = getSetting("notificationsEnabled");
    if (enabled === false) return;
    notificationCenter.send(options);
  } catch (error) {
    log.warn("Business notification failed", error);
  }
}
