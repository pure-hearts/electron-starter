/** 下载调度器：最多同时传输三个文件，但启动握手严格串行，避免同 URL 任务认领错位。 */
export type DownloadRequest = { id: string; url: string; begin: () => void }
export class DownloadQueue {
  // waiting 是等待队列；running 保存正在启动或传输的业务任务。
  private waiting: DownloadRequest[] = []
  private running = new Map<string, DownloadRequest>()
  // launching 是唯一正在等待 Electron will-download 的任务。
  private launching: DownloadRequest | null = null
  private scheduled = false
  constructor(
    private readonly onStartError: (task: DownloadRequest, error: unknown) => void,
    private readonly maxConcurrent = 3
  ) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 5)
      throw new RangeError('Download concurrency must be between 1 and 5')
  }
  /** 提交业务任务；任务运行与否由并发槽位和握手是否完成共同决定。 */
  enqueue(task: DownloadRequest): boolean {
    const queued = this.launching !== null || this.running.size >= this.maxConcurrent || this.waiting.length > 0
    this.waiting.push(task)
    this.pump()
    return queued
  }
  /** 只认领当前正在握手的 URL；完成认领后异步安排下一次启动。 */
  claim(initialURL: string): string | null {
    if (!this.launching || this.launching.url !== initialURL) return null
    const id = this.launching.id
    this.launching = null
    this.schedule()
    return id
  }
  /** 仍在等待 will-download 的任务 ID，用于处理下载开始前的取消。 */
  get activeId(): string | null { return this.launching?.id ?? null }
  cancelQueued(id: string): DownloadRequest | null {
    const index = this.waiting.findIndex(task => task.id === id)
    return index < 0 ? null : this.waiting.splice(index, 1)[0]
  }
  /** 下载结束后释放槽位，唤醒 FIFO 队列；忽略重复结束通知。 */
  finish(id: string): void {
    if (!this.running.delete(id)) return
    if (this.launching?.id === id) this.launching = null
    this.schedule()
  }
  private schedule(): void {
    if (this.scheduled) return
    this.scheduled = true
    queueMicrotask(() => {
      this.scheduled = false
      this.pump()
    })
  }
  private pump(): void {
    // 启动阶段不能并行：will-download 不提供业务 ID。
    if (this.launching || this.running.size >= this.maxConcurrent) return
    const task = this.waiting.shift()
    if (!task) return
    this.launching = task
    this.running.set(task.id, task)
    try { task.begin() }
    catch (error) {
      this.running.delete(task.id)
      this.launching = null
      this.onStartError(task, error)
      this.schedule()
    }
  }
}
