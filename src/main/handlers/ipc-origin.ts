/** 不依赖 Electron 的可信顶层页面来源规则，便于安全单测。 */
export function isTrustedIpcOrigin(frameURL: string, viteURL?: string): boolean {
  try {
    const u = new URL(frameURL)
    if (u.protocol === 'app:' && u.hostname === 'renderer' && !u.username && !u.password) return true
    if (!viteURL) return false
    const dev = new URL(viteURL)
    if (!['http:', 'https:'].includes(dev.protocol)) return false
    if (!['localhost', '127.0.0.1', '[::1]'].includes(dev.hostname)) return false
    return u.origin === dev.origin && !u.username && !u.password
  } catch { return false }
}
