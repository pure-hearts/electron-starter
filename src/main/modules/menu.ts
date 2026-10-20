import { Menu } from 'electron'
import { focusMainWindow } from '../window'
import { requestQuit } from './lifecycle'
export function createMenu() {
  const mac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(mac ? [{ role: 'appMenu' as const }] : []),
    { label: '文件', submenu: [
      { label: '打开主窗口', accelerator: 'CmdOrCtrl+Shift+O', click: focusMainWindow },
      { type: 'separator' },
      mac ? { role: 'close' } : { label: '退出', accelerator: 'CmdOrCtrl+Q', click: requestQuit }
    ] },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
