<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { darkTheme, zhCN, enUS, type SelectOption } from "naive-ui";
import { useAppStore, type ThemeMode } from "./stores/app";
import { isElectron } from "./bridge/platform";

const { t, locale } = useI18n();
const appStore = useAppStore();
const currentLocale = computed(() => locale.value);
const currentTheme = computed(() => appStore.theme);

const naiveTheme = computed(() => (appStore.isDark ? darkTheme : null));
const naiveLocale = computed(() => (currentLocale.value === "zh-CN" ? zhCN : enUS));

const themeOptions = computed<SelectOption[]>(() => [
  { label: t("theme.system"), value: "system" },
  { label: t("theme.light"), value: "light" },
  { label: t("theme.dark"), value: "dark" },
]);

const localeOptions: SelectOption[] = [
  { label: "简体中文", value: "zh-CN" },
  { label: "English", value: "en-US" },
];

const isMacApp = computed(() => {
  if (typeof navigator === "undefined") return false;
  return isElectron && /Mac|Macintosh/i.test(navigator.userAgent);
});

let unsubscribeDeepLink: (() => void) | undefined;
onMounted(async () => {
  if (isElectron && navigator.userAgent.includes("Mac")) {
    document.body.classList.add("is-mac-electron");
  }
  // Register listener first, then consume cold-start links so no link is lost.
  unsubscribeDeepLink = window.$ipcBridge.on("protocol:open", (url) =>
    appStore.receiveDeepLink(url),
  );
  try {
    const pending = await window.$ipcBridge.invoke("protocol:pending");
    for (const url of pending) appStore.receiveDeepLink(url);
  } catch (error) {
    console.warn("Could not load pending Deep Links", error);
  }
  try {
    locale.value = await appStore.hydrate();
  } catch (error) {
    console.warn("Could not load preferences", error);
  }
});
onUnmounted(() => unsubscribeDeepLink?.());

async function changeLocale(value: string) {
  try {
    await appStore.setLocale(value);
    locale.value = appStore.locale;
  } catch (error) {
    console.warn("Language preference could not be saved", error);
  }
}

async function changeTheme(value: string) {
  try {
    await appStore.setTheme(value as ThemeMode);
  } catch (error) {
    console.warn("Theme preference could not be saved", error);
  }
}
</script>
<template>
  <n-config-provider :theme="naiveTheme" :locale="naiveLocale">
    <div class="app">
      <header class="header" :class="{ 'is-mac': isMacApp }">
        <nav class="header-nav">
          <router-link to="/">{{ t("home") }}</router-link>
          <router-link to="/playground">{{ t("playground") }}</router-link>
        </nav>
        <div class="header-title">
          <strong>Electron Starter</strong>
          <n-tag size="small" type="success" round :bordered="true">v0.1.3</n-tag>
        </div>
        <div class="header-actions">
          <n-select
            :value="currentTheme"
            :options="themeOptions"
            size="small"
            style="width: 120px"
            @update:value="changeTheme"
          />
          <n-select
            :value="currentLocale"
            :options="localeOptions"
            size="small"
            style="width: 120px"
            @update:value="changeLocale"
          />
        </div>
      </header>
      <main class="app-main"><router-view /></main>
    </div>
  </n-config-provider>
</template>
