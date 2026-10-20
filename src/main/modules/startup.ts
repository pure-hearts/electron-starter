import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

function linuxAutostartPath(): string {
  const home = app.getPath('home')
  const config = process.env.XDG_CONFIG_HOME || path.join(home, '.config')
  return path.join(config, 'autostart', 'electron-starter.desktop')
}
function linuxDesktopEntry(): string {
  const executable = app.getPath('exe')
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
export function getAutoStart(): boolean {
  if (process.platform === 'linux') {
    try { return fs.readFileSync(linuxAutostartPath(), 'utf8').includes('Name=Electron Starter') }
    catch { return false }
  }
  return app.getLoginItemSettings().openAtLogin
}
export function setAutoStart(enabled: boolean): boolean {
  if (process.platform === 'linux') {
    if (!app.isPackaged) throw new Error('Linux autostart must be configured in an installed application')
    const location = linuxAutostartPath()
    if (enabled) {
      fs.mkdirSync(path.dirname(location), { recursive: true })
      fs.writeFileSync(location, linuxDesktopEntry(), { mode: 0o644 })
    } else if (getAutoStart()) {
      fs.rmSync(location, { force: true })
    }
    return getAutoStart()
  }
  app.setLoginItemSettings({ openAtLogin: enabled })
  return getAutoStart()
}
