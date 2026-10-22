/** 统一窗口构造选项与导航安全校验纯策略。 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isTrustedWindowNavigation } from '../modules/system/window-navigation-policy'

// ESM 中没有 __dirname，需通过 import.meta.url 推算当前打包代码所在目录。
const here = path.dirname(fileURLToPath(import.meta.url))
// 打包产物中 main.js 与 preload.cjs 始终处于同一目录（dist-electron）。
export const preloadPath = path.join(here, 'preload.cjs')

/** 统一的窗口安全配置：启用隔离和沙箱，禁止页面直接访问 Node.js。 */
export function windowOptions(): Electron.BrowserWindowConstructorOptions {
  return {
    width: 1140, height: 760, minWidth: 820, minHeight: 540, show: false,
    backgroundColor: '#101827',
    webPreferences: {
      // Preload 建立 IPC 桥梁；沙箱和上下文隔离降低页面访问系统资源的风险。
      preload: preloadPath, sandbox: true, contextIsolation: true, nodeIntegration: false,
      webSecurity: true, webviewTag: false
    }
  }
}

/** 主、子窗口共享纯函数导航策略，减少策略漂移。 */
export function isInternalURL(url: string): boolean {
  return isTrustedWindowNavigation(url, { devServerUrl: process.env.VITE_DEV_SERVER_URL })
}
