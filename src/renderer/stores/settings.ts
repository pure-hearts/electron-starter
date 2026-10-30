/**
 * @file settings.ts
 * @description 设置中心 Pinia 响应式状态库：管理用户设置，自动与主进程 electron-store 双向同步。
 */
import { defineStore } from "pinia";
import { ref } from "vue";
import type { UserSettings } from "@shared/ipc";
import { useAppStore } from "./app";

const defaultSettings: UserSettings = {
  theme: "light",
  locale: "zh-CN",
  closeToTray: true,
  autoStart: false,
  defaultDownloadDir: "",
  downloadConcurrency: 10,
  autoResumeDownloads: true,
  notificationsEnabled: true,
  notificationSound: true,
  notifyOnDownload: true,
  notifyOnUpdate: true,
  globalShortcutToggle: "CommandOrControl+Shift+X",
};

export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<UserSettings>({ ...defaultSettings });
  const loaded = ref(false);
  const saving = ref(false);

  const appStore = useAppStore();

  /**
   * 初始化拉取主进程持久化设置
   */
  async function loadSettings(): Promise<void> {
    try {
      if (typeof window !== "undefined" && window.$ipcBridge) {
        const remote = await window.$ipcBridge.invoke("settings:all:get");
        if (remote) {
          settings.value = { ...defaultSettings, ...remote };
        }
      }
    } catch (e) {
      console.warn("Failed to load settings from main process", e);
    } finally {
      loaded.value = true;
    }
  }

  /**
   * 更新某项或多项设置并持久化至主进程
   */
  async function updateSettings(partial: Partial<UserSettings>): Promise<void> {
    saving.value = true;
    try {
      settings.value = {
        ...settings.value,
        ...partial,
      };

      // 联动 AppStore 的外观与多语言
      if (partial.theme && partial.theme !== appStore.theme) {
        void appStore.setTheme(partial.theme);
      }
      if (partial.locale && partial.locale !== appStore.locale) {
        void appStore.setLocale(partial.locale);
      }

      if (typeof window !== "undefined" && window.$ipcBridge) {
        const saved = await window.$ipcBridge.invoke("settings:all:set", partial);
        if (saved) {
          settings.value = { ...defaultSettings, ...saved };
        }
      }
    } finally {
      saving.value = false;
    }
  }

  /**
   * 监听主进程广播的设置变更（例如其他窗口修改或快捷键变更）
   */
  function listenSettingsChanges(): () => void {
    if (typeof window === "undefined" || !window.$ipcBridge) {
      return () => {};
    }
    return window.$ipcBridge.on("settings:changed", (updated) => {
      if (updated) {
        settings.value = { ...settings.value, ...updated };
      }
    });
  }

  return {
    settings,
    loaded,
    saving,
    loadSettings,
    updateSettings,
    listenSettingsChanges,
  };
});
