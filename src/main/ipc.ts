/**
 * 主进程 IPC 路由：集中处理渲染进程通过 window.$ipcBridge.invoke 发起的请求。
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
// 所有处理器接收 Electron 的事件上下文和来自页面的参数数组。
type Handler = (event: IpcMainInvokeEvent, args: unknown[]) => unknown
// 把每个通道映射到具体主进程功能；Record 确保通道与处理函数对应。
const handlers: Record<InvokeChannel, Handler> = {
  'app:version': () => app.getVersion(),
  'app:quit': () => requestQuit(),
  'app:restart': () => requestRestart(),
  // 必须使用发起消息的 e.sender，操作调用者所属的窗口而非随意指定窗口。
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
  // 热更新确认只能由主窗口发送，避免其他页面错误确认新资源已健康。
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
  // senderFrame 表示消息来源 frame；只接受主框架，拒绝嵌入的 iframe。
  const frame = e.senderFrame
  if (!frame || frame !== e.sender.mainFrame) throw new Error('IPC only allowed from top-level application frame')
  // URL 用于检查页面是否来自受信任的 app://renderer 或开发服务器。
  const u = new URL(frame.url)
  const viteURL = process.env.VITE_DEV_SERVER_URL
  if (u.protocol === 'app:' && u.host === 'renderer') return
  if (viteURL && u.origin === new URL(viteURL).origin) return
  throw new Error('IPC sender is not trusted')
}
/** 用 ipcMain.handle 建立请求/响应通道，与 Preload 的 ipcRenderer.invoke 对应。 */
export function registerIPC() {
  for (const channel of allowedChannels) {
    // invoke 的 Promise 会收到该异步处理函数返回值或抛出的错误。
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      assertSender(event)
      // TS 类型不会校验运行时参数；因此主进程必须再次检查。
      validate(channel, args)
      // 只有两层校验全部通过，才执行可能访问操作系统的业务操作。
      return handlers[channel](event, args)
    })
  }
}
