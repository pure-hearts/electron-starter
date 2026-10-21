/** 通知、打印、诊断日志和 Deep Link 等桌面服务。 */
import { Notification, dialog } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { NotificationOptions } from '../../shared/notification'
import { notify, notificationCenter } from '../modules/notification'
import { printers, printCurrentPage } from '../modules/print'
import { log, writeRendererLog } from '../modules/logger'
import { DEEP_LINK_SCHEME, consumePendingDeepLinks } from '../modules/protocol'
import type { HandlerGroup } from './types'
export const serviceHandlers = {
  'notification:capabilities': () => ({ supported: Notification.isSupported() }),
  'notification:send': (e, [options]) => notificationCenter.send(options as NotificationOptions, e.sender.id),
  'notification:close': (_e, [id]) => notificationCenter.close(id as string),
  'notification:show': (_e, [title, body]) => notify(title as string, body as string),
  'print:printers': e => printers(e.sender),
  'print:execute': e => printCurrentPage(e.sender),
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
} satisfies HandlerGroup
