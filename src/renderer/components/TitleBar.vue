<script setup lang="ts">
import { computed } from "vue";
import { useAppStore } from "../stores/app";
import { isElectron } from "../bridge/platform";

const appStore = useAppStore();

const isMac = computed(() => {
  if (typeof navigator === "undefined") return false;
  return isElectron && /Mac|Macintosh/i.test(navigator.userAgent);
});

async function handleMinimize() {
  await window.$ipcBridge.invoke("window:action", "minimize");
}

async function handleToggleMaximize() {
  if (appStore.isMaximized) {
    await window.$ipcBridge.invoke("window:action", "restore");
  } else {
    await window.$ipcBridge.invoke("window:action", "maximize");
  }
}

async function handleClose() {
  await window.$ipcBridge.invoke("window:action", "close");
}

function handleDblClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.closest(".no-drag, button, a, input, select")) return;
  void handleToggleMaximize();
}
</script>

<template>
  <header
    class="window-titlebar"
    :class="{ 'is-mac': isMac, 'is-maximized': appStore.isMaximized }"
    @dblclick="handleDblClick"
  >
    <!-- macOS: 左侧保留约 76px 留白供系统原生交通灯（Traffic Lights）显示 -->
    <div v-if="isMac" class="traffic-lights-spacer no-drag" />

    <!-- Windows / Linux / Web: 左侧展示应用 Logo 与标题 -->
    <div v-else class="titlebar-brand no-drag">
      <svg class="titlebar-logo" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
      <span class="titlebar-title">Electron Starter</span>
    </div>

    <!-- 中间可拖拽区域与 macOS 居中标题 -->
    <div class="titlebar-drag-area">
      <span v-if="isMac" class="titlebar-title-mac">Electron Starter</span>
    </div>

    <!-- Windows / Linux: 自绘窗口控制按钮组 (最小化、最大化/还原、关闭) -->
    <div v-if="!isMac" class="window-controls no-drag">
      <button
        class="window-btn minimize"
        title="最小化"
        aria-label="最小化"
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
        class="window-btn maximize"
        :title="appStore.isMaximized ? '还原' : '最大化'"
        :aria-label="appStore.isMaximized ? '还原' : '最大化'"
        @click="handleToggleMaximize"
      >
        <!-- 还原图标 (双层矩形) -->
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
        <!-- 最大化图标 (单层矩形) -->
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

      <button class="window-btn close" title="关闭" aria-label="关闭" @click="handleClose">
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
  </header>
</template>

<style scoped>
.window-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  background: var(--app-bg-surface);
  border-bottom: 1px solid var(--app-border-subtle);
  color: var(--app-text-secondary);
  font-size: 12px;
  user-select: none;
  -webkit-app-region: drag;
  position: relative;
  z-index: 100;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.traffic-lights-spacer {
  width: 76px;
  height: 100%;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.titlebar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 12px;
  height: 100%;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.titlebar-logo {
  color: var(--app-primary);
}

.titlebar-title {
  font-weight: 500;
  color: var(--app-text-primary);
}

.titlebar-drag-area {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: drag;
}

.titlebar-title-mac {
  font-size: 12px;
  font-weight: 500;
  color: var(--app-text-muted);
}

.window-controls {
  display: flex;
  align-items: center;
  height: 100%;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
}

.no-drag {
  -webkit-app-region: no-drag;
}

.window-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 100%;
  border: none;
  background: transparent;
  color: var(--app-text-secondary);
  cursor: pointer;
  outline: none;
  padding: 0;
  margin: 0;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
  -webkit-app-region: no-drag;
}

.window-btn:hover {
  background-color: var(--app-bg-muted);
  color: var(--app-text-primary);
}

.window-btn.close:hover {
  background-color: #e81123 !important;
  color: #ffffff !important;
}

.window-btn.close:active {
  background-color: #c42b1c !important;
  color: #ffffff !important;
}
</style>
