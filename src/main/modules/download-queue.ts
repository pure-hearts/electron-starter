/** 下载请求 FIFO 队列：Electron 的 will-download 事件不自带业务任务 ID，因此串行启动以正确关联下载任务。 */
/**
 * One active Electron DownloadItem at a time. The FIFO queue avoids ambiguity
 * when several tasks target the same URL (will-download has no caller ID).
 */
export type DownloadRequest = { id: string; url: string; begin: () => void }
export class DownloadQueue {
  // waiting 存放尚未轮到启动的任务，按进入先后顺序排列。
  private waiting: DownloadRequest[] = []
  // active 是当前占用下载槽位的任务；最多只允许一个。
  private active: DownloadRequest | null = null
  constructor(private readonly onStartError: (task: DownloadRequest, error: unknown) => void) {}
  /** 请求入队，返回是否需要等待其他任务完成。 */
  enqueue(task: DownloadRequest): boolean {
    const queued = this.active !== null
    this.waiting.push(task)
    this.pump()
    return queued
  }
  /** 匹配 Electron 的 will-download 事件与当前业务任务，返回任务 ID。 */
  claim(initialURL: string): string | null {
    return this.active?.url === initialURL ? this.active.id : null
  }
  get activeId(): string | null { return this.active?.id ?? null }
  cancelQueued(id: string): DownloadRequest | null {
    const index = this.waiting.findIndex(task => task.id === id)
    if (index < 0) return null
    return this.waiting.splice(index, 1)[0]
  }
  finish(id: string): void {
    if (this.active?.id !== id) return
    this.active = null
    this.pump()
  }
  /** 在下载槽位空闲时启动下一个等待任务。 */
  private pump(): void {
    while (!this.active && this.waiting.length) {
      const task = this.waiting.shift()!
      this.active = task
      try { task.begin() }
      catch (error) {
        this.active = null
        this.onStartError(task, error)
      }
    }
  }
}
