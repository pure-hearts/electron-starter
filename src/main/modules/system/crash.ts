/** 崩溃恢复监听属于应用生命周期；重复注册与退出时必须显式撤销。 */
import { app, dialog, BrowserWindow } from "electron";
import { log } from "../core/logger";
import { RecoveryPolicy } from "../core/recovery-policy";
import { rendererURL } from "../protocol";

const recovery = new RecoveryPolicy();
let installed = false;
// 代次用于识别旧对话框：即使窗口仍存在，退出后的异步答复也不能重载页面。
let generation = 0;

/**
 * 加载优雅崩溃兜底页面，防止出现永久灰白屏
 */
export function renderCrashFallback(
  win: BrowserWindow,
  details: Electron.RenderProcessGoneDetails,
): void {
  if (!win || win.isDestroyed()) return;
  const reason = encodeURIComponent(details.reason || "unknown");
  const code = encodeURIComponent(String(details.exitCode ?? -1));
  const fallbackUrl = rendererURL(`/crash-fallback.html?reason=${reason}&code=${code}`);

  win.loadURL(fallbackUrl).catch(() => {
    // 降级兜底方案：使用纯数据 URL 加载
    const inlineHtml = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>崩溃恢复</title><style>body{background:#0b0f19;color:#f3f4f6;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.card{background:#161e31;padding:32px;border-radius:12px;border:1px solid #374151;text-align:center;max-width:440px}h2{color:#ef4444;margin:0 0 12px 0}p{color:#9ca3af;font-size:14px;line-height:1.6}button{background:#3b82f6;color:#fff;border:none;padding:10px 20px;border-radius:6px;cursor:pointer;font-size:14px;margin-top:16px}</style></head><body><div class="card"><h2>页面异常终止</h2><p>渲染进程退出 (原因: ${details.reason}, 代码: ${details.exitCode})。</p><button onclick="location.reload()">重新加载</button></div></body></html>`;
    win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(inlineHtml)).catch(() => {});
  });
}

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

  if (allowed) {
    void dialog
      .showMessageBox(win, {
        type: "warning",
        message: "页面异常退出，是否重新加载？",
        buttons: ["恢复", "取消"],
      })
      .then((result) => {
        if (
          allowed &&
          installed &&
          current === generation &&
          result.response === 0 &&
          !win.isDestroyed()
        ) {
          win.reload();
        } else if (!win.isDestroyed() && result.response === 1) {
          renderCrashFallback(win, details);
        }
      })
      .catch((error) => {
        log.error("Crash dialog failed", error);
        renderCrashFallback(win, details);
      });
  } else {
    // 超过代次上限或不可恢复时，直接展示崩溃兜底引导界面
    renderCrashFallback(win, details);
  }
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
