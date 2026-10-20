/**
 * One active Electron DownloadItem at a time. The FIFO queue avoids ambiguity
 * when several tasks target the same URL (will-download has no caller ID).
 */
export type DownloadRequest = { id: string; url: string; begin: () => void }
export class DownloadQueue {
  private waiting: DownloadRequest[] = []
  private active: DownloadRequest | null = null
  constructor(private readonly onStartError: (task: DownloadRequest, error: unknown) => void) {}
  enqueue(task: DownloadRequest): boolean {
    const queued = this.active !== null
    this.waiting.push(task)
    this.pump()
    return queued
  }
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
