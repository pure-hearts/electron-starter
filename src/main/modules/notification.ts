/** 系统通知：由 Electron 主进程调用系统通知接口，不是网页内的提示框。 */
import { Notification } from 'electron'
import { broadcast, focusMainWindow } from '../window'
/** 显示标题和正文，并在用户点击通知时把事件发送回所有窗口。 */
export function notify(title: string, body: string) {
  // 部分操作系统或当前会话不支持通知，先检查以避免调用失败。
  if (!Notification.isSupported()) throw new Error('Notifications are not supported by this OS')
  // Notification 创建通知对象，尚未显示到系统通知中心。
  const n = new Notification({ title, body })
  // 点击系统通知后，聚焦主窗口并广播 IPC 事件给渲染页面。
  n.on('click', () => { focusMainWindow(); broadcast('notification:clicked', title) })
  // show() 才向操作系统请求实际展示通知；是否弹出受系统权限设置影响。
  n.show()
}
