import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

function linuxAutostartPath(): string {
  const home = app.getPath('home')
  const config = process.env.XDG_CONFIG_HOME || path.join(home, '.config')
  return path.join(config, 'autostart', 'electron-starter.desktop')
}
function linuxDesktopEntry(): string {
  const rawExecutable = app.getPath('exe')
  if (!rawExecutable || /[\r\n\0]/.test(rawExecutable)) throw new Error('Invalid executable path')
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
export function getAutoStart(): boolean {
  if (process.platform === 'linux') {
    try { return (() => {
      const entry = fs.readFileSync(linuxAutostartPath(), 'utf8')
      return entry.split(/\r?\n/).includes('Name=Electron Starter') &&
        entry.split(/\r?\n/).includes(linuxDesktopEntry().split('\n').find(line => line.startsWith('Exec='))!)
    })() }
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
