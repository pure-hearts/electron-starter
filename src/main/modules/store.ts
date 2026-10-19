import Store from 'electron-store'
import type { SettingKey } from '../../shared/ipc'
const defaults: Record<SettingKey, string | boolean> = {
  theme: 'light', locale: 'zh-CN', closeToTray: true, windowBounds: ''
}
let store: Store | null = null
function currentStore() { return store ??= new Store({ name: 'settings', defaults }) }
export function getSetting(key: SettingKey): string | boolean | null {
  const value = currentStore().get(key)
  return typeof value === 'string' || typeof value === 'boolean' ? value : null
}
export function setSetting(key: SettingKey, value: string | boolean): void { currentStore().set(key, value) }
export function deleteSetting(key: SettingKey): void { currentStore().delete(key) }
