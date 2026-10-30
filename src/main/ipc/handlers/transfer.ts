/** 下载与应用更新：主进程统一执行，不向 Renderer 暴露 Electron 下载对象。 */
import {
  startDownload,
  controlDownload,
  retryDownload,
  getDownloadConcurrency,
  setDownloadConcurrency,
} from "../../modules/download";
import { checkUpdate, installUpdate } from "../../modules/update/full";
import {
  checkHotUpdate,
  markRendererHealthy,
  getHotUpdateInfo,
  applyHotRestart,
} from "../../modules/update/hot";
import { getMainWindow } from "../../window";
import type { HandlerGroup } from "./types";

export const transferHandlers = {
  "download:concurrency:get": () => getDownloadConcurrency(),
  "download:concurrency:set": (_e, [count]) => setDownloadConcurrency(count as number),
  "download:start": (e, [url]) => startDownload(url as string, e.sender),
  "download:cancel": (_e, [id]) => controlDownload(id as string, "cancel"),
  "download:pause": (_e, [id]) => controlDownload(id as string, "pause"),
  "download:resume": (_e, [id]) => controlDownload(id as string, "resume"),
  "download:retry": (e, [id]) => retryDownload(id as string, e.sender),
  "updater:check": () => checkUpdate(),
  "updater:install": () => installUpdate(),
  "hot:check": () => checkHotUpdate(),
  "hot:state": () => getHotUpdateInfo(),
  "hot:restart": () => applyHotRestart(),
  // 热更新确认只能由主窗口发送，避免子窗口或未就绪页面错误确认新资源已健康；非主窗口静默忽略，不引发 IPC 假告警。
  "hot:confirm": (e) => {
    const main = getMainWindow();
    if (!main || main.isDestroyed() || main.webContents.id !== e.sender.id) {
      return;
    }
    markRendererHealthy();
  },
} satisfies HandlerGroup;
