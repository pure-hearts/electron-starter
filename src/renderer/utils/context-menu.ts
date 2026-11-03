/**
 * @file context-menu.ts
 * @description 渲染层右键上下文菜单调度与全局接管服务
 */

import { isElectron } from "../bridge/platform";
import { useIpcBridge } from "../bridge";
import type { ContextMenuOptions } from "@shared/ipc";

const bridge = useIpcBridge();
type ContextMenuCallback = () => void;
const actionCallbacks = new Map<string, ContextMenuCallback>();
let isListenerInitialized = false;

/**
 * 注册自定义菜单项的点击回调
 */
export function registerContextMenuAction(id: string, callback: ContextMenuCallback): void {
  actionCallbacks.set(id, callback);
}

/**
 * 移除自定义菜单项点击回调
 */
export function unregisterContextMenuAction(id: string): void {
  actionCallbacks.delete(id);
}

/**
 * 唤起原生上下文菜单
 */
export async function showContextMenu(options: ContextMenuOptions = {}): Promise<void> {
  if (!isElectron) return;
  try {
    await bridge.invoke("context-menu:show", options);
  } catch (err) {
    console.warn("Failed to show context menu:", err);
  }
}

/**
 * 全局监听初始化：接管文本输入框、文本选区与常规区域的右键事件
 */
export function initGlobalContextMenu(): void {
  if (!isElectron || isListenerInitialized || typeof window === "undefined") return;
  isListenerInitialized = true;

  // 1. 监听主进程广播的菜单项点击事件
  bridge.on("context-menu:action", (payload) => {
    if (payload?.id && actionCallbacks.has(payload.id)) {
      const cb = actionCallbacks.get(payload.id);
      cb?.();
    }
  });

  // 2. 全局捕获鼠标右键 contextmenu 事件
  window.addEventListener("contextmenu", (e: MouseEvent) => {
    // 若已被特定元素或指令阻止默认事件，则不处理
    if (e.defaultPrevented) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    // 判断目标是否为可编辑区域
    const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
    const isContentEditable =
      target.isContentEditable || Boolean(target.closest("[contenteditable='true']"));
    const isEditable = isInput || isContentEditable;

    // 检查是否有选中文本
    const selection = window.getSelection();
    const selectionText = selection ? selection.toString().trim() : "";
    const hasSelection = Boolean(selectionText);

    // 阻止浏览器默认右键行为，转为调用原生系统菜单
    e.preventDefault();

    void showContextMenu({
      x: e.clientX,
      y: e.clientY,
      isEditable,
      hasSelection,
      selectionText,
    });
  });
}
