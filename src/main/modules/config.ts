import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
interface RuntimeConfig { appUpdateUrl: string; hotUpdateUrl: string; deepLinkScheme: string }
const empty: RuntimeConfig = { appUpdateUrl: '', hotUpdateUrl: '', deepLinkScheme: 'electron-starter' }
export function runtimeConfig(): RuntimeConfig {
  try {
    const location = app.isPackaged
      ? path.join(process.resourcesPath, 'resources', 'app-config.json')
      : path.join(process.cwd(), 'resources', 'app-config.json')
    const values: unknown = JSON.parse(fs.readFileSync(location, 'utf8'))
    if (!values || typeof values !== 'object') return empty
    const data = values as Partial<RuntimeConfig>
    return {
      appUpdateUrl: typeof data.appUpdateUrl === 'string' ? data.appUpdateUrl : '',
      hotUpdateUrl: typeof data.hotUpdateUrl === 'string' ? data.hotUpdateUrl : '',
      deepLinkScheme: 'electron-starter'
    }
  } catch { return empty }
}
