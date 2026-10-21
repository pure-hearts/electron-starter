/**
 * 主进程 IPC 路由：集中处理渲染进程通过 window.desktop.invoke 发起的请求。
 * registerIPC 先检查调用来源和参数，再把请求分发给对应业务模块。
 * 这里拥有系统权限，不能直接信任页面发来的数据。
 */
import { ipcMain, app, dialog } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { IpcMainInvokeEvent } from 'electron'
import type { InvokeChannel, SettingKey } from '../shared/ipc'
import { allowedChannels, validate } from '../shared/validation'
import { windowAction, openChild, getMainWindow } from './window'
import { getSetting, setSetting, deleteSetting } from './modules/store'
import { getAutoStart, setAutoStart } from './modules/startup'
import { notify } from './modules/notification'
import { startDownload, controlDownload, retryDownload } from './modules/download'
import { printers, printCurrentPage } from './modules/print'
import { checkUpdate, installUpdate } from './modules/updater'
import { checkHotUpdate, markRendererHealthy } from './modules/hot-update'
import { log, writeRendererLog } from './modules/logger'
import { DEEP_LINK_SCHEME, consumePendingDeepLinks } from './modules/protocol'
import { requestQuit, requestRestart } from './modules/lifecycle'
type Handler = (event: IpcMainInvokeEvent, args: unknown[]) => unknown
const handlers: Record<InvokeChannel, Handler> = {
  'app:version': () => app.getVersion(),
  'app:quit': () => requestQuit(),
  'app:restart': () => requestRestart(),
  'window:action': (e, [action]) => windowAction(e.sender, action as string),
  'window:open': (_e, [route]) => openChild(route as string),
  'store:get': (_e, [key]) => getSetting(key as SettingKey),
  'store:set': (_e, [key, value]) => setSetting(key as SettingKey, value as string | boolean),
  'store:delete': (_e, [key]) => deleteSetting(key as SettingKey),
  'startup:get': () => getAutoStart(),
  'startup:set': (_e, [value]) => setAutoStart(value as boolean),
  'notification:show': (_e, [title, body]) => notify(title as string, body as string),
  'download:start': (e, [url]) => startDownload(url as string, e.sender),
  'download:cancel': (_e, [id]) => controlDownload(id as string, 'cancel'),
  'download:pause': (_e, [id]) => controlDownload(id as string, 'pause'),
  'download:resume': (_e, [id]) => controlDownload(id as string, 'resume'),
  'download:retry': (e, [id]) => retryDownload(id as string, e.sender),
  'print:printers': e => printers(e.sender),
  'print:execute': e => printCurrentPage(e.sender),
  'updater:check': () => checkUpdate(),
  'updater:install': () => installUpdate(),
  'hot:check': () => checkHotUpdate(),
  'hot:confirm': e => {
    const main = getMainWindow()
    if (!main || main.isDestroyed() || main.webContents.id !== e.sender.id) throw new Error('Only the main application window may confirm a renderer update')
    markRendererHealthy()
  },
  'log:write': (_e, [level, text]) => writeRendererLog(level as 'info' | 'warn' | 'error', text as string),
  'log:export': async () => {
    const result = await dialog.showSaveDialog({ title: '导出诊断日志', defaultPath: 'electron-starter.log' })
    if (result.canceled || !result.filePath) return null
    const source = log.transports.file.getFile().path
    fs.copyFileSync(source, result.filePath)
    return path.basename(result.filePath)
  },
  'protocol:scheme': () => DEEP_LINK_SCHEME,
  'protocol:pending': () => consumePendingDeepLinks()
}
/** 校验发送者为可信应用页面的顶层 Frame，阻止外部页面与 iframe 冒用权限。 */
function assertSender(e: IpcMainInvokeEvent) {
  const frame = e.senderFrame
  if (!frame || frame !== e.sender.mainFrame) throw new Error('IPC only allowed from top-level application frame')
  const u = new URL(frame.url)
  const viteURL = process.env.VITE_DEV_SERVER_URL
  if (u.protocol === 'app:' && u.host === 'renderer') return
  if (viteURL && u.origin === new URL(viteURL).origin) return
  throw new Error('IPC sender is not trusted')
}
/** 用 ipcMain.handle 建立请求/响应通道，与 Preload 的 ipcRenderer.invoke 对应。 */
export function registerIPC() {
  for (const channel of allowedChannels) {
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      assertSender(event)
      validate(channel, args)
      return handlers[channel](event, args)
    })
  }
}
