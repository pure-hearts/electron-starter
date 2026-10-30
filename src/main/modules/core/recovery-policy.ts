/** 崩溃恢复限流策略：在指定时间窗口内限制最多允许重载的次数。 */
/** Bounded recovery attempts to avoid reloading a repeatedly crashing renderer. */
export class RecoveryPolicy {
  // 记录各次恢复尝试的时间戳，用于计算时间窗口内的频率。
  private timestamps: number[] = [];
  // 默认 60 秒最多两次，参数可被单元测试覆盖。
  constructor(
    private readonly maxAttempts = 2,
    private readonly windowMs = 60_000,
  ) {}
  /** 判断本次是否还能恢复；注入 now 便于写不依赖真实时钟的测试。 */
  canRecover(now = Date.now()): boolean {
    // 只保留最近 windowMs 毫秒内的记录，旧尝试不会永久限制恢复。
    this.timestamps = this.timestamps.filter((time) => time >= now - this.windowMs);
    // 达到上限则拒绝继续恢复，避免渲染进程反复崩溃重启。
    if (this.timestamps.length >= this.maxAttempts) return false;
    // 允许恢复时立即记录尝试，而不是等恢复成功后才计数。
    this.timestamps.push(now);
    return true;
  }
}
