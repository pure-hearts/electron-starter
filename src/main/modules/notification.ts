import { Notification } from 'electron'
import { broadcast, focusMainWindow } from '../window'
export function notify(title: string, body: string) {
  if (!Notification.isSupported()) throw new Error('Notifications are not supported by this OS')
  const n = new Notification({ title, body })
  n.on('click', () => { focusMainWindow(); broadcast('notification:clicked', title) })
  n.show()
}
