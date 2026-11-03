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
  <div class="home-container">
    <!-- 1. Hero 欢迎与状态顶卡 -->
    <div class="hero-banner">
      <div class="hero-bg-glow" />
      <div class="hero-content">
        <div class="hero-header-row">
          <div class="hero-badge-group">
            <span class="status-pill" :class="isOnline ? 'online' : 'offline'">
              <span class="pulse-dot" />
              {{ isOnline ? t("homeView.online") : t("homeView.offline") }}
            </span>
            <span class="env-pill">
              {{ isElectron ? t("homeView.desktopEnv") : t("homeView.webEnv") }}
            </span>
          </div>
          <span class="version-tag">{{ t("homeView.versionBadge") }}</span>
        </div>

        <h1 class="hero-title">
          {{ t("homeView.heroTitlePrefix") }}
          <span class="gradient-text">Electron + Vue 3</span>
          {{ t("homeView.heroTitleSuffix") }}
        </h1>

        <p class="hero-desc">
          {{ t("homeView.heroDesc") }}
        </p>

        <div class="hero-actions">
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
      <div class="hero-specs-card">
        <div class="spec-row">
          <span class="spec-label">{{ t("homeView.specs.hostOs") }}</span>
          <span class="spec-val">{{ osLabel }}</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">{{ t("homeView.specs.runtimeCore") }}</span>
          <span class="spec-val">{{ t("homeView.specs.runtimeCoreVal") }}</span>
        </div>
        <div class="spec-row">
          <span class="spec-label">{{ t("homeView.specs.activeTasks") }}</span>
          <span class="spec-val spec-highlight">
            {{ t("homeView.specs.activeTasksCount", { count: downloadStore.activeCount }) }}
          </span>
        </div>
        <div class="spec-row">
          <span class="spec-label">{{ t("homeView.specs.appearance") }}</span>
          <span class="spec-val">{{ t("theme." + appStore.theme) }}</span>
        </div>
      </div>
    </div>

    <!-- 2. Bento Grid 现代化磁贴矩阵 -->
    <div class="bento-grid">
      <!-- 磁贴 1: 功能测试中心 (Playground) 跨度 8 列 -->
      <div class="col-span-8 bento-card feature-lab-card" @click="router.push('/playground')">
        <div class="bento-card-header">
          <div class="icon-bubble lab-icon">
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
            <h3 class="bento-title">{{ t("homeView.bento.labTitle") }}</h3>
            <span class="bento-subtitle">{{ t("homeView.bento.labSubtitle") }}</span>
          </div>
        </div>

        <p class="bento-desc">
          {{ t("homeView.bento.labDesc") }}
        </p>

        <div class="lab-tags-list">
          <span class="mini-chip">{{ t("homeView.bento.labChips.window") }}</span>
          <span class="mini-chip">{{ t("homeView.bento.labChips.notification") }}</span>
          <span class="mini-chip">{{ t("homeView.bento.labChips.hotUpdate") }}</span>
          <span class="mini-chip">{{ t("homeView.bento.labChips.ipc") }}</span>
          <span class="mini-chip">{{ t("homeView.bento.labChips.shortcut") }}</span>
        </div>
      </div>

      <!-- 磁贴 2: 下载与传输状态 跨度 4 列 -->
      <div class="col-span-4 bento-card transfer-card" @click="downloadStore.toggleDrawer()">
        <div class="bento-card-header">
          <div class="icon-bubble transfer-icon">
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
            <h3 class="bento-title">{{ t("homeView.bento.transferTitle") }}</h3>
            <span class="bento-subtitle">{{ t("homeView.bento.transferSubtitle") }}</span>
          </div>
        </div>

        <div class="transfer-metrics">
          <div class="metric-block">
            <span class="metric-num">{{ downloadStore.activeCount }}</span>
            <span class="metric-text">{{ t("homeView.bento.activeTasksLabel") }}</span>
          </div>
          <div class="metric-block">
            <span class="metric-num">{{ downloadStore.completedCount }}</span>
            <span class="metric-text">{{ t("homeView.bento.completedTasksLabel") }}</span>
          </div>
        </div>

        <n-button block size="small" secondary type="primary" style="margin-top: 12px">
          {{ t("homeView.bento.expandDrawerBtn") }}
        </n-button>
      </div>

      <!-- 磁贴 3: 四层同构架构 跨度 6 列 -->
      <div class="col-span-6 bento-card arch-card">
        <div class="bento-card-header">
          <div class="icon-bubble arch-icon">
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
            <h3 class="bento-title">{{ t("homeView.bento.archTitle") }}</h3>
            <span class="bento-subtitle">{{ t("homeView.bento.archSubtitle") }}</span>
          </div>
        </div>

        <div class="arch-layer-list">
          <div class="layer-item">
            <code class="layer-tag">src/main</code>
            <span class="layer-desc">{{ t("homeView.bento.archMainDesc") }}</span>
          </div>
          <div class="layer-item">
            <code class="layer-tag">src/preload</code>
            <span class="layer-desc">{{ t("homeView.bento.archPreloadDesc") }}</span>
          </div>
          <div class="layer-item">
            <code class="layer-tag">src/renderer</code>
            <span class="layer-desc">{{ t("homeView.bento.archRendererDesc") }}</span>
          </div>
          <div class="layer-item">
            <code class="layer-tag">src/shared</code>
            <span class="layer-desc">{{ t("homeView.bento.archSharedDesc") }}</span>
          </div>
        </div>
      </div>

      <!-- 磁贴 4: 桌面与系统偏好 跨度 6 列 -->
      <div class="col-span-6 bento-card settings-card" @click="router.push('/settings')">
        <div class="bento-card-header">
          <div class="icon-bubble settings-icon">
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
            <h3 class="bento-title">{{ t("homeView.bento.settingsTitle") }}</h3>
            <span class="bento-subtitle">{{ t("homeView.bento.settingsSubtitle") }}</span>
          </div>
        </div>

        <p class="bento-desc">
          {{ t("homeView.bento.settingsDesc") }}
        </p>

        <div class="settings-features-row">
          <span class="feature-tag">{{ t("homeView.bento.settingsTag1") }}</span>
          <span class="feature-tag">{{ t("homeView.bento.settingsTag2") }}</span>
          <span class="feature-tag">{{ t("homeView.bento.settingsTag3") }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 1. Hero 欢迎区 */
.hero-banner {
  position: relative;
  background: var(--app-bg-surface);
  border: 1px solid var(--app-border);
  border-radius: 16px;
  padding: 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 32px;
  overflow: hidden;
  box-shadow: var(--app-shadow-md);
}

.hero-bg-glow {
  position: absolute;
  top: -80px;
  left: -80px;
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, rgba(37, 99, 235, 0.15) 0%, rgba(37, 99, 235, 0) 70%);
  pointer-events: none;
}

.hero-content {
  flex: 1;
  z-index: 1;
}

.hero-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.hero-badge-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 9999px;
  border: 1px solid var(--app-border);
  background: var(--app-bg-subtle);
  color: var(--app-text-secondary);
}

.status-pill.online {
  color: var(--app-success);
  border-color: rgba(16, 185, 129, 0.3);
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: currentColor;
}

.env-pill {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 9999px;
  background: var(--app-bg-hover);
  color: var(--app-text-regular);
}

.version-tag {
  font-size: 12px;
  color: var(--app-text-muted);
}

.hero-title {
  font-size: 26px;
  font-weight: 700;
  margin: 0 0 10px 0;
  color: var(--app-text-primary);
  line-height: 1.3;
  letter-spacing: -0.02em;
}

.gradient-text {
  background: linear-gradient(135deg, var(--app-primary) 0%, #38bdf8 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-desc {
  font-size: 14px;
  color: var(--app-text-secondary);
  line-height: 1.6;
  margin: 0 0 20px 0;
  max-width: 620px;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* Hero Specs Panel */
.hero-specs-card {
  width: 300px;
  flex-shrink: 0;
  background: var(--app-bg-subtle);
  border: 1px solid var(--app-border-subtle);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 1;
}

.spec-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.spec-label {
  font-size: 11px;
  color: var(--app-text-muted);
}

.spec-val {
  font-size: 12px;
  font-weight: 600;
  color: var(--app-text-regular);
}

.spec-highlight {
  color: var(--app-primary);
}

/* 2. Bento Grid 样式 */
.bento-card {
  background: var(--app-bg-surface);
  border: 1px solid var(--app-border);
  border-radius: 14px;
  padding: 22px;
  box-shadow: var(--app-shadow-sm);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: pointer;
}

.bento-card:hover {
  border-color: var(--app-border-focus);
  transform: translateY(-2px);
  box-shadow: var(--app-shadow-md);
}

.bento-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.icon-bubble {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.lab-icon {
  background: rgba(37, 99, 235, 0.1);
  color: var(--app-primary);
}

.transfer-icon {
  background: rgba(16, 185, 129, 0.1);
  color: var(--app-success);
}

.arch-icon {
  background: rgba(168, 85, 247, 0.1);
  color: #a855f7;
}

.settings-icon {
  background: rgba(245, 158, 11, 0.1);
  color: var(--app-warning);
}

.bento-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0;
  color: var(--app-text-primary);
}

.bento-subtitle {
  font-size: 12px;
  color: var(--app-text-muted);
}

.bento-desc {
  font-size: 13px;
  color: var(--app-text-secondary);
  line-height: 1.5;
  margin: 0 0 14px 0;
}

.lab-tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mini-chip {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 6px;
  background: var(--app-bg-subtle);
  border: 1px solid var(--app-border-subtle);
  color: var(--app-text-regular);
}

.transfer-metrics {
  display: flex;
  gap: 16px;
  margin: 8px 0;
}

.metric-block {
  flex: 1;
  background: var(--app-bg-subtle);
  padding: 10px;
  border-radius: 8px;
  text-align: center;
}

.metric-num {
  font-size: 20px;
  font-weight: 700;
  color: var(--app-text-primary);
  display: block;
}

.metric-text {
  font-size: 11px;
  color: var(--app-text-muted);
}

.arch-layer-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.layer-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
}

.layer-tag {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  background: var(--app-bg-subtle);
  border: 1px solid var(--app-border);
  border-radius: 4px;
  color: var(--app-primary);
  width: 100px;
  flex-shrink: 0;
}

.layer-desc {
  color: var(--app-text-secondary);
}

.settings-features-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.feature-tag {
  font-size: 11px;
  padding: 3px 8px;
  background: var(--app-bg-subtle);
  border-radius: 6px;
  color: var(--app-text-regular);
}

@media (max-width: 900px) {
  .hero-banner {
    flex-direction: column;
    align-items: stretch;
  }
  .hero-specs-card {
    width: 100%;
  }
}
</style>
