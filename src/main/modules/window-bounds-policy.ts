/** 不依赖 Electron 的窗口边界恢复策略，便于跨平台测试。 */
export interface Bounds { x: number; y: number; width: number; height: number }
/** 老配置输入视作不可信 JSON；只有有效且与工作区相交的窗口尺寸才能恢复。 */
export function safeWindowBounds(value: unknown, displays: readonly Bounds[]): Bounds | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const rect = value as Partial<Bounds>
  if (![rect.x, rect.y, rect.width, rect.height].every(n => typeof n === 'number' && Number.isFinite(n))) return null
  const { x, y, width, height } = rect as Bounds
  if (width < 820 || height < 540 || width > 10000 || height > 10000) return null
  const display = displays.find(d => x < d.x + d.width && x + width > d.x && y < d.y + d.height && y + height > d.y)
  if (!display) return null
  // 仅有一像素相交仍可能无法拖动标题栏，故将整个矩形收回对应工作区。
  // 极小显示器上保留应用最小尺寸，但保证左上角始终可操作。
  const fitWidth = Math.max(820, Math.min(width, display.width))
  const fitHeight = Math.max(540, Math.min(height, display.height))
  return {
    x: Math.max(display.x, Math.min(x, display.x + display.width - fitWidth)),
    y: Math.max(display.y, Math.min(y, display.y + display.height - fitHeight)),
    width: fitWidth, height: fitHeight
  }
}
