/**
 * @file context-menu.ts
 * @description 主进程原生右键上下文菜单模块：
 * 根据渲染层光标位置、编辑状态、选中文本与自定义菜单项，构建原生 Menu 并弹出展示。
 */

import { Menu, BrowserWindow, type MenuItemConstructorOptions } from "electron";
import type { ContextMenuOptions } from "../../../shared/ipc";
import { log } from "../core/logger";

/**
 * 构建并弹出原生上下文菜单
 */
export function popupContextMenu(win: BrowserWindow, options: ContextMenuOptions = {}): void {
  if (!win || win.isDestroyed()) return;

  const template: MenuItemConstructorOptions[] = [];

  // 1. 自定义业务菜单项
  if (options.items && options.items.length > 0) {
    for (const item of options.items) {
      if (item.type === "separator") {
        template.push({ type: "separator" });
      } else {
        template.push({
          id: item.id,
          label: item.label,
          type: item.type || "normal",
          checked: item.checked,
          enabled: item.enabled ?? true,
          click: () => {
            if (item.id && !win.isDestroyed() && !win.webContents.isDestroyed()) {
              win.webContents.send("context-menu:action", { id: item.id });
            }
          },
        });
      }
    }
    // 若后续还有内置菜单项，添加分割线
    template.push({ type: "separator" });
  }

  // 2. 可编辑区域原生菜单（输入框、文本域）
  if (options.isEditable) {
    template.push(
      { role: "undo", label: "撤销" },
      { role: "redo", label: "重做" },
      { type: "separator" },
      { role: "cut", label: "剪切" },
      { role: "copy", label: "复制" },
      { role: "paste", label: "粘贴" },
      { type: "separator" },
      { role: "selectAll", label: "全选" },
    );
  } else if (options.hasSelection) {
    // 3. 非可编辑区域但存在选中文本
    template.push({ role: "copy", label: "复制" }, { role: "selectAll", label: "全选" });
  }

  // 4. 开发环境选项（检查元素与强制刷新）
  const isDev =
    process.env.NODE_ENV === "development" ||
    process.env.VITE_APP_ENV === "development" ||
    Boolean(process.env.VITE_DEV_SERVER_URL);

  if (isDev) {
    if (template.length > 0) {
      template.push({ type: "separator" });
    }
    template.push(
      {
        label: "重新加载页面",
        role: "reload",
      },
      {
        label: "检查元素",
        click: () => {
          try {
            if (typeof options.x === "number" && typeof options.y === "number") {
              win.webContents.inspectElement(Math.round(options.x), Math.round(options.y));
            } else {
              win.webContents.openDevTools({ mode: "detach" });
            }
          } catch (err) {
            log.warn("Inspect element failed", err);
          }
        },
      },
    );
  }

  // 若无任何有效菜单项，则无需弹出
  if (template.length === 0) return;

  const menu = Menu.buildFromTemplate(template);
  const popupOpts: Electron.PopupOptions = { window: win };

  if (typeof options.x === "number" && typeof options.y === "number") {
    popupOpts.x = Math.round(options.x);
    popupOpts.y = Math.round(options.y);
  }

  menu.popup(popupOpts);
}
