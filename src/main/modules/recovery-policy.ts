/** Bounded recovery attempts to avoid reloading a repeatedly crashing renderer. */
export class RecoveryPolicy {
  private timestamps: number[] = []
  constructor(private readonly maxAttempts = 2, private readonly windowMs = 60_000) {}
  canRecover(now = Date.now()): boolean {
    this.timestamps = this.timestamps.filter(time => time >= now - this.windowMs)
    if (this.timestamps.length >= this.maxAttempts) return false
    this.timestamps.push(now)
    return true
  }
}
