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
    class="window-titlebar"
    :class="{
      'platform-mac': isMac && isElectron,
      'platform-win': isWindows && isElectron,
      'platform-linux': isLinux && isElectron,
      'is-web': isWeb,
      'is-maximized': appStore.isMaximized,
    }"
    @dblclick="handleDblClick"
  >
    <!-- ================= 1. 左侧区域 ================= -->
    <!-- macOS 桌面客户端: 留白 76px 给原生交通灯 -->
    <div v-if="isMac && isElectron" class="mac-native-traffic-spacer no-drag" />

    <!-- 现代 Electron + Vue 品牌 Logo 与标题 (在所有平台均清晰显示) -->
    <div class="titlebar-brand no-drag" @click="navigateTo('/')">
      <div class="brand-icon-wrapper">
        <!-- 现代 Electron + Vue 融合创意 SVG -->
        <svg viewBox="0 0 28 28" width="18" height="18" fill="none" class="brand-svg">
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
      <span class="brand-text">electron-vue-template</span>
      <span class="brand-version-badge">Vue+</span>
    </div>

    <!-- ================= 2. 顶栏中间胶囊主导航 (Pill Tabs) ================= -->
    <nav class="titlebar-nav no-drag">
      <button
        v-for="item in navItems"
        :key="item.id"
        class="nav-pill-btn"
        :class="{ 'is-active': isNavActive(item) }"
        @click="navigateTo(item.path, item.query)"
      >
        {{ item.label }}
      </button>
    </nav>

    <!-- 中间窗口平滑拖拽区 -->
    <div class="titlebar-drag-area" />

    <!-- ================= 3. 右侧功能操作区 ================= -->
    <div class="titlebar-actions no-drag">
      <!-- 下载传输中心按钮 (带 Badge) -->
      <button
        class="action-icon-btn"
        :class="{ 'has-active': downloadStore.activeCount > 0 }"
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
        <span v-if="downloadStore.activeCount > 0" class="action-badge">
          {{ downloadStore.activeCount }}
        </span>
      </button>

      <!-- 外观主题切换 (跟随系统 / 浅色 / 深色) -->
      <button
        class="action-icon-btn"
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
        class="action-pill-btn"
        :title="t('header.localeToggle')"
        :aria-label="t('header.localeToggle')"
        @click="toggleLocale"
      >
        {{ locale === "zh-CN" ? "中" : "EN" }}
      </button>

      <!-- ================= 4. 平台特色窗口控制按钮 (仅桌面 Electron 渲染) ================= -->
      <template v-if="isElectron">
        <!-- A. Windows 平台: 贴边 Fluent 风格矩形无边框三键 -->
        <div v-if="isWindows" class="win-controls">
          <button
            class="win-ctrl-btn minimize"
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
            class="win-ctrl-btn maximize"
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
            class="win-ctrl-btn close"
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
        <div v-else-if="isLinux" class="linux-controls">
          <button
            class="linux-badge-btn minimize"
            :title="t('header.minimize')"
            :aria-label="t('header.minimize')"
            @click="handleMinimize"
          >
            <svg viewBox="0 0 12 12" width="8" height="8">
              <line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.4" />
            </svg>
          </button>

          <button
            class="linux-badge-btn maximize"
            :title="appStore.isMaximized ? t('header.restore') : t('header.maximize')"
            :aria-label="appStore.isMaximized ? t('header.restore') : t('header.maximize')"
            @click="handleToggleMaximize"
          >
            <svg viewBox="0 0 12 12" width="8" height="8" fill="none">
              <rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1.4" />
            </svg>
          </button>

          <button
            class="linux-badge-btn close"
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

<style scoped>
.window-titlebar {
  display: flex;
  align-items: center;
  height: 44px;
  background: var(--app-bg-surface);
  border-bottom: 1px solid var(--app-border);
  color: var(--app-text-secondary);
  font-size: 13px;
  user-select: none;
  -webkit-app-region: drag;
  position: sticky;
  top: 0;
  z-index: 50;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
  padding: 0 8px;
}

/* Windows 桌面模式右侧控件贴满右边界 */
.window-titlebar.platform-win {
  padding-right: 0;
}

/* Web 模式下取消窗口拖拽属性，光标保持正常指针 */
.window-titlebar.is-web {
  -webkit-app-region: no-drag;
}

.no-drag {
  -webkit-app-region: no-drag;
}

/* 1. macOS 桌面端左侧原生红绿灯留白 */
.mac-native-traffic-spacer {
  width: 76px;
  height: 100%;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

/* 品牌 Logo */
.titlebar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  height: 100%;
  cursor: pointer;
  flex-shrink: 0;
}

.brand-icon-wrapper {
  display: flex;
  align-items: center;
}

.brand-text {
  font-weight: 600;
  font-size: 13px;
  color: var(--app-text-primary);
  letter-spacing: -0.01em;
}

.brand-version-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 9999px;
  background: rgba(66, 211, 146, 0.15);
  color: #10b981;
  border: 1px solid rgba(66, 211, 146, 0.3);
}

/* 胶囊导航 */
.titlebar-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 6px;
  background: var(--app-bg-subtle);
  padding: 3px;
  border-radius: 8px;
  border: 1px solid var(--app-border-subtle);
}

.nav-pill-btn {
  border: none;
  background: transparent;
  color: var(--app-text-secondary);
  font-size: 12px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-pill-btn:hover {
  color: var(--app-text-primary);
  background: var(--app-bg-hover);
}

.nav-pill-btn.is-active {
  background: var(--app-bg-surface);
  color: var(--app-primary);
  font-weight: 600;
  box-shadow: var(--app-shadow-sm);
}

.titlebar-drag-area {
  flex: 1;
  height: 100%;
  -webkit-app-region: drag;
}

.titlebar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 100%;
}

.action-icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-icon-btn:hover {
  background: var(--app-bg-hover);
  color: var(--app-text-primary);
}

.action-pill-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid var(--app-border);
  background: var(--app-bg-subtle);
  color: var(--app-text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-pill-btn:hover {
  background: var(--app-bg-hover);
  color: var(--app-text-primary);
  border-color: var(--app-border-focus);
}

.action-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  background: var(--app-primary);
  color: #ffffff;
  font-size: 9px;
  font-weight: 700;
  height: 14px;
  min-width: 14px;
  line-height: 14px;
  text-align: center;
  border-radius: 9999px;
  padding: 0 3px;
  box-shadow: 0 0 0 1.5px var(--app-bg-surface);
}

/* ================= 桌面端平台窗口控件样式 ================= */

/* Windows: 经典 Fluent 贴边矩形控件 */
.win-controls {
  display: flex;
  align-items: center;
  height: 100%;
  margin-left: 6px;
}

.win-ctrl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
  transition:
    background-color 0.1s ease,
    color 0.1s ease;
}

.win-ctrl-btn:hover {
  background-color: var(--app-bg-muted);
  color: var(--app-text-primary);
}

.win-ctrl-btn.close:hover {
  background-color: #e81123 !important;
  color: #ffffff !important;
}

.win-ctrl-btn.close:active {
  background-color: #c42b1c !important;
  color: #ffffff !important;
}

/* Linux: 现代 GNOME / Adwaita 独立圆形徽章三键 */
.linux-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px 0 10px;
  height: 100%;
}

.linux-badge-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--app-border);
  background: var(--app-bg-subtle);
  color: var(--app-text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.15s ease;
}

.linux-badge-btn:hover {
  background: var(--app-bg-hover);
  color: var(--app-text-primary);
  border-color: var(--app-border-focus);
  transform: scale(1.05);
}

.linux-badge-btn.close:hover {
  background: #ef4444;
  color: #ffffff;
  border-color: #ef4444;
}

.linux-badge-btn:active {
  transform: scale(0.94);
}
</style>
