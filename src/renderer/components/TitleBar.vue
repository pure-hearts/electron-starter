<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAppStore, type ThemeMode } from "../stores/app";
import { useDownloadStore } from "../stores/download";
import { isElectron, isWeb, platform } from "../bridge/platform";
import { useIpcBridge } from "../bridge";

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const appStore = useAppStore();
const downloadStore = useDownloadStore();
const { invoke } = useIpcBridge();

// 平台特性识别（仅在 Electron 桌面环境下生效对应平台系统控制）
const isMac = computed(() => platform.isMac);
const isWindows = computed(() => platform.isWindows);
const isLinux = computed(() => platform.isLinux);

// 导航项定义
interface NavItem {
  id: string;
  path: string;
  query?: Record<string, string>;
  label: string;
}

const navItems = computed<NavItem[]>(() => [
  { id: "home", path: "/", label: t("home") },
  { id: "window", path: "/playground", query: { tab: "window" }, label: t("navWindow") },
  { id: "transfer", path: "/playground", query: { tab: "transfer" }, label: t("navTransfer") },
  { id: "update", path: "/playground", query: { tab: "update" }, label: t("navUpdate") },
  { id: "settings", path: "/settings", label: t("settings") },
]);

function navigateTo(path: string, query?: Record<string, string>) {
  if (route.path !== path || (query?.tab && route.query.tab !== query.tab)) {
    void router.push({ path, query });
  }
}

function isNavActive(item: NavItem): boolean {
  if (item.path === "/") {
    return route.path === "/";
  }
  if (item.path === "/settings") {
    return route.path === "/settings";
  }
  if (item.path === "/playground") {
    if (route.path !== "/playground") return false;
    const currentTab = (route.query.tab as string) || "window";
    return currentTab === (item.query?.tab || "window");
  }
  return false;
}

// 主题切换: system -> light -> dark -> system
function toggleTheme() {
  const current = appStore.theme;
  let next: ThemeMode = "system";
  if (current === "system") next = "light";
  else if (current === "light") next = "dark";
  else next = "system";

  void appStore.setTheme(next);
}

// 语言切换: zh-CN <-> en-US
function toggleLocale() {
  const nextLocale = locale.value === "zh-CN" ? "en-US" : "zh-CN";
  void appStore.setLocale(nextLocale);
  locale.value = nextLocale;
}

// 桌面窗口控制动作（仅 Electron 桌面端生效）
async function handleMinimize() {
  if (!isElectron) return;
  await invoke("window:action", "minimize");
}

async function handleToggleMaximize() {
  if (!isElectron) return;
  if (appStore.isMaximized) {
    await invoke("window:action", "restore");
  } else {
    await invoke("window:action", "maximize");
  }
}

async function handleClose() {
  if (!isElectron) return;
  await invoke("window:action", "close");
}

function handleDblClick(e: MouseEvent) {
  if (!isElectron) return;
  const target = e.target as HTMLElement;
  if (target.closest(".no-drag, button, a, input, select")) return;
  void handleToggleMaximize();
}
</script>

<template>
  <header
    class="flex items-center h-44px bg-app-bg-surface border-b border-app-border text-app-text-secondary text-13px select-none sticky top-0 z-50 transition-colors duration-200 px-2"
    :class="[isWeb ? 'no-drag' : 'drag', isWindows && isElectron ? 'pr-0' : '']"
    @dblclick="handleDblClick"
  >
    <!-- ================= 1. 左侧区域 ================= -->
    <!-- macOS 桌面客户端: 留白 76px 给原生交通灯 -->
    <div v-if="isMac && isElectron" class="w-76px h-full flex-shrink-0 no-drag" />

    <!-- 现代 Electron + Vue 品牌 Logo 与标题 (在所有平台均清晰显示) -->
    <div
      class="flex items-center gap-2 px-2.5 h-full cursor-pointer flex-shrink-0 no-drag"
      @click="navigateTo('/')"
    >
      <div class="flex items-center">
        <!-- 现代 Electron + Vue 融合创意 SVG -->
        <svg viewBox="0 0 28 28" width="18" height="18" fill="none">
          <!-- 倾斜量子流光环 (Electron 基因) -->
          <ellipse
            cx="14"
            cy="14"
            rx="12"
            ry="4.5"
            stroke="#38bdf8"
            stroke-width="1.5"
            transform="rotate(-30 14 14)"
            opacity="0.85"
          />
          <!-- Vue 外层翡翠绿晶核 (Vue 基因) -->
          <polygon points="14,24 4,6 8.5,6 14,16 19.5,6 24,6" fill="#42d392" />
          <!-- Vue 内层科技蓝晶核 -->
          <polygon points="14,19.5 8,6 11.5,6 14,11 16.5,6 20,6" fill="#38bdf8" />
          <!-- 量子轨道发光粒子 -->
          <circle cx="23" cy="11" r="1.6" fill="#ffffff" />
        </svg>
      </div>
      <span class="font-600 text-13px text-app-text-primary tracking-tight"
        >electron-vue-template</span
      >
      <span
        class="text-10px font-700 px-1.5 py-0.25 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
        >Vue+</span
      >
    </div>

    <!-- ================= 2. 顶栏中间胶囊主导航 (Pill Tabs) ================= -->
    <nav
      class="flex items-center gap-1 ml-1.5 bg-app-bg-subtle p-0.75 rounded-lg border border-app-border-subtle no-drag"
    >
      <button
        v-for="item in navItems"
        :key="item.id"
        class="border-none bg-transparent text-app-text-secondary text-12px font-500 px-3 py-1 rounded-md cursor-pointer transition-all duration-150 hover:(text-app-text-primary bg-app-bg-hover)"
        :class="{ 'bg-app-bg-surface text-app-primary font-600 shadow-sm': isNavActive(item) }"
        @click="navigateTo(item.path, item.query)"
      >
        {{ item.label }}
      </button>
    </nav>

    <!-- 中间窗口平滑拖拽区 -->
    <div class="flex-1 h-full drag" />

    <!-- ================= 3. 右侧功能操作区 ================= -->
    <div class="flex items-center gap-1.5 h-full no-drag">
      <!-- 下载传输中心按钮 (带 Badge) -->
      <button
        class="relative inline-flex items-center justify-center w-30px h-30px rounded-md border-none bg-transparent text-app-text-secondary cursor-pointer transition-all duration-150 hover:(bg-app-bg-hover text-app-text-primary)"
        :title="t('header.downloadCenter')"
        :aria-label="t('header.downloadCenter')"
        @click="downloadStore.toggleDrawer()"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span
          v-if="downloadStore.activeCount > 0"
          class="absolute -top-0.5 -right-0.5 bg-app-primary text-white text-9px font-700 h-3.5 min-w-3.5 leading-3.5 text-center rounded-full px-0.75 ring-1.5 ring-app-bg-surface"
        >
          {{ downloadStore.activeCount }}
        </span>
      </button>

      <!-- 外观主题切换 (跟随系统 / 浅色 / 深色) -->
      <button
        class="relative inline-flex items-center justify-center w-30px h-30px rounded-md border-none bg-transparent text-app-text-secondary cursor-pointer transition-all duration-150 hover:(bg-app-bg-hover text-app-text-primary)"
        :title="`${t('settingsView.general.themeLabel')}: ${t('theme.' + appStore.theme)} (${t('header.themeToggle')})`"
        :aria-label="t('header.themeToggle')"
        @click="toggleTheme"
      >
        <svg
          v-if="appStore.theme === 'system'"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
        <svg
          v-else-if="appStore.theme === 'light'"
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </button>

      <!-- 语言切换按钮 (中/EN) -->
      <button
        class="inline-flex items-center justify-center px-2 py-0.75 text-11px font-600 rounded-md border border-app-border bg-app-bg-subtle text-app-text-secondary cursor-pointer transition-all duration-150 hover:(bg-app-bg-hover text-app-text-primary border-app-border-focus)"
        :title="t('header.localeToggle')"
        :aria-label="t('header.localeToggle')"
        @click="toggleLocale"
      >
        {{ locale === "zh-CN" ? "中" : "EN" }}
      </button>

      <!-- ================= 4. 平台特色窗口控制按钮 (仅桌面 Electron 渲染) ================= -->
      <template v-if="isElectron">
        <!-- A. Windows 平台: 贴边 Fluent 风格矩形无边框三键 -->
        <div v-if="isWindows" class="flex items-center h-full ml-1.5">
          <button
            class="inline-flex items-center justify-center w-46px h-full border-none bg-transparent text-app-text-secondary cursor-pointer transition-colors duration-100 hover:(bg-app-bg-muted text-app-text-primary)"
            :title="t('header.minimize')"
            :aria-label="t('header.minimize')"
            @click="handleMinimize"
          >
            <svg viewBox="0 0 12 12" width="10" height="10">
              <line
                x1="1"
                y1="6"
                x2="11"
                y2="6"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
              />
            </svg>
          </button>

          <button
            class="inline-flex items-center justify-center w-46px h-full border-none bg-transparent text-app-text-secondary cursor-pointer transition-colors duration-100 hover:(bg-app-bg-muted text-app-text-primary)"
            :title="appStore.isMaximized ? t('header.restore') : t('header.maximize')"
            :aria-label="appStore.isMaximized ? t('header.restore') : t('header.maximize')"
            @click="handleToggleMaximize"
          >
            <svg v-if="appStore.isMaximized" viewBox="0 0 12 12" width="10" height="10" fill="none">
              <path d="M3.5 1.5h6a1 1 0 0 1 1 1v6" stroke="currentColor" stroke-width="1.1" />
              <rect
                x="1.5"
                y="3.5"
                width="7"
                height="7"
                rx="0.5"
                stroke="currentColor"
                stroke-width="1.1"
              />
            </svg>
            <svg v-else viewBox="0 0 12 12" width="10" height="10" fill="none">
              <rect
                x="1.5"
                y="1.5"
                width="9"
                height="9"
                rx="0.5"
                stroke="currentColor"
                stroke-width="1.1"
              />
            </svg>
          </button>

          <button
            class="inline-flex items-center justify-center w-46px h-full border-none bg-transparent text-app-text-secondary cursor-pointer transition-colors duration-100 hover:(bg-red-600! text-white!) active:(bg-red-700! text-white!)"
            :title="t('header.close')"
            :aria-label="t('header.close')"
            @click="handleClose"
          >
            <svg viewBox="0 0 12 12" width="10" height="10">
              <line
                x1="2"
                y1="2"
                x2="10"
                y2="10"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
              />
              <line
                x1="10"
                y1="2"
                x2="2"
                y2="10"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>

        <!-- B. Linux 平台: 现代 GNOME / Adwaita 独立圆形徽章三键 -->
        <div v-else-if="isLinux" class="flex items-center gap-2 pl-2.5 pr-2 h-full">
          <button
            class="w-6 h-6 rounded-full border border-app-border bg-app-bg-subtle text-app-text-secondary inline-flex items-center justify-center cursor-pointer p-0 transition-all duration-150 hover:(bg-app-bg-hover text-app-text-primary border-app-border-focus scale-105) active:scale-94"
            :title="t('header.minimize')"
            :aria-label="t('header.minimize')"
            @click="handleMinimize"
          >
            <svg viewBox="0 0 12 12" width="8" height="8">
              <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.4" />
            </svg>
          </button>

          <button
            class="w-6 h-6 rounded-full border border-app-border bg-app-bg-subtle text-app-text-secondary inline-flex items-center justify-center cursor-pointer p-0 transition-all duration-150 hover:(bg-app-bg-hover text-app-text-primary border-app-border-focus scale-105) active:scale-94"
            :title="appStore.isMaximized ? t('header.restore') : t('header.maximize')"
            :aria-label="appStore.isMaximized ? t('header.restore') : t('header.maximize')"
            @click="handleToggleMaximize"
          >
            <svg viewBox="0 0 12 12" width="8" height="8" fill="none">
              <rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1.4" />
            </svg>
          </button>

          <button
            class="w-6 h-6 rounded-full border border-app-border bg-app-bg-subtle text-app-text-secondary inline-flex items-center justify-center cursor-pointer p-0 transition-all duration-150 hover:(bg-red-500! text-white! border-red-500! scale-105) active:scale-94"
            :title="t('header.close')"
            :aria-label="t('header.close')"
            @click="handleClose"
          >
            <svg viewBox="0 0 12 12" width="8" height="8">
              <line x1="2.5" y1="2.5" x2="9.5" y2="9.5" stroke="currentColor" stroke-width="1.4" />
              <line x1="9.5" y1="2.5" x2="2.5" y2="9.5" stroke="currentColor" stroke-width="1.4" />
            </svg>
          </button>
        </div>
      </template>
    </div>
  </header>
</template>
