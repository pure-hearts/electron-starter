import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

/**
 * 在 macOS 上，Electron 42+ 使用 UNNotification (UserNotifications 框架)，
 * 严格要求二进制文件具有有效的代码签名。
 * 开发环境下使用 Ad-hoc 签名签署 local Electron.app，避免通知被系统拦截 (UNErrorDomain 错误 1)。
 */
if (process.platform === 'darwin') {
  const electronAppPath = path.resolve('node_modules/electron/dist/Electron.app')
  if (fs.existsSync(electronAppPath)) {
    try {
      execSync(`codesign --force --deep --sign - "${electronAppPath}"`, { stdio: 'ignore' })
      console.log('[prepare-macos-dev] Ad-hoc codesigned Electron.app for macOS notifications.')
    } catch (error) {
      console.warn('[prepare-macos-dev] Warning: Failed to codesign Electron.app:', error)
    }
  }
}
