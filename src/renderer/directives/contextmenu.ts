/**
 * @file contextmenu.ts
 * @description Vue 自定义指令 v-contextmenu：
 * 为特定组件或 DOM 节点声明式绑定右键菜单项及动作。
 *
 * 使用示例:
 * <div v-contextmenu="[
 *   { label: '刷新列表', action: () => refresh() },
 *   { type: 'separator' },
 *   { label: '查看详情', action: () => openDetail() }
 * ]">...</div>
 */

import type { DirectiveBinding, ObjectDirective } from "vue";
import type { ContextMenuItem } from "@shared/ipc";
import {
  registerContextMenuAction,
  unregisterContextMenuAction,
  showContextMenu,
} from "../utils/context-menu";

export interface ContextMenuDirectiveItem extends Omit<ContextMenuItem, "id"> {
  id?: string;
  action?: () => void;
}

declare module "vue" {
  export interface GlobalDirectives {
    vContextmenu: ObjectDirective<HTMLElement, ContextMenuDirectiveItem[]>;
  }
}

interface ContextMenuElementData {
  handler: (e: MouseEvent) => void;
  registeredIds: string[];
}

const elementDataMap = new WeakMap<HTMLElement, ContextMenuElementData>();

export const vContextmenu: ObjectDirective<HTMLElement, ContextMenuDirectiveItem[]> = {
  mounted(el: HTMLElement, binding: DirectiveBinding<ContextMenuDirectiveItem[]>) {
    const registeredIds: string[] = [];

    const handler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rawItems = binding.value || [];
      const ipcItems: ContextMenuItem[] = [];

      // 清理旧的回调绑定
      for (const oldId of registeredIds) {
        unregisterContextMenuAction(oldId);
      }
      registeredIds.length = 0;

      // 注册新的菜单项与回调
      for (let i = 0; i < rawItems.length; i++) {
        const item = rawItems[i];
        if (item.type === "separator") {
          ipcItems.push({ type: "separator" });
          continue;
        }

        const actionId = item.id || `custom-ctx-${Date.now()}-${i}`;
        if (item.action) {
          registerContextMenuAction(actionId, item.action);
          registeredIds.push(actionId);
        }

        ipcItems.push({
          id: actionId,
          label: item.label,
          type: item.type || "normal",
          checked: item.checked,
          enabled: item.enabled ?? true,
        });
      }

      void showContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: ipcItems,
      });
    };

    elementDataMap.set(el, { handler, registeredIds });
    el.addEventListener("contextmenu", handler);
  },

  unmounted(el: HTMLElement) {
    const data = elementDataMap.get(el);
    if (data) {
      el.removeEventListener("contextmenu", data.handler);
      for (const id of data.registeredIds) {
        unregisterContextMenuAction(id);
      }
      elementDataMap.delete(el);
    }
  },
};
