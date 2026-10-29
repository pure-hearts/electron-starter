/** 窗口原生交互与事件广播。 */
import { BrowserWindow } from "electron";
import type { EventChannel, DesktopEvents } from "../../shared/ipc";
import { createMainWindow } from "./main-window";

/** 根据调用 IPC 的页面定位其窗口，执行最小化、最大化等原生操作。 */
export function windowAction(sender: Electron.WebContents, action: string): void {
  const win = BrowserWindow.fromWebContents(sender);
  if (!win) throw new Error("Window unavailable");
  switch (action) {
    case "minimize":
      win.minimize();
      break;
    case "maximize":
      win.maximize();
      break;
    case "restore":
      win.restore();
      break;
    case "hide":
      win.hide();
      break;
    case "show":
      win.show();
      win.focus();
      break;
    case "close":
      win.close();
      break;
    default:
      throw new Error("Unknown action");
  }
}

/** webContents.send 属于主进程向所有存活渲染窗口推送的单向 IPC。 */
export function broadcast<E extends EventChannel>(name: E, payload: DesktopEvents[E]): void {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed() && !w.webContents.isDestroyed()) {
      w.webContents.send(name, payload);
    }
  });
}

export const broadcastToAllWindows = broadcast;

/** 激活或创建主窗口并聚焦。 */
export function focusMainWindow(): void {
  const w = createMainWindow();
  if (w.isMinimized()) w.restore();
  w.show();
  w.focus();
}
