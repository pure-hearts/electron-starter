<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { NConfigProvider, NSelect, NTag, darkTheme, zhCN, enUS, type SelectOption } from "naive-ui";
import { useAppStore, type ThemeMode } from "./stores/app";

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

let unsubscribeDeepLink: (() => void) | undefined;
onMounted(async () => {
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
      <header class="header">
        <div style="display: flex; align-items: center; gap: 8px">
          <strong>Electron Starter</strong>
          <n-tag size="small" type="success" round :bordered="true">v0.1.3</n-tag>
        </div>
        <nav>
          <router-link to="/">{{ t("home") }}</router-link>
          <router-link to="/playground">{{ t("playground") }}</router-link>
        </nav>
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
      </header>
      <main class="app-main"><router-view /></main>
    </div>
  </n-config-provider>
</template>
