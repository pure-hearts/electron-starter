import { defineStore } from "pinia";
import { ref } from "vue";

export type ThemeMode = "light" | "dark" | "system";

export const useAppStore = defineStore("app", () => {
  const locale = ref(localStorage.getItem("locale") || "zh-CN");
  const theme = ref<ThemeMode>((localStorage.getItem("theme") as ThemeMode) || "system");
  const lastDeepLink = ref("");

  let mediaQuery: MediaQueryList | null = null;
  let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

  function applyTheme(mode: ThemeMode) {
    if (typeof window === "undefined") return;
    if (mediaQuery && mediaListener) {
      mediaQuery.removeEventListener("change", mediaListener);
      mediaListener = null;
    }

    const isDark =
      mode === "dark" ||
      (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    document.documentElement.classList.toggle("dark", isDark);

    if (mode === "system") {
      mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaListener = (e: MediaQueryListEvent) => {
        if (theme.value === "system") {
          document.documentElement.classList.toggle("dark", e.matches);
        }
      };
      mediaQuery.addEventListener("change", mediaListener);
    }
  }

  // 初始加载时立即应用缓存的主题模式，避免闪屏
  applyTheme(theme.value);

  function receiveDeepLink(url: string): void {
    lastDeepLink.value = url;
  }

  async function setLocale(value: string): Promise<void> {
    if (value !== "zh-CN" && value !== "en-US") return;
    // electron-store is authoritative; localStorage is only a startup display cache.
    await window.$ipcBridge.invoke("store:set", "locale", value);
    locale.value = value;
    localStorage.setItem("locale", value);
  }

  async function setTheme(value: ThemeMode): Promise<void> {
    if (value !== "light" && value !== "dark" && value !== "system") return;
    await window.$ipcBridge.invoke("store:set", "theme", value);
    theme.value = value;
    localStorage.setItem("theme", value);
    applyTheme(value);
  }

  async function hydrate() {
    try {
      const savedLocale = await window.$ipcBridge.invoke("store:get", "locale");
      if (savedLocale === "zh-CN" || savedLocale === "en-US") {
        locale.value = savedLocale;
        localStorage.setItem("locale", savedLocale);
      }
    } catch (error) {
      console.warn("Could not load language preference", error);
    }

    try {
      const savedTheme = await window.$ipcBridge.invoke("store:get", "theme");
      if (savedTheme === "light" || savedTheme === "dark" || savedTheme === "system") {
        theme.value = savedTheme;
        localStorage.setItem("theme", savedTheme);
      }
    } catch (error) {
      console.warn("Could not load theme preference", error);
    }

    applyTheme(theme.value);
    return locale.value;
  }

  return { locale, theme, lastDeepLink, receiveDeepLink, setLocale, setTheme, hydrate, applyTheme };
});
