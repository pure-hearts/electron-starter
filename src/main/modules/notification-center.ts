/** 系统通知状态管理，依赖注入原生适配器以便不启动 Electron 也能测试。 */
import { randomUUID } from 'node:crypto'
import type { NotificationOptions, NotificationReceipt, NotificationActivation, NotificationSettled } from '../../shared/notification'

export interface NativeNotice {
  show(): void
  close(): void
  on(event: 'click' | 'close' | 'failed', handler: () => void): void
  removeListener?(event: 'click' | 'close' | 'failed', handler: () => void): void
}
export interface NotificationAdapter {
  supported(): boolean
  create(options: NotificationOptions): NativeNotice
  activated(payload: NotificationActivation, title: string): void
  settled?(payload: NotificationSettled): void
}
type Entry = { notice: NativeNotice; settle: (reason: NotificationSettled['reason']) => void }
export class NotificationCenter {
  private active = new Map<string, Entry>()
  private recent = new Map<string, number>()
  private history: number[] = []
  constructor(private readonly adapter: NotificationAdapter, private readonly now: () => number = Date.now) {}
  send(options: NotificationOptions, sourceWindowId?: number): NotificationReceipt {
    if (!this.adapter.supported()) return { id: '', accepted: false, reason: 'unsupported' }
    const time = this.now()
    // 相同业务标识在 3 秒内不重复弹出；定期删除过期项避免内存增长。
    for (const [key, at] of this.recent) if (time - at >= 3000) this.recent.delete(key)
    if (options.dedupeKey && this.recent.has(options.dedupeKey))
      return { id: '', accepted: false, reason: 'duplicate' }
    // 限制每 10 秒最多 10 次通知，避免意外循环轰炸系统通知中心。
    this.history = this.history.filter(at => time - at < 10000)
    if (this.history.length >= 10) return { id: '', accepted: false, reason: 'rate-limited' }
    const id = randomUUID()
    const notice = this.adapter.create(options)
    const kind = options.kind ?? 'info'
    // 不同平台可能重复发送 close/failed，必须最多分发一次终态。
    let settled = false
    const settle = (reason: NotificationSettled['reason']) => {
      if (settled) return
      settled = true
      this.active.delete(id)
      notice.removeListener?.('click', onClick)
      notice.removeListener?.('close', onClose)
      notice.removeListener?.('failed', onFailed)
      this.adapter.settled?.({ id, reason })
    }
    // 终态到达后忽略迟到点击，避免旧通知错误唤醒窗口。
    const onClick = () => {
      if (settled) return
      this.adapter.activated({ id, kind, action: options.action, sourceWindowId }, options.title)
    }
    const onClose = () => settle('closed')
    const onFailed = () => settle('failed')
    notice.on('click', onClick)
    notice.on('close', onClose)
    notice.on('failed', onFailed)
    // show 抛异常时不计入成功数，也不保留失败记录。
    try { notice.show() }
    catch (error) {
      // show 可能同步抛错；仍然向 Renderer 发出失败终态并释放对象。
      settle('failed')
      throw error
    }
    if (!settled) this.active.set(id, { notice, settle })
    this.history.push(time)
    if (options.dedupeKey) this.recent.set(options.dedupeKey, time)
    return { id, accepted: true }
  }
  close(id: string): boolean {
    const entry = this.active.get(id)
    if (!entry) return false
    this.active.delete(id)
    try { entry.notice.close() }
    finally { entry.settle('closed') }
    return true
  }
  /** 逐个关闭，即使某个平台关闭失败也继续释放其他通知。 */
  dispose(): void {
    const failures: unknown[] = []
    for (const id of [...this.active.keys()]) {
      try { this.close(id) } catch (error) { failures.push(error) }
    }
    this.recent.clear()
    this.history = []
    if (failures.length) throw new AggregateError(failures, 'Notification cleanup failed')
  }
  get activeCount(): number { return this.active.size }
}
