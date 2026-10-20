import type { SettingKey } from '../../shared/ipc'
export type SettingsValues = Record<SettingKey, string | boolean>
export interface SettingsState extends SettingsValues { schemaVersion: number }
export const CURRENT_SETTINGS_VERSION = 1
export const settingsDefaults: SettingsState = {
  schemaVersion: CURRENT_SETTINGS_VERSION,
  theme: 'light',
  locale: 'zh-CN',
  closeToTray: true,
  windowBounds: ''
}
export function normalizeWindowBounds(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 512) return ''
  try {
    const rect: unknown = JSON.parse(value)
    if (!rect || typeof rect !== 'object') return ''
    const b = rect as Record<string, unknown>
    for (const key of ['x', 'y', 'width', 'height']) {
      if (typeof b[key] !== 'number' || !Number.isFinite(b[key])) return ''
    }
    if ((b.width as number) < 820 || (b.width as number) > 10000 ||
        (b.height as number) < 540 || (b.height as number) > 10000 ||
        Math.abs(b.x as number) > 100000 || Math.abs(b.y as number) > 100000) return ''
    return JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height })
  } catch { return '' }
}
/** Upgrade untrusted, potentially outdated settings to the current schema. */
export function migrateSettings(source: unknown): SettingsState {
  const raw = source && typeof source === 'object' && !Array.isArray(source)
    ? source as Record<string, unknown> : {}
  return {
    schemaVersion: CURRENT_SETTINGS_VERSION,
    theme: raw.theme === 'dark' || raw.theme === 'system' ? raw.theme : 'light',
    locale: raw.locale === 'en-US' ? 'en-US' : 'zh-CN',
    closeToTray: typeof raw.closeToTray === 'boolean' ? raw.closeToTray : true,
    windowBounds: normalizeWindowBounds(raw.windowBounds)
  }
}
export function settingsNeedMigration(source: unknown): boolean {
  const normalized = migrateSettings(source)
  if (!source || typeof source !== 'object' || Array.isArray(source)) return true
  const raw = source as Record<string, unknown>
  return Object.entries(normalized).some(([key, value]) => raw[key] !== value)
}
