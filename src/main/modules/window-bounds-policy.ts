/** 不依赖 Electron 的窗口边界恢复策略，便于跨平台测试。 */
export interface Bounds { x: number; y: number; width: number; height: number }
/** 老配置输入视作不可信 JSON；只有有效且与工作区相交的窗口尺寸才能恢复。 */
export function safeWindowBounds(value: unknown, displays: readonly Bounds[]): Bounds | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const rect = value as Partial<Bounds>
  if (![rect.x, rect.y, rect.width, rect.height].every(n => typeof n === 'number' && Number.isFinite(n))) return null
  const { x, y, width, height } = rect as Bounds
  if (width < 820 || height < 540 || width > 10000 || height > 10000) return null
  if (!displays.some(d => x < d.x + d.width && x + width > d.x && y < d.y + d.height && y + height > d.y)) return null
  return { x, y, width, height }
}
