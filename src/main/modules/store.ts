import Store from 'electron-store'
import type { SettingKey } from '../../shared/ipc'
const defaults: Record<SettingKey, string | boolean> = {
  theme: 'light', locale: 'zh-CN', closeToTray: true, windowBounds: ''
}
const store = new Store({ name: 'settings', defaults })
export function getSetting(key: SettingKey): string | boolean | null {
  const value = store.get(key)
  return typeof value === 'string' || typeof value === 'boolean' ? value : null
}
export function setSetting(key: SettingKey, value: string | boolean): void { store.set(key, value) }
export function deleteSetting(key: SettingKey): void { store.delete(key) }
