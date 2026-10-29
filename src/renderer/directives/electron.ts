/**
 * @file electron.ts
 * @description 跨端 Vue 全局自定义指令：
 * 1. v-if-electron: 仅在 Electron 桌面端环境下渲染展示，Web 端自动移除/隐藏；
 * 2. v-disabled-electron: 在非 Electron 纯 Web 端环境下自动将组件或元素置灰禁用，并注入悬停提示。
 */

import type { App, DirectiveBinding } from "vue";
import { isElectron } from "../bridge/platform";

/**
 * v-if-electron 指令实现
 */
export const vIfElectron = {
  mounted(el: HTMLElement) {
    if (!isElectron) {
      el.style.display = "none";
      el.setAttribute("aria-hidden", "true");
    }
  },
};

/**
 * v-disabled-electron 指令实现
 */
export const vDisabledElectron = {
  mounted(el: HTMLElement, binding: DirectiveBinding<string | undefined>) {
    if (!isElectron) {
      el.setAttribute("disabled", "true");
      el.classList.add("is-disabled");
      const tooltip = binding.value || "此功能为 Electron 桌面端专属，Web 端暂不可用";
      el.setAttribute("title", tooltip);

      // 阻止鼠标点击事件向下派发
      el.style.pointerEvents = "auto";
      el.style.cursor = "not-allowed";
      el.addEventListener(
        "click",
        (event) => {
          event.stopPropagation();
          event.preventDefault();
        },
        true,
      );
    }
  },
};

/**
 * 注册所有跨端指令
 */
export function registerElectronDirectives(app: App): void {
  app.directive("if-electron", vIfElectron);
  app.directive("disabled-electron", vDisabledElectron);
}
