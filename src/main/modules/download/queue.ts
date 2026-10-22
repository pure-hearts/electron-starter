/**
 * 下载调度器：默认同时传输十个文件，但启动握手严格串行，避免同 URL 任务认领错位。
 *
 * 设计约束：同一时刻只有一个任务处于 launching（等待 will-download 事件）状态。
 * claim() 认领后进入 claiming 过渡期：launching 保留直到 schedule() 的微任务才清空，
 * 防止 claim 和 schedule 之间的 enqueue/pump 绕过握手串行保护。
 */
export type DownloadRequest = { id: string; url: string; begin: () => void };
export class DownloadQueue {
  // waiting 是等待队列；running 保存正在启动或传输的业务任务。
  private waiting: DownloadRequest[] = [];
  private running = new Map<string, DownloadRequest>();
  // launching 是唯一正在等待 Electron will-download 的任务。
  private launching: DownloadRequest | null = null;
  // claiming：claim() 已调但 schedule() 微任务还未清理 launching；期间阻止新的 pump。
  private claiming = false;
  private scheduled = false;
  constructor(
    private readonly onStartError: (task: DownloadRequest, error: unknown) => void,
    private maxConcurrent = 10,
  ) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 50)
      throw new RangeError("Download concurrency must be between 1 and 50");
  }
  /** 查询当前最大并发数，供 Renderer 显示配置。 */
  get concurrency(): number {
    return this.maxConcurrent;
  }
  /** 动态修改并发上限；调高后立即调度，调低时不强行中断已启动任务。 */
  setConcurrency(value: number): void {
    if (!Number.isInteger(value) || value < 1 || value > 50)
      throw new RangeError("Download concurrency must be between 1 and 50");
    this.maxConcurrent = value;
    this.schedule();
  }
  /** 供调试与测试读取任务量，不暴露内部可变集合。 */
  get pendingCount(): number {
    return this.waiting.length;
  }
  get runningCount(): number {
    return this.running.size;
  }
  /** 提交业务任务；任务运行与否由并发槽位和握手是否完成共同决定。 */
  enqueue(task: DownloadRequest): boolean {
    // 任务 ID 必须唯一，否则 running Map 会覆盖旧任务并破坏并发计数。
    if (this.running.has(task.id) || this.waiting.some((waiting) => waiting.id === task.id))
      throw new Error("Duplicate download task ID: " + task.id);
    const queued =
      this.launching !== null ||
      this.claiming ||
      this.running.size >= this.maxConcurrent ||
      this.waiting.length > 0;
    this.waiting.push(task);
    this.pump();
    return queued;
  }
  /**
   * 只认领当前正在握手的 URL；认领成功后进入 claiming 过渡期，
   * 阻止 enqueue 同步 pump 绕过串行握手，待微任务调度后才清理 launching。
   */
  claim(initialURL: string): string | null {
    if (!this.launching || this.launching.url !== initialURL) return null;
    const id = this.launching.id;
    // 标记过渡期：launching 保留但 claiming=true，阻止 pump 在微任务执行前启动下一个。
    this.claiming = true;
    this.schedule();
    return id;
  }
  /** 仍在等待 will-download 的任务 ID，用于处理下载开始前的取消。 */
  get activeId(): string | null {
    return this.launching?.id ?? null;
  }
  cancelQueued(id: string): DownloadRequest | null {
    const index = this.waiting.findIndex((task) => task.id === id);
    if (index < 0) return null;
    const removed = this.waiting.splice(index, 1)[0];
    // 队首取消后继续唤醒调度，避免队列在可用槽位时停滞。
    this.schedule();
    return removed;
  }
  /** 下载结束后释放槽位，唤醒 FIFO 队列；忽略重复结束通知。 */
  finish(id: string): void {
    if (!this.running.delete(id)) return;
    if (this.launching?.id === id) {
      this.launching = null;
      this.claiming = false;
    }
    this.schedule();
  }
  private schedule(): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      // 微任务执行时清理 claiming 过渡期，再 pump 下一个任务。
      if (this.claiming) {
        this.launching = null;
        this.claiming = false;
      }
      this.pump();
    });
  }
  private pump(): void {
    // 启动阶段不能并行：will-download 不提供业务 ID；claiming 过渡期同样阻止 pump。
    if (this.launching || this.claiming || this.running.size >= this.maxConcurrent) return;
    const task = this.waiting.shift();
    if (!task) return;
    this.launching = task;
    this.running.set(task.id, task);
    try {
      task.begin();
    } catch (error) {
      this.running.delete(task.id);
      this.launching = null;
      try {
        this.onStartError(task, error);
      } finally {
        this.schedule();
      }
    }
  }
}
