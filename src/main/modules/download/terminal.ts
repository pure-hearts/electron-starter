/** 下载终态去重器：确保每个任务仅有一个最终结果，避免迟到的 Electron 事件重复广播。 */
export class DownloadTerminalRegistry {
  private readonly completed = new Set<string>();
  private readonly order: string[] = [];
  constructor(private readonly limit = 1000) {}
  /** 返回 true 表示本次是该任务的第一个终态；false 表示重复事件，应忽略。 */
  finish(id: string): boolean {
    if (this.completed.has(id)) return false;
    this.completed.add(id);
    this.order.push(id);
    // 有界缓存既能屏蔽迟到回调，又避免长期开启应用导致集合无限增大。
    if (this.order.length > this.limit) {
      const oldest = this.order.shift();
      if (oldest !== undefined) this.completed.delete(oldest);
    }
    return true;
  }
  /** 查询是否已经完成，供 updated/done 回调防止终态后的进度回退。 */
  has(id: string): boolean {
    return this.completed.has(id);
  }
}
