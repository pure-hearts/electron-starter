/**
 * @file shortcut-module.ts
 * @description 全局快捷键管理：管理桌面级呼出/隐藏主窗口快捷键，处理冲突与生命周期释放。
 */
import { globalShortcut } from "electron";
import { getMainWindow, focusMainWindow } from "../../window";
import { getSetting, setSetting } from "../store";
import { log } from "../core/logger";

let currentAccelerator = "";

/**
 * 切换主窗口显隐状态
 */
export function toggleMainWindowVisibility(): void {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) {
    return;
  }

  if (win.isVisible() && win.isFocused()) {
    win.hide();
  } else {
    focusMainWindow();
  }
}

/**
 * 安全注册全局快捷键
 */
export function registerToggleShortcut(accelerator: string): { success: boolean; error?: string } {
  if (!accelerator || typeof accelerator !== "string") {
    return { success: false, error: "快捷键格式无效" };
  }

  const trimmed = accelerator.trim();
  if (!trimmed) {
    return { success: false, error: "快捷键不能为空" };
  }

  // 幂等保护：若新快捷键与当前生效快捷键完全一致，直接视为成功，避免重复注销引发瞬时失灵
  if (currentAccelerator === trimmed) {
    return { success: true };
  }

  // 先注销之前注册的旧快捷键
  if (currentAccelerator) {
    try {
      globalShortcut.unregister(currentAccelerator);
    } catch (e) {
      log.warn("Failed to unregister previous shortcut", e);
    }
  }

  try {
    const ok = globalShortcut.register(trimmed, () => {
      toggleMainWindowVisibility();
    });

    if (!ok) {
      // 恢复旧快捷键
      if (currentAccelerator) {
        globalShortcut.register(currentAccelerator, () => toggleMainWindowVisibility());
      }
      return { success: false, error: `快捷键 ${trimmed} 已被系统或其他程序占用` };
    }

    currentAccelerator = trimmed;
    setSetting("globalShortcutToggle", trimmed);
    log.info(`Global shortcut registered: ${trimmed}`);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "注册快捷键发生异常";
    return { success: false, error: msg };
  }
}

/**
 * 获取当前生效的全局快捷键
 */
export function getRegisteredShortcut(): string {
  if (currentAccelerator) return currentAccelerator;
  const saved = getSetting("globalShortcutToggle");
  return typeof saved === "string" && saved ? saved : "CommandOrControl+Shift+X";
}

/**
 * 初始化全局快捷键
 */
export function initGlobalShortcuts(): void {
  const target = getRegisteredShortcut();
  if (target) {
    registerToggleShortcut(target);
  }
}

/**
 * 释放全局快捷键（应用退出或重载时调用）
 */
export function disposeGlobalShortcuts(): void {
  if (currentAccelerator) {
    try {
      globalShortcut.unregister(currentAccelerator);
    } catch {
      // 忽略退出时的解绑异常
    }
    currentAccelerator = "";
  }
}
