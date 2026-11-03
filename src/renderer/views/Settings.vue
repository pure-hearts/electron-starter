<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import { useAppStore, type ThemeMode } from "../stores/app";
import { useSettingsStore } from "../stores/settings";
import { useIpcBridge } from "../bridge";
import { isElectron } from "../bridge/platform";
import { feedback } from "../utils/feedback";
import GlobalShortcutManager from "../components/GlobalShortcutManager.vue";
import type { UserSettings, SystemDiagnostics } from "@shared/ipc";

const { t, locale } = useI18n();
const appStore = useAppStore();
const settingsStore = useSettingsStore();
const { invoke } = useIpcBridge();

// 当前选中的 Tab 项 (左侧分类栏导航)
const activeTab = ref<
  "general" | "system" | "download" | "notification" | "shortcut" | "diagnostics"
>("general");

// 本地响应式表单，代理全局设置
const form = reactive<UserSettings>({
  theme: "system",
  locale: "zh-CN",
  closeToTray: true,
  autoStart: false,
  hardwareAcceleration: true,
  defaultDownloadDir: "",
  downloadConcurrency: 10,
  autoResumeDownloads: true,
  notificationsEnabled: true,
  notificationSound: true,
  silentNotifications: false,
  notifyOnDownload: true,
  notifyOnUpdate: true,
  globalShortcutToggle: "CommandOrControl+Shift+X",
});

// 系统诊断指标状态
const diagnostics = ref<SystemDiagnostics | null>(null);
const loadingDiagnostics = ref(false);
const exportingLogs = ref(false);

// 语言选项下拉
const localeOptions = [
  { label: "简体中文 (zh-CN)", value: "zh-CN" },
  { label: "English (en-US)", value: "en-US" },
];

// 左侧分类项清单
const sidebarItems = computed(() => [
  {
    key: "general",
    label: t("settingsView.sidebar.general"),
    desc: t("settingsView.sidebar.generalDesc"),
    icon: "palette",
  },
  {
    key: "system",
    label: t("settingsView.sidebar.system"),
    desc: t("settingsView.sidebar.systemDesc"),
    icon: "desktop",
  },
  {
    key: "download",
    label: t("settingsView.sidebar.download"),
    desc: t("settingsView.sidebar.downloadDesc"),
    icon: "download",
  },
  {
    key: "notification",
    label: t("settingsView.sidebar.notification"),
    desc: t("settingsView.sidebar.notificationDesc"),
    icon: "bell",
  },
  {
    key: "shortcut",
    label: t("settingsView.sidebar.shortcut"),
    desc: t("settingsView.sidebar.shortcutDesc"),
    icon: "keyboard",
  },
  {
    key: "diagnostics",
    label: t("settingsView.sidebar.diagnostics"),
    desc: t("settingsView.sidebar.diagnosticsDesc"),
    icon: "info",
  },
]);

onMounted(async () => {
  await settingsStore.loadSettings();
  Object.assign(form, settingsStore.settings);
  void loadDiagnostics();
});

async function saveForm() {
  await settingsStore.updateSettings({ ...form });
}

async function handleSaveAll() {
  await saveForm();
  feedback.message.success(t("settingsView.saveSuccess"));
}

function onLocaleChange(val: string) {
  form.locale = val;
  locale.value = val;
  void saveForm();
}

function onThemeChange(val: ThemeMode) {
  form.theme = val;
  void saveForm();
}

async function handleSelectDownloadDir() {
  if (!isElectron) {
    feedback.message.info("Web 浏览器预览模式下由浏览器托管下载目录");
    return;
  }
  try {
    const res = await invoke("dialog:open", {
      properties: ["openDirectory", "createDirectory"],
      title: "选择默认下载保存文件夹",
    });
    if (!res.canceled && res.filePaths.length > 0) {
      form.defaultDownloadDir = res.filePaths[0];
      await saveForm();
      feedback.message.success("默认存储目录已更新");
    }
  } catch (err) {
    feedback.message.error(String(err));
  }
}

function resetDownloadDir() {
  form.defaultDownloadDir = "";
  void saveForm();
  feedback.message.success("已恢复为系统默认下载目录");
}

async function loadDiagnostics() {
  loadingDiagnostics.value = true;
  try {
    const res = await invoke("system:diagnostics");
    diagnostics.value = res;
  } catch (err) {
    console.warn("Could not load diagnostics", err);
  } finally {
    loadingDiagnostics.value = false;
  }
}

async function handleExportLogs() {
  if (!isElectron) {
    feedback.message.info("Web 预览模式暂无本地归档文件");
    return;
  }
  exportingLogs.value = true;
  try {
    const res = await invoke("log:archive:export");
    if (res.success && res.archivePath) {
      feedback.message.success(`诊断日志已导出至: ${res.archivePath}`);
      await invoke("shell:showItemInFolder", res.archivePath);
    } else {
      feedback.message.error(res.error || "导出日志失败");
    }
  } catch (err) {
    feedback.message.error(String(err));
  } finally {
    exportingLogs.value = false;
  }
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function openRepo() {
  if (isElectron) {
    void invoke("shell:openExternal", "https://github.com/pure-hearts/electron-vue-template");
  } else if (typeof window !== "undefined") {
    window.open("https://github.com/pure-hearts/electron-vue-template", "_blank");
  }
}

function handleCheckUpdate() {
  if (isElectron) {
    void invoke("updater:check");
  } else {
    feedback.message.info("Web 预览模式：当前已是最新网页版本");
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <!-- 页面顶栏简介 -->
    <div
      class="flex justify-between items-center bg-app-bg-surface border border-app-border rounded-14px px-6 py-5 shadow-sm"
    >
      <div>
        <h2 class="text-20px font-700 m-0 mb-1 text-app-text-primary tracking-tight">
          {{ t("settingsView.bannerTitle") }}
        </h2>
        <p class="text-13px text-app-text-secondary m-0">
          {{ t("settingsView.bannerSubtitle") }}
        </p>
      </div>
      <div>
        <n-button
          type="primary"
          secondary
          size="medium"
          :loading="settingsStore.saving"
          @click="handleSaveAll"
        >
          {{ t("settingsView.saveAllBtn") }}
        </n-button>
      </div>
    </div>

    <!-- 现代两栏式主体架构 (Sidebar + Content Cards) -->
    <div class="flex flex-col md:flex-row gap-5 items-stretch md:items-start">
      <!-- 1. 左侧固定侧边分类导航栏 -->
      <aside
        class="w-full md:w-230px flex-shrink-0 bg-app-bg-surface border border-app-border rounded-14px p-2.5 shadow-sm md:sticky md:top-60px"
      >
        <nav class="flex flex-col gap-1">
          <button
            v-for="item in sidebarItems"
            :key="item.key"
            class="flex items-center gap-3 w-full p-2.5 border-none bg-transparent rounded-10px cursor-pointer text-left transition-all duration-150 text-app-text-secondary hover:(bg-app-bg-hover text-app-text-primary)"
            :class="{
              'bg-app-bg-subtle text-app-primary shadow-sm border border-app-border-subtle':
                activeTab === item.key,
            }"
            @click="activeTab = item.key"
          >
            <div
              class="w-8 h-8 rounded-lg bg-app-bg-hover flex items-center justify-center flex-shrink-0"
              :class="{ 'bg-blue-600/12 text-app-primary': activeTab === item.key }"
            >
              <svg
                v-if="item.icon === 'palette'"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                <path
                  d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
                />
              </svg>
              <svg
                v-else-if="item.icon === 'desktop'"
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
                v-else-if="item.icon === 'download'"
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
              <svg
                v-else-if="item.icon === 'bell'"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <svg
                v-else-if="item.icon === 'keyboard'"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <line x1="6" y1="8" x2="6" y2="8" />
                <line x1="10" y1="8" x2="10" y2="8" />
                <line x1="14" y1="8" x2="14" y2="8" />
                <line x1="18" y1="8" x2="18" y2="8" />
                <line x1="6" y1="12" x2="6" y2="12" />
                <line x1="10" y1="12" x2="10" y2="12" />
                <line x1="14" y1="12" x2="14" y2="12" />
                <line x1="18" y1="12" x2="18" y2="12" />
                <line x1="7" y1="16" x2="17" y2="16" />
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
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div class="flex flex-col gap-0.5 overflow-hidden">
              <span class="text-13px font-600 text-app-text-primary">{{ item.label }}</span>
              <span class="text-11px text-app-text-muted truncate">{{ item.desc }}</span>
            </div>
          </button>
        </nav>
      </aside>

      <!-- 2. 右侧卡片化内容区 (Grouped Bento Cards) -->
      <main class="flex-1 min-w-0">
        <!-- 1. 常规与外观 -->
        <section v-if="activeTab === 'general'" class="flex flex-col">
          <div class="bg-app-bg-surface border border-app-border rounded-14px p-6 shadow-sm">
            <div class="mb-5 pb-3 border-b border-app-border-subtle">
              <h3 class="text-16px font-600 m-0 mb-1 text-app-text-primary">
                {{ t("settingsView.general.cardTitle") }}
              </h3>
              <p class="text-13px text-app-text-secondary m-0">
                {{ t("settingsView.general.cardDesc") }}
              </p>
            </div>

            <div class="flex justify-between items-center py-3.5 border-b border-app-border-subtle">
              <div class="flex flex-col gap-0.75">
                <span class="text-14px font-500 text-app-text-primary">{{
                  t("settingsView.general.localeLabel")
                }}</span>
                <span class="text-12px text-app-text-muted leading-relaxed">{{
                  t("settingsView.general.localeHint")
                }}</span>
              </div>
              <div>
                <n-select
                  v-model:value="form.locale"
                  :options="localeOptions"
                  style="width: 180px"
                  @update:value="onLocaleChange"
                />
              </div>
            </div>

            <div
              class="flex justify-between items-center py-3.5 border-b border-app-border-subtle last:border-b-none last:pb-0"
            >
              <div class="flex flex-col gap-0.75">
                <span class="text-14px font-500 text-app-text-primary">{{
                  t("settingsView.general.themeLabel")
                }}</span>
                <span class="text-12px text-app-text-muted leading-relaxed">{{
                  t("settingsView.general.themeHint")
                }}</span>
              </div>
              <div>
                <n-radio-group
                  v-model:value="form.theme"
                  size="medium"
                  @update:value="onThemeChange"
                >
                  <n-radio-button value="system">{{ t("theme.system") }}</n-radio-button>
                  <n-radio-button value="light">{{ t("theme.light") }}</n-radio-button>
                  <n-radio-button value="dark">{{ t("theme.dark") }}</n-radio-button>
                </n-radio-group>
              </div>
            </div>
          </div>
        </section>

        <!-- 2. 桌面与启动 -->
        <section v-else-if="activeTab === 'system'" class="flex flex-col">
          <div class="bg-app-bg-surface border border-app-border rounded-14px p-6 shadow-sm">
            <div class="mb-5 pb-3 border-b border-app-border-subtle">
              <h3 class="text-16px font-600 m-0 mb-1 text-app-text-primary">
                {{ t("settingsView.system.cardTitle") }}
              </h3>
              <p class="text-13px text-app-text-secondary m-0">
                {{ t("settingsView.system.cardDesc") }}
              </p>
            </div>

            <div class="flex justify-between items-center py-3.5 border-b border-app-border-subtle">
              <div class="flex flex-col gap-0.75">
                <span class="text-14px font-500 text-app-text-primary">{{
                  t("settingsView.system.closeToTrayLabel")
                }}</span>
                <span class="text-12px text-app-text-muted leading-relaxed">{{
                  t("settingsView.system.closeToTrayHint")
                }}</span>
              </div>
              <div>
                <n-switch v-model:value="form.closeToTray" @update:value="saveForm" />
              </div>
            </div>

            <div class="flex justify-between items-center py-3.5 border-b border-app-border-subtle">
              <div class="flex flex-col gap-0.75">
                <span class="text-14px font-500 text-app-text-primary">{{
                  t("settingsView.system.autoStartLabel")
                }}</span>
                <span class="text-12px text-app-text-muted leading-relaxed">{{
                  t("settingsView.system.autoStartHint")
                }}</span>
              </div>
              <div>
                <n-switch v-model:value="form.autoStart" @update:value="saveForm" />
              </div>
            </div>

            <div
              class="flex justify-between items-center py-3.5 border-b border-app-border-subtle last:border-b-none last:pb-0"
            >
              <div class="flex flex-col gap-0.75">
                <span class="text-14px font-500 text-app-text-primary">{{
                  t("settingsView.system.hardwareAccelerationLabel")
                }}</span>
                <span class="text-12px text-app-text-muted leading-relaxed">{{
                  t("settingsView.system.hardwareAccelerationHint")
                }}</span>
              </div>
              <div>
                <n-switch v-model:value="form.hardwareAcceleration" @update:value="saveForm" />
              </div>
            </div>
          </div>
        </section>

        <!-- 3. 存储与传输 -->
        <section v-else-if="activeTab === 'download'" class="flex flex-col">
          <div class="bg-app-bg-surface border border-app-border rounded-14px p-6 shadow-sm">
            <div class="mb-5 pb-3 border-b border-app-border-subtle">
              <h3 class="text-16px font-600 m-0 mb-1 text-app-text-primary">
                {{ t("settingsView.download.cardTitle") }}
              </h3>
              <p class="text-13px text-app-text-secondary m-0">
                {{ t("settingsView.download.cardDesc") }}
              </p>
            </div>

            <div
              class="flex flex-col items-stretch gap-2.5 py-3.5 border-b border-app-border-subtle"
            >
              <div class="flex flex-col gap-0.75">
                <span class="text-14px font-500 text-app-text-primary">{{
                  t("settingsView.download.dirLabel")
                }}</span>
                <span class="text-12px text-app-text-muted leading-relaxed">{{
                  t("settingsView.download.dirHint")
                }}</span>
              </div>
              <div class="flex items-center gap-2">
                <n-input
                  v-model:value="form.defaultDownloadDir"
                  :placeholder="t('settingsView.download.placeholder')"
                  readonly
                  class="flex-1"
                />
                <n-button secondary @click="handleSelectDownloadDir">
                  {{ t("settingsView.download.changeDirBtn") }}
                </n-button>
                <n-button v-if="form.defaultDownloadDir" quaternary @click="resetDownloadDir">
                  {{ t("settingsView.download.resetDirBtn") }}
                </n-button>
              </div>
            </div>

            <div
              class="flex flex-col items-stretch gap-2.5 py-3.5 border-b border-app-border-subtle"
            >
              <div class="flex justify-between items-center">
                <div>
                  <span class="text-14px font-500 text-app-text-primary">{{
                    t("settingsView.download.concurrencyLabel")
                  }}</span>
                  <span class="text-12px text-app-text-muted leading-relaxed block">{{
                    t("settingsView.download.concurrencyHint")
                  }}</span>
                </div>
                <n-tag type="info" size="small" round>
                  {{
                    t("settingsView.download.concurrencyUnit", { count: form.downloadConcurrency })
                  }}
                </n-tag>
              </div>
              <div class="px-3 py-2">
                <n-slider
                  v-model:value="form.downloadConcurrency"
                  :min="1"
                  :max="50"
                  :step="1"
                  :marks="{
                    1: '1',
                    10: t('settingsView.download.concurrencyRecommend'),
                    25: '25',
                    50: '50',
                  }"
                  @update:value="saveForm"
                />
              </div>
            </div>

            <div
              class="flex justify-between items-center py-3.5 border-b border-app-border-subtle last:border-b-none last:pb-0"
            >
              <div class="flex flex-col gap-0.75">
                <span class="text-14px font-500 text-app-text-primary">{{
                  t("settingsView.download.autoResumeLabel")
                }}</span>
                <span class="text-12px text-app-text-muted leading-relaxed">{{
                  t("settingsView.download.autoResumeHint")
                }}</span>
              </div>
              <div>
                <n-switch v-model:value="form.autoResumeDownloads" @update:value="saveForm" />
              </div>
            </div>
          </div>
        </section>

        <!-- 4. 桌面通知 -->
        <section v-else-if="activeTab === 'notification'" class="flex flex-col">
          <div class="bg-app-bg-surface border border-app-border rounded-14px p-6 shadow-sm">
            <div class="mb-5 pb-3 border-b border-app-border-subtle">
              <h3 class="text-16px font-600 m-0 mb-1 text-app-text-primary">
                {{ t("settingsView.notification.cardTitle") }}
              </h3>
              <p class="text-13px text-app-text-secondary m-0">
                {{ t("settingsView.notification.cardDesc") }}
              </p>
            </div>

            <div class="flex justify-between items-center py-3.5 border-b border-app-border-subtle">
              <div class="flex flex-col gap-0.75">
                <span class="text-14px font-500 text-app-text-primary">{{
                  t("settingsView.notification.enableLabel")
                }}</span>
                <span class="text-12px text-app-text-muted leading-relaxed">{{
                  t("settingsView.notification.enableHint")
                }}</span>
              </div>
              <div>
                <n-switch v-model:value="form.notificationsEnabled" @update:value="saveForm" />
              </div>
            </div>

            <div
              class="flex justify-between items-center py-3.5 border-b border-app-border-subtle last:border-b-none last:pb-0"
            >
              <div class="flex flex-col gap-0.75">
                <span class="text-14px font-500 text-app-text-primary">{{
                  t("settingsView.notification.silentLabel")
                }}</span>
                <span class="text-12px text-app-text-muted leading-relaxed">{{
                  t("settingsView.notification.silentHint")
                }}</span>
              </div>
              <div>
                <n-switch
                  v-model:value="form.silentNotifications"
                  :disabled="!form.notificationsEnabled"
                  @update:value="saveForm"
                />
              </div>
            </div>
          </div>
        </section>

        <!-- 5. 全局快捷键 -->
        <section v-else-if="activeTab === 'shortcut'" class="flex flex-col">
          <GlobalShortcutManager />
        </section>

        <!-- 6. 诊断与关于 -->
        <section v-else-if="activeTab === 'diagnostics'" class="flex flex-col">
          <!-- 硬件与内核信息卡片 -->
          <div class="bg-app-bg-surface border border-app-border rounded-14px p-6 shadow-sm">
            <div
              class="mb-5 pb-3 border-b border-app-border-subtle flex justify-between items-center"
            >
              <div>
                <h3 class="text-16px font-600 m-0 mb-1 text-app-text-primary">
                  {{ t("settingsView.diagnostics.cardTitle") }}
                </h3>
                <p class="text-13px text-app-text-secondary m-0">
                  {{ t("settingsView.diagnostics.cardDesc") }}
                </p>
              </div>
              <n-button
                size="small"
                secondary
                :loading="loadingDiagnostics"
                @click="loadDiagnostics"
              >
                {{ t("settingsView.diagnostics.refreshBtn") }}
              </n-button>
            </div>

            <div
              v-if="diagnostics"
              class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 mb-4"
            >
              <div
                class="bg-app-bg-subtle border border-app-border-subtle rounded-lg p-3 flex flex-col gap-1"
              >
                <span class="text-11px text-app-text-muted">{{
                  t("settingsView.diagnostics.os")
                }}</span>
                <span class="text-13px font-600 text-app-text-regular"
                  >{{ diagnostics.osPlatform || "Unknown" }} ({{
                    diagnostics.osArch || "Unknown"
                  }})</span
                >
              </div>
              <div
                class="bg-app-bg-subtle border border-app-border-subtle rounded-lg p-3 flex flex-col gap-1"
              >
                <span class="text-11px text-app-text-muted">{{
                  t("settingsView.diagnostics.osVersion")
                }}</span>
                <span class="text-13px font-600 text-app-text-regular">{{
                  diagnostics.osRelease || "N/A"
                }}</span>
              </div>
              <div
                class="bg-app-bg-subtle border border-app-border-subtle rounded-lg p-3 flex flex-col gap-1"
              >
                <span class="text-11px text-app-text-muted">{{
                  t("settingsView.diagnostics.appVersion")
                }}</span>
                <span class="text-13px font-600 text-app-text-regular"
                  >v{{ diagnostics.appVersion || "0.1.4" }}</span
                >
              </div>
              <div
                class="bg-app-bg-subtle border border-app-border-subtle rounded-lg p-3 flex flex-col gap-1"
              >
                <span class="text-11px text-app-text-muted">{{
                  t("settingsView.diagnostics.electronVer")
                }}</span>
                <span class="text-13px font-600 text-app-text-regular">{{
                  diagnostics.electronVersion ? `v${diagnostics.electronVersion}` : "N/A (Browser)"
                }}</span>
              </div>
              <div
                class="bg-app-bg-subtle border border-app-border-subtle rounded-lg p-3 flex flex-col gap-1"
              >
                <span class="text-11px text-app-text-muted">{{
                  t("settingsView.diagnostics.nodeVer")
                }}</span>
                <span class="text-13px font-600 text-app-text-regular">{{
                  diagnostics.nodeVersion ? `v${diagnostics.nodeVersion}` : "N/A"
                }}</span>
              </div>
              <div
                class="bg-app-bg-subtle border border-app-border-subtle rounded-lg p-3 flex flex-col gap-1"
              >
                <span class="text-11px text-app-text-muted">{{
                  t("settingsView.diagnostics.chromeVer")
                }}</span>
                <span class="text-13px font-600 text-app-text-regular">{{
                  diagnostics.chromeVersion ? `v${diagnostics.chromeVersion}` : "N/A"
                }}</span>
              </div>
              <div
                class="bg-app-bg-subtle border border-app-border-subtle rounded-lg p-3 flex flex-col gap-1"
              >
                <span class="text-11px text-app-text-muted">{{
                  t("settingsView.diagnostics.memoryRss")
                }}</span>
                <span class="text-13px font-600 text-app-text-regular">{{
                  diagnostics.totalMemoryMb
                    ? `${Math.round(diagnostics.totalMemoryMb - diagnostics.freeMemoryMb)} / ${diagnostics.totalMemoryMb} MB`
                    : "N/A"
                }}</span>
              </div>
              <div
                class="bg-app-bg-subtle border border-app-border-subtle rounded-lg p-3 flex flex-col gap-1"
              >
                <span class="text-11px text-app-text-muted">{{
                  t("settingsView.diagnostics.uptime")
                }}</span>
                <span class="text-13px font-600 text-app-text-regular">{{
                  formatUptime(diagnostics.uptimeSeconds)
                }}</span>
              </div>
            </div>

            <div class="pt-2">
              <n-button secondary type="info" :loading="exportingLogs" @click="handleExportLogs">
                {{ t("settingsView.diagnostics.exportLogsBtn") }}
              </n-button>
            </div>
          </div>

          <!-- 关于与版本升级卡片 -->
          <div class="bg-app-bg-surface border border-app-border rounded-14px p-6 shadow-sm mt-4">
            <div class="flex items-center gap-5">
              <div
                class="w-16 h-16 rounded-2xl bg-app-bg-subtle border border-app-border flex items-center justify-center flex-shrink-0"
              >
                <svg viewBox="0 0 28 28" width="48" height="48" fill="none">
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
                  <polygon points="14,24 4,6 8.5,6 14,16 19.5,6 24,6" fill="#42d392" />
                  <polygon points="14,19.5 8,6 11.5,6 14,11 16.5,6 20,6" fill="#38bdf8" />
                  <circle cx="23" cy="11" r="1.6" fill="#ffffff" />
                </svg>
              </div>
              <div class="flex flex-col gap-1">
                <h4 class="text-16px font-700 m-0 text-app-text-primary">
                  {{ t("settingsView.diagnostics.aboutTitle") }}
                </h4>
                <p class="text-12px text-app-text-muted m-0 mb-1.5">
                  {{ t("settingsView.diagnostics.aboutDesc") }}
                </p>
                <div class="flex items-center gap-2">
                  <n-button size="small" type="primary" secondary @click="handleCheckUpdate">
                    {{ t("settingsView.diagnostics.checkUpdateBtn") }}
                  </n-button>
                  <n-button size="small" tertiary @click="openRepo">
                    {{ t("settingsView.diagnostics.openRepoBtn") }}
                  </n-button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
