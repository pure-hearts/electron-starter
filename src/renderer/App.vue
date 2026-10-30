<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { darkTheme, zhCN, enUS } from "naive-ui";
import { useAppStore } from "./stores/app";
import TitleBar from "./components/TitleBar.vue";
import NetworkBanner from "./components/NetworkBanner.vue";
import GlobalDownloadDrawer from "./components/GlobalDownloadDrawer.vue";
import { useDownloadStore } from "./stores/download";

const router = useRouter();
const { locale } = useI18n();
const appStore = useAppStore();
const downloadStore = useDownloadStore();

const naiveTheme = computed(() => (appStore.isDark ? darkTheme : null));
const naiveLocale = computed(() => (locale.value === "zh-CN" ? zhCN : enUS));

let unsubscribeDeepLink: (() => void) | undefined;
let unsubscribeNotification: (() => void) | undefined;

onMounted(async () => {
  // Register listener first, then consume cold-start links so no link is lost.
  unsubscribeDeepLink = window.$ipcBridge.on("protocol:open", (url) =>
    appStore.receiveDeepLink(url),
  );

  // 统一响应通知点击事件：根据 action 参数在前端进行业务路由或文件定位调度
  unsubscribeNotification = window.$ipcBridge.on("notification:activated", (payload) => {
    if (!payload.action || typeof payload.action !== "string") return;
    const knownRoutes = router
      .getRoutes()
      .map((r) => r.path)
      .filter((p) => p !== "/:pathMatch(.*)*");
    if (knownRoutes.includes(payload.action)) {
      if (router.currentRoute.value.path !== payload.action) {
        void router.push(payload.action);
      }
      return;
    }
    // 若不是前端已知路由，作为本地文件路径通过 IPC 请求定位
    if (payload.action.startsWith("/") || /^[a-zA-Z]:\\/.test(payload.action)) {
      void window.$ipcBridge
        .invoke("shell:showItemInFolder", payload.action)
        .catch(() => undefined);
    }
  });

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

  void downloadStore.init();
});

onUnmounted(() => {
  unsubscribeDeepLink?.();
  unsubscribeNotification?.();
});
</script>

<template>
  <n-config-provider
    :theme="naiveTheme"
    :locale="naiveLocale"
    :theme-overrides="appStore.themeOverrides"
  >
    <div class="app">
      <TitleBar />
      <NetworkBanner />
      <GlobalDownloadDrawer />
      <main class="app-main">
        <router-view />
      </main>
    </div>
  </n-config-provider>
</template>
