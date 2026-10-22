/** Electron 原生通知适配器：统一持有对象，并向安全的 Renderer 桥接发送事件。 */
import { Notification, BrowserWindow } from 'electron'
import type { NotificationOptions } from '../../shared/notification'
import { broadcast, focusMainWindow } from '../window'
import { NotificationCenter } from './notification-center'
import { log } from './logger'

export const notificationCenter = new NotificationCenter({
  supported: () => Notification.isSupported(),
  create: (options: NotificationOptions) => new Notification({ title: options.title, body: options.body }),
  settled: payload => broadcast('notification:settled', payload),
  activated: (payload, title) => {
    // 兼容旧版只接收 title 的通知点击监听器。
    broadcast('notification:clicked', title)
    const target = payload.sourceWindowId === undefined ? undefined : BrowserWindow.getAllWindows().find(w => w.webContents.id === payload.sourceWindowId)
    // 原窗口仍在时聚焦，否则恢复主窗口；不主动执行传入的路由动作。
    if (target && !target.isDestroyed()) { target.show(); target.focus() }
    else focusMainWindow()
    broadcast('notification:activated', payload)
  }
})
/** 旧接口原样保留，内部接入新的通知中心。 */
export function notify(title: string, body: string): void {
  const result = notificationCenter.send({ title, body })
  if (!result.accepted && result.reason === 'unsupported')
    throw new Error('Notifications are not supported by this OS')
}

/** 业务通知属于辅助反馈；系统不支持或通知失败不能改变下载/更新的真实结果。 */
export function notifyBusiness(options: NotificationOptions): void {
  try { notificationCenter.send(options) }
  catch (error) { log.warn('Business notification failed', error) }
}
