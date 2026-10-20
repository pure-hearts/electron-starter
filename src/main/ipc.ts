import { ipcMain, app, dialog } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { IpcMainInvokeEvent } from 'electron'
import type { InvokeChannel, SettingKey } from '../shared/ipc'
import { allowedChannels, validate } from '../shared/validation'
import { windowAction, openChild } from './window'
import { getSetting, setSetting, deleteSetting } from './modules/store'
import { getAutoStart, setAutoStart } from './modules/startup'
import { notify } from './modules/notification'
import { startDownload, controlDownload } from './modules/download'
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
  'print:printers': e => printers(e.sender),
  'print:execute': e => printCurrentPage(e.sender),
  'updater:check': () => checkUpdate(),
  'updater:install': () => installUpdate(),
  'hot:check': () => checkHotUpdate(),
  'hot:confirm': () => markRendererHealthy(),
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
function assertSender(e: IpcMainInvokeEvent) {
  const frame = e.senderFrame
  if (!frame || frame !== e.sender.mainFrame) throw new Error('IPC only allowed from top-level application frame')
  const u = new URL(frame.url)
  const viteURL = process.env.VITE_DEV_SERVER_URL
  if (u.protocol === 'app:' && u.host === 'renderer') return
  if (viteURL && u.origin === new URL(viteURL).origin) return
  throw new Error('IPC sender is not trusted')
}
export function registerIPC() {
  for (const channel of allowedChannels) {
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      assertSender(event)
      validate(channel, args)
      return handlers[channel](event, args)
    })
  }
}
