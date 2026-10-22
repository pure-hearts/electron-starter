/** electron-store 持久化用户偏好：首次使用时初始化，发现旧结构后迁移。 */
import Store from 'electron-store'
import { validate } from '../../../shared/validation'
import type { SettingKey } from '../../../shared/ipc'
import { migrateSettings, settingsDefaults, settingsNeedMigration } from './schema'
import type { SettingsState } from './schema'

// 延迟初始化，避免模块导入阶段过早访问 Electron 的用户数据路径。
let store: Store<SettingsState> | null = null
/** 获取唯一 Store 实例：懒加载并进行必要的数据迁移。 */
function currentStore(): Store<SettingsState> {
  // 已初始化时直接复用，避免多个实例分别写同一配置文件。
  if (store) return store
  // JSON 损坏时回退默认配置，避免用户无法启动应用。
  const created = new Store<SettingsState>({
    name: 'settings', defaults: settingsDefaults, clearInvalidConfig: true
  })
  // 已保存的数据可能来自旧版本，因此先按 unknown 对待。
  const old: unknown = created.store
  // 版本不一致或字段无效时，转换为当前可识别的安全配置结构。
  if (settingsNeedMigration(old)) created.store = migrateSettings(old)
  store = created
  return created
}
/** 读取配置，避免返回非字符串/非布尔值给页面。 */
export function getSetting(key: SettingKey): string | boolean | null {
  const value = currentStore().get(key)
  return typeof value === 'string' || typeof value === 'boolean' ? value : null
}
/** 使用同一份纯校验规则，保护非 IPC 的内部写入调用。 */
export function setSetting(key: SettingKey, value: string | boolean): void {
  validate('store:set', [key, value])
  currentStore().set(key, value)
}
/** 删除指定配置项，随后读取时恢复到 Store 预设默认值。 */
export function deleteSetting(key: SettingKey): void { currentStore().delete(key) }
