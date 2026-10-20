import { app, session } from 'electron'
import path from 'node:path'
import crypto from 'node:crypto'
import type { DownloadItem, WebContents } from 'electron'
import { broadcast } from '../window'
import { safeUrl } from '../../shared/validation'
import { DownloadQueue } from './download-queue'
import { log } from './logger'

const tasks = new Map<string, DownloadItem>()
const starting = new Map<string, ReturnType<typeof setTimeout>>()
const cancelled = new Set<string>()
const queue = new DownloadQueue((task, error) => {
  fail(task.id, task.url, 'Unable to start: ' + String(error))
})
let initialized = false

function clearStarting(id: string): void {
  const timer = starting.get(id)
  if (timer) clearTimeout(timer)
  starting.delete(id)
}
function fail(id: string, url: string, error: string): void {
  clearStarting(id)
  tasks.delete(id)
  cancelled.delete(id)
  broadcast('download:state', { id, url, state: 'failed', error })
  queue.finish(id)
}
export function initDownloads(): void {
  if (initialized) return
  initialized = true
  session.defaultSession.on('will-download', (_event, item) => {
    const chain = item.getURLChain()
    const initial = chain[0] ?? item.getURL()
    const id = queue.claim(initial)
    if (!id) { item.cancel(); return }
    clearStarting(id)
    if (cancelled.delete(id)) {
      item.cancel()
      broadcast('download:state', { id, url: initial, state: 'cancelled' })
      queue.finish(id)
      return
    }
    // A redirect may change the destination before the will-download event.
    try {
      for (const address of [...chain, item.getURL()]) safeUrl(address)
    } catch {
      item.cancel()
      fail(id, initial, 'Download redirected to a disallowed URL')
      return
    }
    tasks.set(id, item)
    const filename = path.basename(item.getFilename()) || 'download'
    const destination = path.join(app.getPath('downloads'), id.slice(0, 8) + '-' + filename)
    try { item.setSavePath(destination) }
    catch (error) { item.cancel(); fail(id, initial, String(error)); return }
    item.on('updated', (_event, state) => {
      try {
        for (const address of item.getURLChain()) safeUrl(address)
      } catch {
        item.cancel()
        fail(id, initial, 'Download redirected to a disallowed URL')
        return
      }
      const total = item.getTotalBytes()
      if (state === 'interrupted') {
        broadcast('download:state', { id, url: initial, state: 'failed', error: 'Transfer interrupted' })
      } else {
        broadcast('download:state', {
          id, url: initial, state: item.isPaused() ? 'paused' : 'progress',
          percent: total > 0 ? Math.min(100, Math.round(item.getReceivedBytes() / total * 100)) : undefined
        })
      }
    })
    item.once('done', (_event, state) => {
      // done may occur after cancellation or an earlier security failure.
      if (tasks.get(id) !== item) return
      tasks.delete(id)
      cancelled.delete(id)
      broadcast('download:state', {
        id, url: initial,
        state: state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'failed',
        path: state === 'completed' ? destination : undefined,
        error: state === 'completed' ? undefined : state
      })
      queue.finish(id)
    })
  })
}
export function startDownload(url: string, sender: WebContents): string {
  const href = safeUrl(url).toString()
  const id = crypto.randomUUID()
  // queued state is emitted before starting the task.
  broadcast('download:state', { id, url: href, state: 'queued' })
  queue.enqueue({ id, url: href, begin: () => {
    if (sender.isDestroyed()) throw new Error('Requesting window was closed')
    const timer = setTimeout(() => fail(id, href, 'Download did not start within 20 seconds'), 20_000)
    starting.set(id, timer)
    sender.downloadURL(href)
    broadcast('download:state', { id, url: href, state: 'started' })
  } })
  return id
}
export function controlDownload(id: string, action: 'cancel' | 'pause' | 'resume'): void {
  if (action === 'cancel') {
    const queued = queue.cancelQueued(id)
    if (queued) {
      broadcast('download:state', { id, url: queued.url, state: 'cancelled' })
      return
    }
  }
  const item = tasks.get(id)
  if (item) {
    if (action === 'cancel') item.cancel()
    else if (action === 'pause') item.pause()
    else if (item.canResume()) item.resume()
    else throw new Error('This server does not allow download resumption')
    return
  }
  if (action === 'cancel' && queue.activeId === id) {
    cancelled.add(id)
    return
  }
  throw new Error('Unknown or completed download')
}
