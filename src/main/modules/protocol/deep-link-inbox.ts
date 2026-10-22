/** Deep Link 暂存队列：页面尚未订阅事件时先保存链接，防止冷启动丢失唤起参数。 */
export class DeepLinkInbox {
  // pending 保存等待交给页面的 Deep Link，默认最多缓存 10 条。
  private pending: string[] = [];
  // scheme 指应用专属 URL 协议；limit 是队列上限，避免无限累积。
  constructor(
    private readonly scheme: string,
    private readonly limit = 10,
  ) {}
  /** 验证并暂存链接；格式不合法时返回 null，不能直接信任外部程序传入的 URL。 */
  accept(value: unknown): string | null {
    // 限制输入类型和长度，阻止异常参数造成不必要的内存开销。
    if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
    try {
      // new URL 负责解析协议、主机和参数；解析失败会进入 catch。
      const url = new URL(value);
      // 只允许本站自定义协议，并拒绝包含 username/password 的链接。
      if (url.protocol !== this.scheme + ":" || url.username || url.password) return null;
      const normalized = url.toString();
      // 缓冲区已满就移除最早一条，确保新唤起信息可以进入队列。
      if (this.pending.length === this.limit) this.pending.shift();
      this.pending.push(normalized);
      return normalized;
    } catch {
      return null;
    }
  }
  /** 一次性取出并清空待处理队列，避免同一链接被反复消费。 */
  drain(): string[] {
    return this.pending.splice(0);
  }
  /** 当前尚未被页面领取的链接数量。 */
  get length(): number {
    return this.pending.length;
  }
}
