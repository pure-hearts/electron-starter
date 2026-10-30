import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import type { GlobalThemeOverrides } from "naive-ui";

export type ThemeMode = "light" | "dark" | "system";

/** 辅助函数：调整 16 进制颜色明度 */
function adjustHexBrightness(hex: string, amount: number): string {
  const clean = hex.replace("#", "").slice(0, 6);
  const num = parseInt(clean, 16);
  if (isNaN(num)) return hex;
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export const useAppStore = defineStore("app", () => {
  const locale = ref(localStorage.getItem("locale") || "zh-CN");
  const theme = ref<ThemeMode>((localStorage.getItem("theme") as ThemeMode) || "system");
  const isDark = ref(false);
  const lastDeepLink = ref("");
  const accentColor = ref<string | null>(null);
  const isMaximized = ref(false);

  let mediaQuery: MediaQueryList | null = null;
  let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;
  let unsubscribeTheme: (() => void) | null = null;
  let unsubscribeMaximize: (() => void) | null = null;

  function applyTheme(mode: ThemeMode) {
    if (typeof window === "undefined") return;
    if (mediaQuery && mediaListener) {
      mediaQuery.removeEventListener("change", mediaListener);
      mediaListener = null;
    }

    const darkActive =
      mode === "dark" ||
      (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    isDark.value = darkActive;
    document.documentElement.classList.toggle("dark", darkActive);

    if (mode === "system") {
      mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaListener = (e: MediaQueryListEvent) => {
        if (theme.value === "system") {
          isDark.value = e.matches;
          document.documentElement.classList.toggle("dark", e.matches);
        }
      };
      mediaQuery.addEventListener("change", mediaListener);
    }
  }

  // 初始加载时立即应用缓存的主题模式，避免闪屏
  applyTheme(theme.value);

  // 根据 accentColor 计算 Naive UI 主题覆盖配置
  const themeOverrides = computed<GlobalThemeOverrides>(() => {
    if (!accentColor.value) return {};
    const hex = accentColor.value.startsWith("#")
      ? accentColor.value.slice(0, 7)
      : `#${accentColor.value.slice(0, 6)}`;
    const hover = adjustHexBrightness(hex, isDark.value ? 20 : -15);
    const pressed = adjustHexBrightness(hex, isDark.value ? -20 : 15);
    return {
      common: {
        primaryColor: hex,
        primaryColorHover: hover,
        primaryColorPressed: pressed,
        primaryColorSuppl: hex,
      },
    };
  });

  // 动态同步 CSS 变量 --app-primary
  watch(
    [accentColor, isDark],
    ([color]) => {
      if (typeof document === "undefined") return;
      if (color) {
        document.documentElement.style.setProperty("--app-primary", color);
      } else {
        document.documentElement.style.removeProperty("--app-primary");
      }
    },
    { immediate: true },
  );

  function receiveDeepLink(url: string): void {
    lastDeepLink.value = url;
  }

  async function setLocale(value: string): Promise<void> {
    if (value !== "zh-CN" && value !== "en-US") return;
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

  function setupBridgeSubscriptions(): void {
    if (typeof window === "undefined" || !window.$ipcBridge?.on) return;

    if (!unsubscribeTheme) {
      unsubscribeTheme = window.$ipcBridge.on("theme:system:changed", (payload) => {
        accentColor.value = payload.accentColor;
        if (theme.value === "system") {
          isDark.value = payload.shouldUseDarkColors;
          document.documentElement.classList.toggle("dark", payload.shouldUseDarkColors);
        }
      });
    }

    if (!unsubscribeMaximize) {
      unsubscribeMaximize = window.$ipcBridge.on("window:maximize-change", (val) => {
        isMaximized.value = val;
      });
    }
  }

  async function hydrate() {
    setupBridgeSubscriptions();

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

    try {
      const systemTheme = await window.$ipcBridge.invoke("theme:system:get");
      if (systemTheme) {
        accentColor.value = systemTheme.accentColor;
        if (theme.value === "system") {
          isDark.value = systemTheme.shouldUseDarkColors;
          document.documentElement.classList.toggle("dark", systemTheme.shouldUseDarkColors);
        }
      }
    } catch (error) {
      console.warn("Could not load system theme", error);
    }

    try {
      isMaximized.value = await window.$ipcBridge.invoke("window:isMaximized");
    } catch (error) {
      console.warn("Could not load maximize state", error);
    }

    applyTheme(theme.value);
    return locale.value;
  }

  return {
    locale,
    theme,
    isDark,
    accentColor,
    isMaximized,
    lastDeepLink,
    themeOverrides,
    receiveDeepLink,
    setLocale,
    setTheme,
    hydrate,
    applyTheme,
  };
});
