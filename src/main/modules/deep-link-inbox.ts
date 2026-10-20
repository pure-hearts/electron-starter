/** Buffer protocol URLs until the first renderer has subscribed to events. */
export class DeepLinkInbox {
  private pending: string[] = []
  constructor(private readonly scheme: string, private readonly limit = 10) {}
  accept(value: unknown): string | null {
    if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return null
    try {
      const url = new URL(value)
      if (url.protocol !== this.scheme + ':' || url.username || url.password) return null
      const normalized = url.toString()
      if (this.pending.length === this.limit) this.pending.shift()
      this.pending.push(normalized)
      return normalized
    } catch { return null }
  }
  drain(): string[] { return this.pending.splice(0) }
  get length(): number { return this.pending.length }
}
