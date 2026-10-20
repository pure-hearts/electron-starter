import Store from 'electron-store'
import type { SettingKey } from '../../shared/ipc'
import { migrateSettings, settingsDefaults, settingsNeedMigration } from './settings-schema'
import type { SettingsState } from './settings-schema'

let store: Store<SettingsState> | null = null
function currentStore(): Store<SettingsState> {
  if (store) return store
  // A corrupted JSON file must never prevent the desktop app from starting.
  const created = new Store<SettingsState>({
    name: 'settings', defaults: settingsDefaults, clearInvalidConfig: true
  })
  const old: unknown = created.store
  if (settingsNeedMigration(old)) created.store = migrateSettings(old)
  store = created
  return created
}
export function getSetting(key: SettingKey): string | boolean | null {
  const value = currentStore().get(key)
  return typeof value === 'string' || typeof value === 'boolean' ? value : null
}
export function setSetting(key: SettingKey, value: string | boolean): void {
  currentStore().set(key, value)
}
export function deleteSetting(key: SettingKey): void { currentStore().delete(key) }
