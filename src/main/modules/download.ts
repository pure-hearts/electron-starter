/** Electron DownloadItem 管理：统一处理下载启动、进度、暂停/继续、取消和失败重试。 */
import { app, session } from 'electron'
import path from 'node:path'
import crypto from 'node:crypto'
import Store from 'electron-store'
import type { DownloadItem, WebContents } from 'electron'
import { broadcast } from '../window'
import { safeUrl } from '../../shared/validation'
import { DownloadQueue } from './download-queue'
import { DownloadTerminalRegistry } from './download-terminal'
import { log } from './logger'

// 正在下载的任务表：任务 ID 对应 Electron DownloadItem 实例。
const tasks = new Map<string, DownloadItem>()
// 终态去重：超时、取消、安全校验失败及 Electron done 可能竞态发生。
const terminals = new DownloadTerminalRegistry()
// 记录下载启动超时计时器，防止 will-download 事件未到导致永久等待。
const starting = new Map<string, ReturnType<typeof setTimeout>>()
// 标记已取消任务，避免后到的异步事件错误更新任务状态。
const cancelled = new Set<string>()
// 保留失败任务的原下载地址，让用户可以通过任务 ID 重新发起下载。
const failedUrls = new Map<string, string>()
/** 限制失败记录容量，避免长期运行不断增加内存占用。 */
function rememberFailure(id: string, url: string): void {
  failedUrls.set(id, url)
  if (failedUrls.size > 50) {
    const oldest = failedUrls.keys().next().value
    if (oldest !== undefined) failedUrls.delete(oldest)
  }
}
const queue = new DownloadQueue((task, error) => {
  fail(task.id, task.url, 'Unable to start: ' + String(error))
})
// 下载专属配置使用独立持久化文件，避免影响既有用户偏好的迁移结构。
let downloadSettings: Store<{ concurrency: number }> | null = null
function currentDownloadSettings(): Store<{ concurrency: number }> {
  downloadSettings ??= new Store<{ concurrency: number }>({
    name: 'download-settings', defaults: { concurrency: 10 }, clearInvalidConfig: true
  })
  return downloadSettings
}
/** 读取并校正可能被手动修改的配置文件。 */
export function getDownloadConcurrency(): number {
  const value: unknown = currentDownloadSettings().get('concurrency')
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 50 ? value : 10
}
/** 更新运行中队列并保存配置，重新启动应用后仍然有效。 */
export function setDownloadConcurrency(value: number): number {
  queue.setConcurrency(value)
  currentDownloadSettings().set('concurrency', value)
  return value
}
let initialized = false

function clearStarting(id: string): void {
  const timer = starting.get(id)
  if (timer) clearTimeout(timer)
  starting.delete(id)
}
function fail(id: string, url: string, error: string): void {
  if (!terminals.finish(id)) return
  log.warn('Download failed:', error)
  rememberFailure(id, url)
  clearStarting(id)
  tasks.delete(id)
  cancelled.delete(id)
  broadcast('download:state', { id, url, state: 'failed', error })
  queue.finish(id)
}
/** 注册 Electron 会话级 will-download 事件，将真实下载项关联到队列任务。 */
export function initDownloads(): void {
  if (initialized) return
  initialized = true
  // 应用 ready 后加载配置，首次创建队列之前完成并发上限恢复。
  queue.setConcurrency(getDownloadConcurrency())
  session.defaultSession.on('will-download', (_event, item) => {
    const chain = item.getURLChain()
    const initial = chain[0] ?? item.getURL()
    const id = queue.claim(initial)
    if (!id) { item.cancel(); return }
    clearStarting(id)
    if (cancelled.delete(id)) {
      const firstTerminal = terminals.finish(id)
      item.cancel()
      if (firstTerminal) broadcast('download:state', { id, url: initial, state: 'cancelled' })
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
      // 任务已经失败或取消后，迟到的进度事件不能覆盖最终状态。
      if (terminals.has(id)) return
      try {
        for (const address of item.getURLChain()) safeUrl(address)
      } catch {
        item.cancel()
        fail(id, initial, 'Download redirected to a disallowed URL')
        return
      }
      const total = item.getTotalBytes()
      if (state === 'interrupted') {
        // interrupted 不一定意味着任务终止；等待 done 决定最终状态。
        log.warn('Download interrupted; awaiting final completion event', id)
      } else {
        broadcast('download:state', {
          id, url: initial, state: item.isPaused() ? 'paused' : 'progress',
          percent: total > 0 ? Math.min(100, Math.round(item.getReceivedBytes() / total * 100)) : undefined
        })
      }
    })
    item.once('done', (_event, state) => {
      // done may occur after cancellation or an earlier security failure.
      if (tasks.get(id) !== item || !terminals.finish(id)) return
      tasks.delete(id)
      cancelled.delete(id)
      if (state !== 'completed' && state !== 'cancelled') rememberFailure(id, initial)
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
/** 生成下载任务 ID，排队并通知页面状态。 */
export function startDownload(url: string, sender: WebContents): string {
  const href = safeUrl(url).toString()
  const id = crypto.randomUUID()
  // queued state is emitted before starting the task.
  broadcast('download:state', { id, url: href, state: 'queued' })
  queue.enqueue({ id, url: href, begin: () => {
    if (sender.isDestroyed()) throw new Error('Requesting window was closed')
    // 取消与启动超时竞态：用户取消的任务不得被迟到的超时回调重新标记失败。
    const timer = setTimeout(() => {
      if (cancelled.delete(id)) {
        clearStarting(id)
        if (terminals.finish(id)) broadcast('download:state', { id, url: href, state: 'cancelled' })
        queue.finish(id)
        return
      }
      fail(id, href, 'Download did not start within 20 seconds')
    }, 20_000)
    starting.set(id, timer)
    sender.downloadURL(href)
    // 同步下载事件可能已完成；不能让 started 覆盖终态。
    if (!terminals.has(id)) broadcast('download:state', { id, url: href, state: 'started' })
  } })
  return id
}
/** 根据任务 ID 控制暂停、恢复和取消，防止操作错误任务。 */
export function controlDownload(id: string, action: 'cancel' | 'pause' | 'resume'): void {
  if (action === 'cancel') {
    const queued = queue.cancelQueued(id)
    if (queued) {
      if (terminals.finish(id)) broadcast('download:state', { id, url: queued.url, state: 'cancelled' })
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

/** 使用失败任务原 URL 创建新任务，而不是复用已结束的 DownloadItem。 */
export function retryDownload(failedId: string, sender: WebContents): string {
  const url = failedUrls.get(failedId)
  if (!url) throw new Error('Download was not failed or the retry record expired')
  const newId = startDownload(url, sender)
  failedUrls.delete(failedId)
  return newId
}
