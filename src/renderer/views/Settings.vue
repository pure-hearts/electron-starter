<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import { type SelectOption } from "naive-ui";
import { useSettingsStore, type SettingsState } from "../stores/settings";
import { useAppStore } from "../stores/app";
import { feedback } from "../utils/feedback";
import GlobalShortcutManager from "../components/GlobalShortcutManager.vue";
import type { SystemDiagnostics } from "../../shared/ipc";

const { t, locale } = useI18n();
const settingsStore = useSettingsStore();
const appStore = useAppStore();

// 侧边栏当前激活 Tab
type SettingsTabKey =
  | "general"
  | "system"
  | "download"
  | "notification"
  | "shortcut"
  | "diagnostics";
const activeTab = ref<SettingsTabKey>("general");

// 侧边栏导航配置（使用 computed 实现语言响应式切换）
const sidebarItems = computed(() => [
  {
    key: "general" as SettingsTabKey,
    label: t("settingsView.sidebar.general"),
    desc: t("settingsView.sidebar.generalDesc"),
    icon: "palette",
  },
  {
    key: "system" as SettingsTabKey,
    label: t("settingsView.sidebar.system"),
    desc: t("settingsView.sidebar.systemDesc"),
    icon: "desktop",
  },
  {
    key: "download" as SettingsTabKey,
    label: t("settingsView.sidebar.download"),
    desc: t("settingsView.sidebar.downloadDesc"),
    icon: "download",
  },
  {
    key: "notification" as SettingsTabKey,
    label: t("settingsView.sidebar.notification"),
    desc: t("settingsView.sidebar.notificationDesc"),
    icon: "bell",
  },
  {
    key: "shortcut" as SettingsTabKey,
    label: t("settingsView.sidebar.shortcut"),
    desc: t("settingsView.sidebar.shortcutDesc"),
    icon: "keyboard",
  },
  {
    key: "diagnostics" as SettingsTabKey,
    label: t("settingsView.sidebar.diagnostics"),
    desc: t("settingsView.sidebar.diagnosticsDesc"),
    icon: "info",
  },
]);

// 响应式表单
const form = reactive<SettingsState>({
  locale: "zh-CN",
  theme: "system",
  closeToTray: false,
  autoStart: false,
  defaultDownloadDir: "",
  downloadConcurrency: 10,
  autoResumeDownloads: true,
  notificationsEnabled: true,
  silentNotifications: false,
  hardwareAcceleration: true,
});

const localeOptions: SelectOption[] = [
  { label: "简体中文 (zh-CN)", value: "zh-CN" },
  { label: "English (en-US)", value: "en-US" },
];

const diagnostics = ref<SystemDiagnostics | null>(null);
const loadingDiagnostics = ref(false);
const exportingLogs = ref(false);

onMounted(async () => {
  await settingsStore.loadSettings();
  Object.assign(form, settingsStore.settings);
  await loadDiagnostics();
});

async function saveForm() {
  await settingsStore.updateSettings(form);
}

async function onLocaleChange(val: string) {
  locale.value = val;
  await appStore.setLocale(val);
  await saveForm();
}

async function onThemeChange(val: "system" | "light" | "dark") {
  await appStore.setTheme(val);
  await saveForm();
}

async function handleSelectDownloadDir() {
  if (typeof window !== "undefined" && window.$ipcBridge) {
    const res = await window.$ipcBridge.invoke("dialog:selectDirectory", {
      title: t("settingsView.download.cardTitle"),
      defaultPath: form.defaultDownloadDir || undefined,
    });
    if (res.success && res.filePath) {
      form.defaultDownloadDir = res.filePath;
      await saveForm();
    }
  } else {
    feedback.message.warning("仅在桌面客户端环境下支持选取本地目录");
  }
}

async function resetDownloadDir() {
  form.defaultDownloadDir = "";
  await saveForm();
}

async function handleSaveAll() {
  await saveForm();
  feedback.message.success(t("settingsView.saveSuccess"));
}

async function loadDiagnostics() {
  loadingDiagnostics.value = true;
  try {
    if (typeof window !== "undefined" && window.$ipcBridge) {
      diagnostics.value = await window.$ipcBridge.invoke("diagnostics:system:get");
    }
  } catch (e) {
    console.warn("Could not fetch diagnostics", e);
  } finally {
    loadingDiagnostics.value = false;
  }
}

async function handleExportLogs() {
  exportingLogs.value = true;
  try {
    if (typeof window !== "undefined" && window.$ipcBridge) {
      const res = await window.$ipcBridge.invoke("diagnostics:exportLogs");
      if (res.success) {
        feedback.message.success(`排障诊断包已成功导出至: ${res.filePath}`);
      } else if (res.error !== "用户取消了导出") {
        feedback.message.error(res.error || "导出失败");
      }
    }
  } catch {
    feedback.message.error("导出过程发生异常");
  } finally {
    exportingLogs.value = false;
  }
}

function formatUptime(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function openRepo() {
  if (typeof window !== "undefined" && window.$ipcBridge) {
    window.$ipcBridge.invoke(
      "shell:openExternal",
      "https://github.com/pure-hearts/electron-starter",
    );
  } else if (typeof window !== "undefined") {
    window.open("https://github.com/pure-hearts/electron-starter", "_blank");
  }
}

function handleCheckUpdate() {
  if (typeof window !== "undefined" && window.$ipcBridge) {
    window.$ipcBridge.invoke("updater:check");
  } else {
    feedback.message.info("Web 预览模式：当前已是最新网页版本");
  }
}
</script>

<template>
  <div class="settings-workspace">
    <!-- 页面顶栏简介 -->
    <div class="settings-header-banner">
      <div class="header-intro">
        <h2 class="workspace-title">{{ t("settingsView.bannerTitle") }}</h2>
        <p class="workspace-subtitle">
          {{ t("settingsView.bannerSubtitle") }}
        </p>
      </div>
      <div class="header-actions">
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
    <div class="settings-layout">
      <!-- 1. 左侧固定侧边分类导航栏 -->
      <aside class="settings-sidebar">
        <nav class="sidebar-nav-list">
          <button
            v-for="item in sidebarItems"
            :key="item.key"
            class="sidebar-nav-btn"
            :class="{ 'is-active': activeTab === item.key }"
            @click="activeTab = item.key"
          >
            <div class="sidebar-icon-box">
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
            <div class="sidebar-text-box">
              <span class="nav-title">{{ item.label }}</span>
              <span class="nav-desc">{{ item.desc }}</span>
            </div>
          </button>
        </nav>
      </aside>

      <!-- 2. 右侧卡片化内容区 (Grouped Bento Cards) -->
      <main class="settings-content">
        <!-- 1. 常规与外观 -->
        <section v-if="activeTab === 'general'" class="settings-section">
          <div class="section-card">
            <div class="card-header">
              <h3 class="card-title">{{ t("settingsView.general.cardTitle") }}</h3>
              <p class="card-desc">{{ t("settingsView.general.cardDesc") }}</p>
            </div>

            <div class="setting-row">
              <div class="setting-meta">
                <span class="meta-label">{{ t("settingsView.general.localeLabel") }}</span>
                <span class="meta-hint">{{ t("settingsView.general.localeHint") }}</span>
              </div>
              <div class="setting-ctrl">
                <n-select
                  v-model:value="form.locale"
                  :options="localeOptions"
                  style="width: 180px"
                  @update:value="onLocaleChange"
                />
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-meta">
                <span class="meta-label">{{ t("settingsView.general.themeLabel") }}</span>
                <span class="meta-hint">{{ t("settingsView.general.themeHint") }}</span>
              </div>
              <div class="setting-ctrl">
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
        <section v-else-if="activeTab === 'system'" class="settings-section">
          <div class="section-card">
            <div class="card-header">
              <h3 class="card-title">{{ t("settingsView.system.cardTitle") }}</h3>
              <p class="card-desc">{{ t("settingsView.system.cardDesc") }}</p>
            </div>

            <div class="setting-row">
              <div class="setting-meta">
                <span class="meta-label">{{ t("settingsView.system.closeToTrayLabel") }}</span>
                <span class="meta-hint">{{ t("settingsView.system.closeToTrayHint") }}</span>
              </div>
              <div class="setting-ctrl">
                <n-switch v-model:value="form.closeToTray" @update:value="saveForm" />
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-meta">
                <span class="meta-label">{{ t("settingsView.system.autoStartLabel") }}</span>
                <span class="meta-hint">{{ t("settingsView.system.autoStartHint") }}</span>
              </div>
              <div class="setting-ctrl">
                <n-switch v-model:value="form.autoStart" @update:value="saveForm" />
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-meta">
                <span class="meta-label">{{
                  t("settingsView.system.hardwareAccelerationLabel")
                }}</span>
                <span class="meta-hint">{{
                  t("settingsView.system.hardwareAccelerationHint")
                }}</span>
              </div>
              <div class="setting-ctrl">
                <n-switch v-model:value="form.hardwareAcceleration" @update:value="saveForm" />
              </div>
            </div>
          </div>
        </section>

        <!-- 3. 存储与传输 -->
        <section v-else-if="activeTab === 'download'" class="settings-section">
          <div class="section-card">
            <div class="card-header">
              <h3 class="card-title">{{ t("settingsView.download.cardTitle") }}</h3>
              <p class="card-desc">{{ t("settingsView.download.cardDesc") }}</p>
            </div>

            <div class="setting-row column-layout">
              <div class="setting-meta">
                <span class="meta-label">{{ t("settingsView.download.dirLabel") }}</span>
                <span class="meta-hint">{{ t("settingsView.download.dirHint") }}</span>
              </div>
              <div class="path-input-group">
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

            <div class="setting-row column-layout">
              <div class="setting-meta flex-between">
                <div>
                  <span class="meta-label">{{ t("settingsView.download.concurrencyLabel") }}</span>
                  <span class="meta-hint">{{ t("settingsView.download.concurrencyHint") }}</span>
                </div>
                <n-tag type="info" size="small" round>
                  {{
                    t("settingsView.download.concurrencyUnit", { count: form.downloadConcurrency })
                  }}
                </n-tag>
              </div>
              <div class="slider-wrapper">
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

            <div class="setting-row">
              <div class="setting-meta">
                <span class="meta-label">{{ t("settingsView.download.autoResumeLabel") }}</span>
                <span class="meta-hint">{{ t("settingsView.download.autoResumeHint") }}</span>
              </div>
              <div class="setting-ctrl">
                <n-switch v-model:value="form.autoResumeDownloads" @update:value="saveForm" />
              </div>
            </div>
          </div>
        </section>

        <!-- 4. 桌面通知 -->
        <section v-else-if="activeTab === 'notification'" class="settings-section">
          <div class="section-card">
            <div class="card-header">
              <h3 class="card-title">{{ t("settingsView.notification.cardTitle") }}</h3>
              <p class="card-desc">{{ t("settingsView.notification.cardDesc") }}</p>
            </div>

            <div class="setting-row">
              <div class="setting-meta">
                <span class="meta-label">{{ t("settingsView.notification.enableLabel") }}</span>
                <span class="meta-hint">{{ t("settingsView.notification.enableHint") }}</span>
              </div>
              <div class="setting-ctrl">
                <n-switch v-model:value="form.notificationsEnabled" @update:value="saveForm" />
              </div>
            </div>

            <div class="setting-row">
              <div class="setting-meta">
                <span class="meta-label">{{ t("settingsView.notification.silentLabel") }}</span>
                <span class="meta-hint">{{ t("settingsView.notification.silentHint") }}</span>
              </div>
              <div class="setting-ctrl">
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
        <section v-else-if="activeTab === 'shortcut'" class="settings-section">
          <GlobalShortcutManager />
        </section>

        <!-- 6. 诊断与关于 -->
        <section v-else-if="activeTab === 'diagnostics'" class="settings-section">
          <!-- 硬件与内核信息卡片 -->
          <div class="section-card">
            <div class="card-header flex-between">
              <div>
                <h3 class="card-title">{{ t("settingsView.diagnostics.cardTitle") }}</h3>
                <p class="card-desc">{{ t("settingsView.diagnostics.cardDesc") }}</p>
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

            <div v-if="diagnostics" class="diagnostics-grid">
              <div class="diag-cell">
                <span class="cell-label">{{ t("settingsView.diagnostics.os") }}</span>
                <span class="cell-val"
                  >{{ diagnostics.osPlatform || "Unknown" }} ({{
                    diagnostics.osArch || "Unknown"
                  }})</span
                >
              </div>
              <div class="diag-cell">
                <span class="cell-label">{{ t("settingsView.diagnostics.osVersion") }}</span>
                <span class="cell-val">{{ diagnostics.osRelease || "N/A" }}</span>
              </div>
              <div class="diag-cell">
                <span class="cell-label">{{ t("settingsView.diagnostics.appVersion") }}</span>
                <span class="cell-val">v{{ diagnostics.appVersion || "0.1.4" }}</span>
              </div>
              <div class="diag-cell">
                <span class="cell-label">{{ t("settingsView.diagnostics.electronVer") }}</span>
                <span class="cell-val">{{
                  diagnostics.electronVersion ? `v${diagnostics.electronVersion}` : "N/A (Browser)"
                }}</span>
              </div>
              <div class="diag-cell">
                <span class="cell-label">{{ t("settingsView.diagnostics.nodeVer") }}</span>
                <span class="cell-val">{{
                  diagnostics.nodeVersion ? `v${diagnostics.nodeVersion}` : "N/A"
                }}</span>
              </div>
              <div class="diag-cell">
                <span class="cell-label">{{ t("settingsView.diagnostics.chromeVer") }}</span>
                <span class="cell-val">{{
                  diagnostics.chromeVersion ? `v${diagnostics.chromeVersion}` : "N/A"
                }}</span>
              </div>
              <div class="diag-cell">
                <span class="cell-label">{{ t("settingsView.diagnostics.memoryRss") }}</span>
                <span class="cell-val">{{
                  diagnostics.totalMemoryMb
                    ? `${Math.round(diagnostics.totalMemoryMb - diagnostics.freeMemoryMb)} / ${diagnostics.totalMemoryMb} MB`
                    : "N/A"
                }}</span>
              </div>
              <div class="diag-cell">
                <span class="cell-label">{{ t("settingsView.diagnostics.uptime") }}</span>
                <span class="cell-val">{{ formatUptime(diagnostics.uptimeSeconds) }}</span>
              </div>
            </div>

            <div class="diag-actions-row">
              <n-button secondary type="info" :loading="exportingLogs" @click="handleExportLogs">
                {{ t("settingsView.diagnostics.exportLogsBtn") }}
              </n-button>
            </div>
          </div>

          <!-- 关于与版本升级卡片 -->
          <div class="section-card" style="margin-top: 16px">
            <div class="about-hero-box">
              <div class="about-logo-wrapper">
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
              <div class="about-meta">
                <h4 class="about-name">{{ t("settingsView.diagnostics.aboutTitle") }}</h4>
                <p class="about-version">
                  {{ t("settingsView.diagnostics.aboutDesc") }}
                </p>
                <div class="about-buttons">
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

<style scoped>
.settings-workspace {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 顶部简介横幅 */
.settings-header-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--app-bg-surface);
  border: 1px solid var(--app-border);
  border-radius: 14px;
  padding: 20px 24px;
  box-shadow: var(--app-shadow-sm);
}

.workspace-title {
  font-size: 20px;
  font-weight: 700;
  margin: 0 0 4px 0;
  color: var(--app-text-primary);
  letter-spacing: -0.01em;
}

.workspace-subtitle {
  font-size: 13px;
  color: var(--app-text-secondary);
  margin: 0;
}

/* 两栏布局 */
.settings-layout {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

/* 1. 左侧分类侧边栏 */
.settings-sidebar {
  width: 230px;
  flex-shrink: 0;
  background: var(--app-bg-surface);
  border: 1px solid var(--app-border);
  border-radius: 14px;
  padding: 10px;
  box-shadow: var(--app-shadow-sm);
  position: sticky;
  top: 60px;
}

.sidebar-nav-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar-nav-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  color: var(--app-text-secondary);
}

.sidebar-nav-btn:hover {
  background: var(--app-bg-hover);
  color: var(--app-text-primary);
}

.sidebar-nav-btn.is-active {
  background: var(--app-bg-subtle);
  color: var(--app-primary);
  box-shadow: var(--app-shadow-sm);
  border: 1px solid var(--app-border-subtle);
}

.sidebar-icon-box {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--app-bg-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sidebar-nav-btn.is-active .sidebar-icon-box {
  background: rgba(37, 99, 235, 0.12);
  color: var(--app-primary);
}

.sidebar-text-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow: hidden;
}

.nav-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.nav-desc {
  font-size: 11px;
  color: var(--app-text-muted);
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

/* 2. 右侧卡片内容区 */
.settings-content {
  flex: 1;
  min-width: 0;
}

.settings-section {
  display: flex;
  flex-direction: column;
}

.section-card {
  background: var(--app-bg-surface);
  border: 1px solid var(--app-border);
  border-radius: 14px;
  padding: 24px;
  box-shadow: var(--app-shadow-sm);
}

.card-header {
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--app-border-subtle);
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--app-text-primary);
}

.card-desc {
  font-size: 13px;
  color: var(--app-text-secondary);
  margin: 0;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--app-border-subtle);
}

.setting-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.setting-row.column-layout {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}

.setting-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.meta-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--app-text-primary);
}

.meta-hint {
  font-size: 12px;
  color: var(--app-text-muted);
  line-height: 1.4;
}

.path-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.slider-wrapper {
  padding: 8px 12px;
}

.flex-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 诊断栅格 */
.diagnostics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.diag-cell {
  background: var(--app-bg-subtle);
  border: 1px solid var(--app-border-subtle);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cell-label {
  font-size: 11px;
  color: var(--app-text-muted);
}

.cell-val {
  font-size: 13px;
  font-weight: 600;
  color: var(--app-text-regular);
}

.diag-actions-row {
  padding-top: 8px;
}

/* 关于应用卡片 */
.about-hero-box {
  display: flex;
  align-items: center;
  gap: 20px;
}

.about-logo-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: var(--app-bg-subtle);
  border: 1px solid var(--app-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.about-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.about-name {
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  color: var(--app-text-primary);
}

.about-version {
  font-size: 12px;
  color: var(--app-text-muted);
  margin: 0 0 6px 0;
}

.about-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 820px) {
  .settings-layout {
    flex-direction: column;
  }
  .settings-sidebar {
    width: 100%;
    position: static;
  }
}
</style>
