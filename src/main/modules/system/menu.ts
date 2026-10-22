/** 应用原生菜单。与 Vue 组件菜单不同，这里使用 Electron Menu 构建操作系统菜单。 */
import { Menu } from 'electron'
import { platform } from '../../platform'
import { focusMainWindow } from '../../window'
import { requestQuit } from '../core/lifecycle'

export function createMenu() {
  // macOS 的应用菜单与 Windows/Linux 结构不同，需单独包含 appMenu。
  const mac = platform.isMac
  // MenuItemConstructorOptions 是每一项原生菜单的配置类型。
  const template: Electron.MenuItemConstructorOptions[] = [
    // 展开运算符仅在 macOS 插入系统标准应用菜单。
    ...(mac ? [{ role: 'appMenu' as const }] : []),
    { label: '文件', submenu: [
      // CmdOrCtrl 按平台自动映射为 macOS 的 Command 或 Windows/Linux 的 Ctrl。
      { label: '打开主窗口', accelerator: 'CmdOrCtrl+Shift+O', click: focusMainWindow },
      { type: 'separator' },
      mac ? { role: 'close' } : { label: '退出', accelerator: 'CmdOrCtrl+Q', click: requestQuit }
    ] },
    // role 代表 Electron 提供的标准系统菜单，包含复制、粘贴等内建行为。
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]
  // 把菜单模板转换成原生 Menu，再安装为整个应用的菜单栏。
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/** 移除应用菜单及其快捷键回调。 */
export function destroyMenu(): void { Menu.setApplicationMenu(null) }
