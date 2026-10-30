/**
 * 下载速率与剩余时间 (ETA) 估算器。
 * 采用指数移动平均 (EMA, Exponential Moving Average) 算法平滑瞬时网络波动，输出稳定的传输速率与耗时预估。
 */
export class SpeedTracker {
  private lastTime = 0;
  private lastBytes = 0;
  private smoothSpeed = 0;

  constructor(
    private readonly alpha = 0.3,
    private readonly minSampleIntervalMs = 200,
  ) {}

  /**
   * 记录新的字节量并返回平滑速率 (bytes/s) 与预计剩余秒数 (eta)。
   */
  update(
    receivedBytes: number,
    totalBytes: number,
    now: number = Date.now(),
  ): { speed: number; eta?: number } {
    if (this.lastTime === 0) {
      this.lastTime = now;
      this.lastBytes = receivedBytes;
      return { speed: 0, eta: undefined };
    }

    const elapsedMs = now - this.lastTime;
    if (elapsedMs < this.minSampleIntervalMs) {
      const eta = this.calculateEta(receivedBytes, totalBytes, this.smoothSpeed);
      return { speed: Math.round(this.smoothSpeed), eta };
    }

    const deltaBytes = Math.max(0, receivedBytes - this.lastBytes);
    const instantSpeed = (deltaBytes / elapsedMs) * 1000;

    if (this.smoothSpeed === 0) {
      this.smoothSpeed = instantSpeed;
    } else {
      this.smoothSpeed = this.alpha * instantSpeed + (1 - this.alpha) * this.smoothSpeed;
    }

    this.lastTime = now;
    this.lastBytes = receivedBytes;

    const roundedSpeed = Math.round(this.smoothSpeed);
    const eta = this.calculateEta(receivedBytes, totalBytes, roundedSpeed);

    return { speed: roundedSpeed, eta };
  }

  private calculateEta(
    receivedBytes: number,
    totalBytes: number,
    speed: number,
  ): number | undefined {
    if (speed <= 0 || !Number.isFinite(totalBytes) || totalBytes <= receivedBytes) {
      return undefined;
    }
    const remainingBytes = totalBytes - receivedBytes;
    return Math.max(1, Math.ceil(remainingBytes / speed));
  }

  reset(): void {
    this.lastTime = 0;
    this.lastBytes = 0;
    this.smoothSpeed = 0;
  }
}
