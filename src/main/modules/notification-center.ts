/** 系统通知状态管理，依赖注入原生适配器以便不启动 Electron 也能测试。 */
import { randomUUID } from 'node:crypto'
import type { NotificationOptions, NotificationReceipt, NotificationActivation } from '../../shared/notification'

export interface NativeNotice {
  show(): void
  close(): void
  on(event: 'click' | 'close' | 'failed', handler: () => void): void
}
export interface NotificationAdapter {
  supported(): boolean
  create(options: NotificationOptions): NativeNotice
  activated(payload: NotificationActivation, title: string): void
}
type Entry = { notice: NativeNotice; dedupeKey?: string }
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
    const cleanup = () => { this.active.delete(id) }
    notice.on('click', () => this.adapter.activated({ id, kind, action: options.action, sourceWindowId }, options.title))
    notice.on('close', cleanup)
    notice.on('failed', cleanup)
    // show 抛异常时不计入成功数，也不保留失败记录。
    notice.show()
    this.active.set(id, { notice, dedupeKey: options.dedupeKey })
    this.history.push(time)
    if (options.dedupeKey) this.recent.set(options.dedupeKey, time)
    return { id, accepted: true }
  }
  close(id: string): boolean {
    const entry = this.active.get(id)
    if (!entry) return false
    this.active.delete(id)
    entry.notice.close()
    return true
  }
  get activeCount(): number { return this.active.size }
}
