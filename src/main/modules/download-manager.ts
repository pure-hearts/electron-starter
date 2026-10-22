/** 下载业务控制器：只依赖最小端口，状态、竞态与资源释放可在无 Electron 环境测试。 */
import type { DownloadState } from '../../shared/ipc'
import { safeUrl } from '../../shared/validation'
import { DownloadQueue } from './download-queue'

/** Electron 适配器只提供下载所需能力，不把整个 WebContents 暴露给业务逻辑。 */
export interface DownloadSender { isDestroyed(): boolean; downloadURL(url: string): void }
export interface NativeDownload {
  getURLChain(): string[]; getURL(): string; getFilename(): string
  setSavePath(path: string): void; getTotalBytes(): number; getReceivedBytes(): number
  isPaused(): boolean; canResume(): boolean; cancel(): void; pause(): void; resume(): void
  on(event: 'updated' | 'done', callback: (event: unknown, state: string) => void): unknown
  removeListener(event: 'updated' | 'done', callback: (event: unknown, state: string) => void): unknown
}
interface DownloadPorts {
  id(): string
  destination(id: string, filename: string): string
  emit(state: DownloadState): void
  report(error: unknown): void
}
const transitions: Record<DownloadState['state'], readonly DownloadState['state'][]> = {
  queued: ['started', 'cancelled', 'failed'],
  started: ['progress', 'paused', 'completed', 'cancelled', 'failed'],
  progress: ['progress', 'paused', 'completed', 'cancelled', 'failed'],
  paused: ['progress', 'completed', 'cancelled', 'failed'],
  completed: [], cancelled: [], failed: []
}
export class DownloadManager {
  private readonly states = new Map<string, DownloadState>()
  private readonly items = new Map<string, NativeDownload>()
  private readonly listeners = new Map<string, () => void>()
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly failures = new Map<string, string>()
  // will-download 没有业务 ID。超时后先隔离该 URL，直到迟到事件被丢弃，禁止猜测新旧请求。
  private readonly abandoned = new Set<string>()
  private disposed = false
  private readonly queue = new DownloadQueue((task, error) => {
    this.ports.report(error)
    this.finish(task.id, 'failed', '无法启动下载，请重试')
  })
  constructor(private readonly ports: DownloadPorts) {}
  setConcurrency(value: number): void { this.queue.setConcurrency(value) }
  private clearTimer(id: string): void {
    const timer = this.timers.get(id)
    if (timer !== undefined) clearTimeout(timer)
    this.timers.delete(id)
  }
  private emit(id: string, state: DownloadState['state'], extra: Partial<DownloadState> = {}): void {
    const current = this.states.get(id)
    if (!current || !transitions[current.state].includes(state)) return
    const next = { ...current, ...extra, state }
    this.states.set(id, next)
    this.ports.emit(next)
  }
  /** 所有终态共用一个出口；先撤销所有权与监听，再调用原生 cancel，抵御同步回调重入。 */
  private finish(id: string, state: 'failed' | 'completed' | 'cancelled', error?: string, destination?: string): void {
    const current = this.states.get(id)
    if (!current) return
    this.clearTimer(id)
    this.listeners.get(id)?.()
    this.listeners.delete(id)
    this.items.delete(id)
    this.states.delete(id)
    if (state === 'failed') {
      this.failures.set(id, current.url)
      const oldest = this.failures.keys().next().value
      if (this.failures.size > 50 && oldest !== undefined) this.failures.delete(oldest)
    }
    this.queue.cancelQueued(id)
    this.queue.finish(id)
    this.ports.emit({ id, url: current.url, state, error, path: destination })
  }
  private cancelItem(item: NativeDownload): void {
    try { item.cancel() } catch (error) { this.ports.report(error) }
  }
  private assertAvailable(url: string): void {
    if (this.disposed) throw new Error('下载管理器已关闭')
    // 有界隔离表达到上限后拒绝新请求，宁可要求重启，也不能遗忘旧请求而错误认领。
    if (this.abandoned.has(url) || this.abandoned.size >= 1000)
      throw new Error('旧下载请求仍在结束，请稍后重试或重启应用')
  }
  start(url: string, sender: DownloadSender): string {
    const href = safeUrl(url).toString()
    this.assertAvailable(href)
    const id = this.ports.id()
    const initial: DownloadState = { id, url: href, state: 'queued' }
    this.states.set(id, initial)
    this.ports.emit(initial)
    this.queue.enqueue({ id, url: href, begin: () => this.begin(id, href, sender) })
    return id
  }
  private begin(id: string, url: string, sender: DownloadSender): void {
    this.assertAvailable(url)
    if (sender.isDestroyed()) throw new Error('Requesting window was closed')
    this.timers.set(id, setTimeout(() => {
      this.abandoned.add(url)
      this.finish(id, 'failed', '下载启动超时，请稍后重试')
    }, 20_000))
    // 必须先广播 started：downloadURL 可以同步触发 will-download 和 progress。
    this.emit(id, 'started')
    sender.downloadURL(url)
  }
  /** 会话监听器只负责调用本方法；无匹配业务任务的原生下载一律取消。 */
  accept(item: NativeDownload): void {
    const chain = item.getURLChain()
    const url = chain[0] ?? item.getURL()
    if (this.abandoned.delete(url) || this.disposed) { this.cancelItem(item); return }
    const id = this.queue.claim(url)
    if (!id || !this.states.has(id)) { this.cancelItem(item); return }
    this.clearTimer(id)
    try {
      this.validateItem(item)
      const destination = this.ports.destination(id, item.getFilename())
      item.setSavePath(destination)
      this.items.set(id, item)
      this.listen(id, item, destination)
    } catch (error) {
      this.ports.report(error)
      this.finish(id, 'failed', '下载地址或保存位置不可用')
      this.cancelItem(item)
    }
  }
  private validateItem(item: NativeDownload): void {
    for (const address of [...item.getURLChain(), item.getURL()]) safeUrl(address)
  }
  private listen(id: string, item: NativeDownload, destination: string): void {
    const updated = (_event: unknown, state: string) => {
      if (this.items.get(id) !== item) return
      try { this.update(id, item, state) }
      catch (error) {
        this.ports.report(error)
        this.finish(id, 'failed', '下载被安全策略拒绝')
        this.cancelItem(item)
      }
    }
    const done = (_event: unknown, state: string) => {
      if (this.items.get(id) !== item) return
      // 完成时再次校验地址链，不能依赖最后一次 updated 一定到达。
      try { this.validateItem(item) }
      catch (error) {
        this.ports.report(error)
        this.finish(id, 'failed', '下载被安全策略拒绝')
        this.cancelItem(item)
        return
      }
      const final = state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'failed'
      this.finish(id, final, final === 'failed' ? '下载中断，请重试' : undefined, final === 'completed' ? destination : undefined)
    }
    this.listeners.set(id, () => {
      item.removeListener('updated', updated)
      item.removeListener('done', done)
    })
    item.on('updated', updated)
    item.on('done', done)
  }
  private update(id: string, item: NativeDownload, state: string): void {
    this.validateItem(item)
    if (state === 'interrupted') {
      // 网络中断并不保证还有 done；给恢复留出窗口，但不允许永久占据队列槽位。
      if (!this.timers.has(id)) this.timers.set(id, setTimeout(() => {
        this.finish(id, 'failed', '网络中断超时，请重试')
        this.cancelItem(item)
      }, 30_000))
      return
    }
    this.clearTimer(id)
    const total = item.getTotalBytes()
    const received = item.getReceivedBytes()
    const percent = Number.isFinite(total) && Number.isFinite(received) && total > 0
      ? Math.max(0, Math.min(100, Math.round(received / total * 100))) : undefined
    this.emit(id, item.isPaused() ? 'paused' : 'progress', { percent })
  }
  control(id: string, action: 'cancel' | 'pause' | 'resume'): void {
    const current = this.states.get(id)
    if (!current) throw new Error('Unknown or completed download')
    const item = this.items.get(id)
    if (action === 'cancel') {
      if (this.queue.activeId === id) this.abandoned.add(current.url)
      this.finish(id, 'cancelled')
      if (item) this.cancelItem(item)
      return
    }
    if (!item) throw new Error('Download has not started')
    if (action === 'pause') {
      item.pause()
      this.clearTimer(id)
      this.emit(id, 'paused')
    } else if (item.canResume()) {
      item.resume()
      this.emit(id, 'progress')
    } else throw new Error('This server does not allow download resumption')
  }
  retry(id: string, sender: DownloadSender): string {
    const url = this.failures.get(id)
    if (!url) throw new Error('Download was not failed or the retry record expired')
    const next = this.start(url, sender)
    this.failures.delete(id)
    return next
  }
  /** 退出或启动回滚时幂等清理；移除所有任务让已排队的调度微任务成为空操作。 */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const id of this.states.keys()) this.control(id, 'cancel')
    this.failures.clear()
  }
}
