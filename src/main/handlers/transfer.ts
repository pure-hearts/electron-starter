/** 下载与应用更新：主进程统一执行，不向 Renderer 暴露 Electron 下载对象。 */
import { startDownload, controlDownload, retryDownload, getDownloadConcurrency, setDownloadConcurrency } from '../modules/download'
import { checkUpdate, installUpdate } from '../modules/updater'
import { checkHotUpdate, markRendererHealthy } from '../modules/hot-update'
import { getMainWindow } from '../window'
import type { HandlerGroup } from './types'
export const transferHandlers = {
  'download:concurrency:get': () => getDownloadConcurrency(),
  'download:concurrency:set': (_e, [count]) => setDownloadConcurrency(count as number),
  'download:start': (e, [url]) => startDownload(url as string, e.sender),
  'download:cancel': (_e, [id]) => controlDownload(id as string, 'cancel'),
  'download:pause': (_e, [id]) => controlDownload(id as string, 'pause'),
  'download:resume': (_e, [id]) => controlDownload(id as string, 'resume'),
  'download:retry': (e, [id]) => retryDownload(id as string, e.sender),
  'updater:check': () => checkUpdate(),
  'updater:install': () => installUpdate(),
  'hot:check': () => checkHotUpdate(),
  // 热更新确认只能由主窗口发送，避免其他页面错误确认新资源已健康。
  'hot:confirm': e => {
    const main = getMainWindow()
    if (!main || main.isDestroyed() || main.webContents.id !== e.sender.id) throw new Error('Only the main application window may confirm a renderer update')
    markRendererHealthy()
  },
} satisfies HandlerGroup
