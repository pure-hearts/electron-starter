<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { useAppStore, type ThemeMode } from "./stores/app";

const { t, locale } = useI18n();
const appStore = useAppStore();
const currentLocale = computed(() => locale.value);
const currentTheme = computed(() => appStore.theme);

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
  <el-container class="app">
    <el-header class="header">
      <strong>Electron Starter</strong>
      <nav>
        <router-link to="/">{{ t("home") }}</router-link>
        <router-link to="/playground">{{ t("playground") }}</router-link>
      </nav>
      <el-select :model-value="currentTheme" style="width: 120px" @change="changeTheme">
        <el-option :label="t('theme.system')" value="system" />
        <el-option :label="t('theme.light')" value="light" />
        <el-option :label="t('theme.dark')" value="dark" />
      </el-select>
      <el-select :model-value="currentLocale" style="width: 120px" @change="changeLocale">
        <el-option label="简体中文" value="zh-CN" />
        <el-option label="English" value="en-US" />
      </el-select>
    </el-header>
    <el-main><router-view /></el-main>
  </el-container>
</template>
