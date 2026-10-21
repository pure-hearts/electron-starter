import { platform } from '../platform'
/** 跨平台开机自启动：Windows/macOS 使用 Electron 登录项 API，Linux 写入 XDG .desktop 文件。 */
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/** XDG_CONFIG_HOME 可覆盖 Linux 默认配置目录，供测试隔离及不同桌面环境使用。 */
function linuxAutostartPath(): string {
  const home = app.getPath('home')
  const config = process.env.XDG_CONFIG_HOME || path.join(home, '.config')
  return path.join(config, 'autostart', 'electron-starter.desktop')
}
/** 生成 Linux 系统识别的启动项描述文本。 */
function linuxDesktopEntry(): string {
  const rawExecutable = app.getPath('exe')
  // 过滤换行和空字符，防止应用路径注入额外桌面配置行。
  if (!rawExecutable || /[\r\n\0]/.test(rawExecutable)) throw new Error('Invalid executable path')
  // 按 .desktop Exec 的转义规则处理路径特殊字符。
  const executable = rawExecutable
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('$', '\\$')
    .replaceAll('`', '\\`')
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Electron Starter',
    'Comment=Electron Starter autostart',
    `Exec="${executable}" --autostart`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n')
}
/** 查询当前用户的自启动状态；Linux 需要核对条目中的实际程序路径。 */
export function getAutoStart(): boolean {
  if (platform.isLinux) {
    try { return (() => {
      // 读取当前用户的 XDG autostart 文件，不修改系统级启动配置。
      const entry = fs.readFileSync(linuxAutostartPath(), 'utf8')
      return entry.split(/\r?\n/).includes('Name=Electron Starter') &&
        entry.split(/\r?\n/).includes(linuxDesktopEntry().split('\n').find(line => line.startsWith('Exec='))!)
    })() }
    catch { return false }
  }
  // 在 Windows/macOS 中读取操作系统登记的登录启动项。
  return app.getLoginItemSettings().openAtLogin
}
/** 修改开机自启动；返回实际读取到的状态，供渲染页面同步显示。 */
export function setAutoStart(enabled: boolean): boolean {
  if (platform.isLinux) {
    // Linux 开发环境无法代表安装包路径，因此限制仅打包应用启用此功能。
    if (!app.isPackaged) throw new Error('Linux autostart must be configured in an installed application')
    const location = linuxAutostartPath()
    if (enabled) {
      fs.mkdirSync(path.dirname(location), { recursive: true })
      // 写入用户级 .desktop 配置，并设置普通读取权限。
      fs.writeFileSync(location, linuxDesktopEntry(), { mode: 0o644 })
    // 仅当文件确实属于当前应用时才删除，避免清理其他程序的启动项。
    } else if (getAutoStart()) {
      fs.rmSync(location, { force: true })
    }
    return getAutoStart()
  }
  // Electron 调用系统原生接口设置 Windows/macOS 登录时启动。
  app.setLoginItemSettings({ openAtLogin: enabled })
  return getAutoStart()
}
