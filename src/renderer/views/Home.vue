<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useOnline } from "@vueuse/core";
import { useAppStore } from "../stores/app";
import { useDownloadStore } from "../stores/download";
import { platform, isElectron } from "../bridge/platform";

const router = useRouter();
const { t } = useI18n();
const appStore = useAppStore();
const downloadStore = useDownloadStore();

const osLabel = computed(() => {
  if (platform.isMac) return "macOS (Apple Darwin)";
  if (platform.isWindows) return "Windows (x64 / ARM64)";
  if (platform.isLinux) return "Linux (X11 / Wayland)";
  return isElectron ? t("homeView.desktopEnv") : t("homeView.webEnv");
});

const isOnline = useOnline();
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- 1. Hero 欢迎与状态顶卡 -->
    <div
      class="relative bg-app-bg-surface border border-app-border rounded-2xl p-8 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-8 overflow-hidden shadow-md"
    >
      <div
        class="absolute -top-20 -left-20 w-260px h-260px bg-[radial-gradient(circle,rgba(37,99,235,0.15)_0%,rgba(37,99,235,0)_70%)] pointer-events-none"
      />
      <div class="flex-1 z-1">
        <div class="flex items-center gap-3 flex-wrap mb-3">
          <div class="flex items-center gap-2">
            <span
              class="inline-flex items-center gap-1.5 text-11px font-600 px-2.5 py-0.5 rounded-full border border-app-border bg-app-bg-subtle"
              :class="isOnline ? 'text-emerald-500 border-emerald-500/30' : 'text-app-text-muted'"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-current" />
              {{ isOnline ? t("homeView.online") : t("homeView.offline") }}
            </span>
            <span
              class="text-11px font-600 px-2 py-0.5 rounded-full bg-app-bg-hover text-app-text-regular"
            >
              {{ isElectron ? t("homeView.desktopEnv") : t("homeView.webEnv") }}
            </span>
          </div>
          <span class="text-12px text-app-text-muted">{{ t("homeView.versionBadge") }}</span>
        </div>

        <h1
          class="text-26px font-700 m-0 mb-2.5 text-app-text-primary leading-tight tracking-tight"
        >
          {{ t("homeView.heroTitlePrefix") }}
          <span class="bg-gradient-to-br from-app-primary to-sky-400 bg-clip-text text-transparent"
            >Electron + Vue 3</span
          >
          {{ t("homeView.heroTitleSuffix") }}
        </h1>

        <p class="text-14px text-app-text-secondary leading-relaxed m-0 mb-5 max-w-620px">
          {{ t("homeView.heroDesc") }}
        </p>

        <div class="flex items-center gap-3 flex-wrap">
          <n-button type="primary" size="medium" @click="router.push('/playground')">
            <template #icon>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </template>
            {{ t("homeView.openPlayground") }}
          </n-button>
          <n-button secondary size="medium" @click="downloadStore.toggleDrawer()">
            <template #icon>
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </template>
            {{ t("homeView.downloadCenter") }}
          </n-button>
          <n-button tertiary size="medium" @click="router.push('/settings')">
            {{ t("homeView.settingsCenter") }}
          </n-button>
        </div>
      </div>

      <!-- Hero 右侧快捷指标小面板 -->
      <div
        class="w-full md:w-300px flex-shrink-0 bg-app-bg-subtle border border-app-border-subtle rounded-xl p-4 flex flex-col gap-2.5 z-1"
      >
        <div class="flex flex-col gap-0.5">
          <span class="text-11px text-app-text-muted">{{ t("homeView.specs.hostOs") }}</span>
          <span class="text-12px font-600 text-app-text-regular">{{ osLabel }}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-11px text-app-text-muted">{{ t("homeView.specs.runtimeCore") }}</span>
          <span class="text-12px font-600 text-app-text-regular">{{
            t("homeView.specs.runtimeCoreVal")
          }}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-11px text-app-text-muted">{{ t("homeView.specs.activeTasks") }}</span>
          <span class="text-12px font-600 text-app-primary">
            {{ t("homeView.specs.activeTasksCount", { count: downloadStore.activeCount }) }}
          </span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-11px text-app-text-muted">{{ t("homeView.specs.appearance") }}</span>
          <span class="text-12px font-600 text-app-text-regular">{{
            t("theme." + appStore.theme)
          }}</span>
        </div>
      </div>
    </div>

    <!-- 2. Bento Grid 现代化磁贴矩阵 -->
    <div class="grid grid-cols-12 gap-4 mt-5">
      <!-- 磁贴 1: 功能测试中心 (Playground) 跨度 8 列 -->
      <div
        class="col-span-12 md:col-span-8 bg-app-bg-surface border border-app-border rounded-14px p-5.5 shadow-sm transition-all duration-200 flex flex-col justify-between cursor-pointer hover:(border-app-border-focus -translate-y-0.5 shadow-md)"
        @click="router.push('/playground')"
      >
        <div>
          <div class="flex items-center gap-3 mb-3">
            <div
              class="w-10 h-10 rounded-10px flex items-center justify-center flex-shrink-0 bg-blue-600/10 text-app-primary"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
                />
              </svg>
            </div>
            <div>
              <h3 class="text-15px font-600 m-0 text-app-text-primary">
                {{ t("homeView.bento.labTitle") }}
              </h3>
              <span class="text-12px text-app-text-muted">{{
                t("homeView.bento.labSubtitle")
              }}</span>
            </div>
          </div>

          <p class="text-13px text-app-text-secondary leading-normal m-0 mb-3.5">
            {{ t("homeView.bento.labDesc") }}
          </p>
        </div>

        <div class="flex flex-wrap gap-1.5">
          <span
            class="text-11px px-2 py-0.75 rounded-md bg-app-bg-subtle border border-app-border-subtle text-app-text-regular"
            >{{ t("homeView.bento.labChips.window") }}</span
          >
          <span
            class="text-11px px-2 py-0.75 rounded-md bg-app-bg-subtle border border-app-border-subtle text-app-text-regular"
            >{{ t("homeView.bento.labChips.notification") }}</span
          >
          <span
            class="text-11px px-2 py-0.75 rounded-md bg-app-bg-subtle border border-app-border-subtle text-app-text-regular"
            >{{ t("homeView.bento.labChips.hotUpdate") }}</span
          >
          <span
            class="text-11px px-2 py-0.75 rounded-md bg-app-bg-subtle border border-app-border-subtle text-app-text-regular"
            >{{ t("homeView.bento.labChips.ipc") }}</span
          >
          <span
            class="text-11px px-2 py-0.75 rounded-md bg-app-bg-subtle border border-app-border-subtle text-app-text-regular"
            >{{ t("homeView.bento.labChips.shortcut") }}</span
          >
        </div>
      </div>

      <!-- 磁贴 2: 下载与传输状态 跨度 4 列 -->
      <div
        class="col-span-12 md:col-span-4 bg-app-bg-surface border border-app-border rounded-14px p-5.5 shadow-sm transition-all duration-200 flex flex-col justify-between cursor-pointer hover:(border-app-border-focus -translate-y-0.5 shadow-md)"
        @click="downloadStore.toggleDrawer()"
      >
        <div>
          <div class="flex items-center gap-3 mb-3">
            <div
              class="w-10 h-10 rounded-10px flex items-center justify-center flex-shrink-0 bg-emerald-500/10 text-emerald-500"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                <path d="M12 12v9" />
                <path d="m8 17 4 4 4-4" />
              </svg>
            </div>
            <div>
              <h3 class="text-15px font-600 m-0 text-app-text-primary">
                {{ t("homeView.bento.transferTitle") }}
              </h3>
              <span class="text-12px text-app-text-muted">{{
                t("homeView.bento.transferSubtitle")
              }}</span>
            </div>
          </div>

          <div class="flex gap-4 my-2">
            <div class="flex-1 bg-app-bg-subtle p-2.5 rounded-lg text-center">
              <span class="text-20px font-700 text-app-text-primary block">{{
                downloadStore.activeCount
              }}</span>
              <span class="text-11px text-app-text-muted">{{
                t("homeView.bento.activeTasksLabel")
              }}</span>
            </div>
            <div class="flex-1 bg-app-bg-subtle p-2.5 rounded-lg text-center">
              <span class="text-20px font-700 text-app-text-primary block">{{
                downloadStore.completedCount
              }}</span>
              <span class="text-11px text-app-text-muted">{{
                t("homeView.bento.completedTasksLabel")
              }}</span>
            </div>
          </div>
        </div>

        <n-button block size="small" secondary type="primary" class="mt-3">
          {{ t("homeView.bento.expandDrawerBtn") }}
        </n-button>
      </div>

      <!-- 磁贴 3: 四层同构架构 跨度 6 列 -->
      <div
        class="col-span-12 md:col-span-6 bg-app-bg-surface border border-app-border rounded-14px p-5.5 shadow-sm transition-all duration-200 flex flex-col justify-between cursor-pointer hover:(border-app-border-focus -translate-y-0.5 shadow-md)"
      >
        <div>
          <div class="flex items-center gap-3 mb-3">
            <div
              class="w-10 h-10 rounded-10px flex items-center justify-center flex-shrink-0 bg-purple-500/10 text-purple-500"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </div>
            <div>
              <h3 class="text-15px font-600 m-0 text-app-text-primary">
                {{ t("homeView.bento.archTitle") }}
              </h3>
              <span class="text-12px text-app-text-muted">{{
                t("homeView.bento.archSubtitle")
              }}</span>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2.5 text-12px">
              <code
                class="font-mono text-11px font-600 px-1.5 py-0.5 bg-app-bg-subtle border border-app-border rounded text-app-primary w-100px flex-shrink-0"
                >src/main</code
              >
              <span class="text-app-text-secondary">{{ t("homeView.bento.archMainDesc") }}</span>
            </div>
            <div class="flex items-center gap-2.5 text-12px">
              <code
                class="font-mono text-11px font-600 px-1.5 py-0.5 bg-app-bg-subtle border border-app-border rounded text-app-primary w-100px flex-shrink-0"
                >src/preload</code
              >
              <span class="text-app-text-secondary">{{ t("homeView.bento.archPreloadDesc") }}</span>
            </div>
            <div class="flex items-center gap-2.5 text-12px">
              <code
                class="font-mono text-11px font-600 px-1.5 py-0.5 bg-app-bg-subtle border border-app-border rounded text-app-primary w-100px flex-shrink-0"
                >src/renderer</code
              >
              <span class="text-app-text-secondary">{{
                t("homeView.bento.archRendererDesc")
              }}</span>
            </div>
            <div class="flex items-center gap-2.5 text-12px">
              <code
                class="font-mono text-11px font-600 px-1.5 py-0.5 bg-app-bg-subtle border border-app-border rounded text-app-primary w-100px flex-shrink-0"
                >src/shared</code
              >
              <span class="text-app-text-secondary">{{ t("homeView.bento.archSharedDesc") }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 磁贴 4: 桌面与系统偏好 跨度 6 列 -->
      <div
        class="col-span-12 md:col-span-6 bg-app-bg-surface border border-app-border rounded-14px p-5.5 shadow-sm transition-all duration-200 flex flex-col justify-between cursor-pointer hover:(border-app-border-focus -translate-y-0.5 shadow-md)"
        @click="router.push('/settings')"
      >
        <div>
          <div class="flex items-center gap-3 mb-3">
            <div
              class="w-10 h-10 rounded-10px flex items-center justify-center flex-shrink-0 bg-amber-500/10 text-amber-500"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path
                  d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
                />
              </svg>
            </div>
            <div>
              <h3 class="text-15px font-600 m-0 text-app-text-primary">
                {{ t("homeView.bento.settingsTitle") }}
              </h3>
              <span class="text-12px text-app-text-muted">{{
                t("homeView.bento.settingsSubtitle")
              }}</span>
            </div>
          </div>

          <p class="text-13px text-app-text-secondary leading-normal m-0 mb-3.5">
            {{ t("homeView.bento.settingsDesc") }}
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <span class="text-11px px-2 py-0.75 bg-app-bg-subtle rounded-md text-app-text-regular">{{
            t("homeView.bento.settingsTag1")
          }}</span>
          <span class="text-11px px-2 py-0.75 bg-app-bg-subtle rounded-md text-app-text-regular">{{
            t("homeView.bento.settingsTag2")
          }}</span>
          <span class="text-11px px-2 py-0.75 bg-app-bg-subtle rounded-md text-app-text-regular">{{
            t("homeView.bento.settingsTag3")
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
