import { app, session } from 'electron'
import path from 'node:path'
import crypto from 'node:crypto'
import type { DownloadItem } from 'electron'
import { broadcast } from '../window'
import { safeUrl } from '../../shared/validation'
type Task = { id: string; item: DownloadItem }
const tasks = new Map<string, Task>()
const pending = new Map<string, string>()
export function initDownloads() {
  session.defaultSession.on('will-download', (_event, item) => {
    const url = item.getURL()
    const id = pending.get(url)
    if (!id) { item.cancel(); return }
    pending.delete(url)
    tasks.set(id, { id, item })
    const filename = path.basename(item.getFilename()) || 'download'
    const savePath = path.join(app.getPath('downloads'), id.slice(0, 8) + '-' + filename)
    item.setSavePath(savePath)
    item.on('updated', (_event, state) => {
      const total = item.getTotalBytes()
      broadcast('download:state', { id, url, state: state === 'interrupted' ? 'failed' : item.isPaused() ? 'paused' : 'progress', percent: total > 0 ? Math.round(item.getReceivedBytes()/total*100) : undefined })
    })
    item.once('done', (_event, state) => {
      tasks.delete(id)
      broadcast('download:state', { id, url, state: state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'failed', path: state === 'completed' ? savePath : undefined })
    })
  })
}
export function startDownload(url: string, sender: Electron.WebContents) {
  const href = safeUrl(url).toString()
  if (pending.has(href)) throw new Error('Download is already starting')
  const id = crypto.randomUUID()
  pending.set(href, id)
  sender.downloadURL(href)
  broadcast('download:state', { id, url: href, state: 'started' })
  return id
}
export function controlDownload(id: string, action: 'cancel'|'pause'|'resume') {
  const task = tasks.get(id)
  if (!task) throw new Error('Unknown or completed download')
  if (action === 'cancel') task.item.cancel()
  if (action === 'pause') task.item.pause()
  if (action === 'resume') task.item.resume()
}
