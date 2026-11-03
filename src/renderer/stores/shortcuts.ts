/**
 * @file shortcuts.ts
 * @description 应用全局与局部快捷键注册与状态管理 Store
 */
import { defineStore } from "pinia";
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAppStore, type ThemeMode } from "./app";
import { useDownloadStore } from "./download";
import { isMacPlatform } from "../utils/shortcut";
import { useIpcBridge } from "../bridge";

export interface ShortcutDefinition {
  id: string;
  name: string;
  category: string;
  accelerator: string;
  defaultAccelerator: string;
  when: string;
  scope: "global" | "local";
  description?: string;
}

const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: "preferences.open",
    name: "首选项: 打开偏好设置",
    category: "首选项",
    accelerator: "CommandOrControl+,",
    defaultAccelerator: "CommandOrControl+,",
    when: "应用聚焦时 (in-app)",
    scope: "local",
    description: "快速跳转到应用设置中心",
  },
  {
    id: "window.toggle",
    name: "窗口: 切换主窗口显示 / 隐藏",
    category: "窗口",
    accelerator: "CommandOrControl+Shift+X",
    defaultAccelerator: "CommandOrControl+Shift+X",
    when: "全局系统任意窗口 (global)",
    scope: "global",
    description: "在系统任何位置唤起或最小化隐藏主窗口",
  },
  {
    id: "download.drawer",
    name: "传输: 打开 / 关闭下载中心抽屉",
    category: "下载与传输",
    accelerator: "CommandOrControl+J",
    defaultAccelerator: "CommandOrControl+J",
    when: "应用聚焦时 (in-app)",
    scope: "local",
    description: "快速打开或收起全局下载传输抽屉",
  },
  {
    id: "theme.toggle",
    name: "外观: 切换亮暗颜色主题",
    category: "外观",
    accelerator: "CommandOrControl+Shift+T",
    defaultAccelerator: "CommandOrControl+Shift+T",
    when: "应用聚焦时 (in-app)",
    scope: "local",
    description: "在跟随系统、浅色与深色模式间快速切换",
  },
  {
    id: "nav.home",
    name: "导航: 快速返回应用主页",
    category: "导航",
    accelerator: "CommandOrControl+H",
    defaultAccelerator: "CommandOrControl+H",
    when: "应用聚焦时 (in-app)",
    scope: "local",
    description: "快速回到应用首页仪表盘",
  },
];

const STORAGE_KEY = "app_custom_shortcuts_v1";

export const useShortcutsStore = defineStore("shortcuts", () => {
  const bridge = useIpcBridge();
  const shortcuts = ref<ShortcutDefinition[]>(loadStoredShortcuts());
  const isListening = ref(false);
  let globalKeydownListener: ((e: KeyboardEvent) => void) | null = null;

  async function syncMainShortcuts() {
    try {
      const globalAcc = await bridge.invoke("shortcut:get");
      if (globalAcc) {
        const toggleItem = shortcuts.value.find((s) => s.id === "window.toggle");
        if (toggleItem && toggleItem.accelerator !== globalAcc) {
          toggleItem.accelerator = globalAcc;
        }
      }
    } catch {
      // Web 预览或初始化容错
    }
  }

  function loadStoredShortcuts(): ShortcutDefinition[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_SHORTCUTS.map((item) => ({ ...item }));
      const parsed = JSON.parse(raw) as Record<string, string>;
      return DEFAULT_SHORTCUTS.map((def) => ({
        ...def,
        accelerator: parsed[def.id] || def.defaultAccelerator,
      }));
    } catch {
      return DEFAULT_SHORTCUTS.map((item) => ({ ...item }));
    }
  }

  function saveShortcuts() {
    try {
      const map: Record<string, string> = {};
      for (const item of shortcuts.value) {
        map[item.id] = item.accelerator;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn("Failed to persist shortcuts", e);
    }
  }

  /**
   * 更新某项快捷键
   */
  async function updateShortcut(
    id: string,
    newAccelerator: string,
  ): Promise<{ success: boolean; error?: string }> {
    const item = shortcuts.value.find((s) => s.id === id);
    if (!item) return { success: false, error: "未找到该快捷键项" };

    // 如果是全局系统快捷键，需要经过主进程注册冲突检测
    if (item.scope === "global") {
      try {
        const res = await bridge.invoke("shortcut:register", newAccelerator);
        if (!res.success) {
          return {
            success: false,
            error: res.error || `快捷键 ${newAccelerator} 已被系统或其他程序占用`,
          };
        }
      } catch (e) {
        return { success: false, error: String(e) };
      }
    }

    item.accelerator = newAccelerator;
    saveShortcuts();
    return { success: true };
  }

  /**
   * 重置单项快捷键至默认
   */
  async function resetShortcut(id: string): Promise<{ success: boolean; error?: string }> {
    const item = shortcuts.value.find((s) => s.id === id);
    if (!item) return { success: false, error: "未找到该快捷键项" };
    return await updateShortcut(id, item.defaultAccelerator);
  }

  /**
   * 重置所有快捷键至默认
   */
  async function resetAll(): Promise<void> {
    for (const def of DEFAULT_SHORTCUTS) {
      await updateShortcut(def.id, def.defaultAccelerator);
    }
  }

  /**
   * 初始化应用内快捷键监听总线
   */
  function initKeyboardListener(router: ReturnType<typeof useRouter>) {
    if (isListening.value || typeof window === "undefined") return;
    isListening.value = true;
    void syncMainShortcuts();

    globalKeydownListener = (e: KeyboardEvent) => {
      // 当处于文本输入框、编辑区或模态弹窗内时不触发全局应用快捷键，防止打字干扰
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest(".shortcut-recorder"))
      ) {
        return;
      }

      const isMac = isMacPlatform();
      const hasCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      for (const item of shortcuts.value) {
        if (item.scope !== "local" || !item.accelerator) continue;

        // 匹配快捷键组合
        if (matchAccelerator(e, item.accelerator, isMac, hasCmdOrCtrl)) {
          e.preventDefault();
          e.stopPropagation();
          executeShortcutAction(item.id, router);
          break;
        }
      }
    };

    window.addEventListener("keydown", globalKeydownListener);
  }

  /**
   * 释放应用内快捷键监听
   */
  function disposeKeyboardListener() {
    if (globalKeydownListener && typeof window !== "undefined") {
      window.removeEventListener("keydown", globalKeydownListener);
      globalKeydownListener = null;
      isListening.value = false;
    }
  }

  function matchAccelerator(
    e: KeyboardEvent,
    accelerator: string,
    isMac: boolean,
    hasCmdOrCtrl: boolean,
  ): boolean {
    const parts = accelerator.split("+").map((p) => p.trim().toLowerCase());
    const needsCtrlOrCmd =
      parts.includes("commandorcontrol") ||
      parts.includes("cmdorctrl") ||
      (isMac ? parts.includes("command") : parts.includes("control"));
    const needsShift = parts.includes("shift");
    const needsAlt = parts.includes("alt") || parts.includes("option");

    if (needsCtrlOrCmd !== hasCmdOrCtrl) return false;
    if (needsShift !== e.shiftKey) return false;
    if (needsAlt !== e.altKey) return false;

    // 过滤出主键
    const mainKey = parts.find(
      (p) =>
        !["commandorcontrol", "cmdorctrl", "command", "control", "shift", "alt", "option"].includes(
          p,
        ),
    );
    if (!mainKey) return false;

    // 比对按键
    const key = e.key.toLowerCase();
    const code = e.code.toLowerCase();

    if (mainKey === "," && (key === "," || code === "comma")) return true;
    if (mainKey === "j" && (key === "j" || code === "keyj")) return true;
    if (mainKey === "t" && (key === "t" || code === "keyt")) return true;
    if (mainKey === "h" && (key === "h" || code === "keyh")) return true;

    return key === mainKey || code === `key${mainKey}`;
  }

  function executeShortcutAction(id: string, router: ReturnType<typeof useRouter>) {
    const appStore = useAppStore();
    const downloadStore = useDownloadStore();

    switch (id) {
      case "preferences.open":
        void router.push("/settings");
        break;
      case "download.drawer":
        downloadStore.toggleDrawer();
        break;
      case "theme.toggle": {
        const cur = appStore.theme;
        let next: ThemeMode = "system";
        if (cur === "system") next = "light";
        else if (cur === "light") next = "dark";
        else next = "system";
        void appStore.setTheme(next);
        break;
      }
      case "nav.home":
        void router.push("/");
        break;
    }
  }

  return {
    shortcuts,
    updateShortcut,
    resetShortcut,
    resetAll,
    initKeyboardListener,
    disposeKeyboardListener,
  };
});
