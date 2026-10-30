/** 崩溃恢复监听属于应用生命周期；重复注册与退出时必须显式撤销。 */
import { app, dialog, BrowserWindow } from "electron";
import { log } from "../core/logger";
import { RecoveryPolicy } from "../core/recovery-policy";

const recovery = new RecoveryPolicy();
let installed = false;
// 代次用于识别旧对话框：即使窗口仍存在，退出后的异步答复也不能重载页面。
let generation = 0;

const onRendererGone = (
  _event: Electron.Event,
  contents: Electron.WebContents,
  details: Electron.RenderProcessGoneDetails,
) => {
  log.error("Renderer gone", details.reason, details.exitCode);
  const win = BrowserWindow.fromWebContents(contents);
  if (!win || win.isDestroyed()) return;
  const current = generation;
  const allowed = recovery.canRecover();
  void dialog
    .showMessageBox(win, {
      type: allowed ? "warning" : "error",
      message: allowed ? "页面异常退出，是否重新加载？" : "应用多次崩溃，请退出并查看日志。",
      buttons: allowed ? ["恢复", "取消"] : ["确定"],
    })
    .then((result) => {
      if (
        allowed &&
        installed &&
        current === generation &&
        result.response === 0 &&
        !win.isDestroyed()
      )
        win.reload();
    })
    .catch((error) => log.error("Crash dialog failed", error));
};

const onChildGone = (_event: Electron.Event, details: Electron.Details) =>
  log.error("Child process gone", details.type, details.reason);
const onException = (error: Error) => log.error("Uncaught exception", error);
const onRejection = (reason: unknown) => log.error("Unhandled rejection", reason);

export function initCrashRecovery(): void {
  if (installed) return;
  installed = true;
  app.on("render-process-gone", onRendererGone);
  app.on("child-process-gone", onChildGone);
  process.on("uncaughtException", onException);
  process.on("unhandledRejection", onRejection);
}

export function disposeCrashRecovery(): void {
  installed = false;
  generation += 1;
  app.removeListener("render-process-gone", onRendererGone);
  app.removeListener("child-process-gone", onChildGone);
  process.removeListener("uncaughtException", onException);
  process.removeListener("unhandledRejection", onRejection);
}
