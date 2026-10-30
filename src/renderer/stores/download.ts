/**
 * @file download.ts
 * @description 下载中心 Pinia 响应式状态库：管理活跃下载队列、历史持久化记录、全局速率统计与控制动作。
 */
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { DownloadState } from "@shared/ipc";
import { getBridge } from "../bridge";

export function formatBytes(bytes?: number): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return "--";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec?: number): string {
  if (bytesPerSec === undefined || bytesPerSec <= 0) return "0 B/s";
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(seconds?: number): string {
  if (seconds === undefined || seconds <= 0 || !Number.isFinite(seconds)) return "--";
  if (seconds < 60) return `${seconds}秒`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes}分${remainingSeconds > 0 ? `${remainingSeconds}秒` : ""}`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}时${remainingMinutes > 0 ? `${remainingMinutes}分` : ""}`;
}

export const useDownloadStore = defineStore("download", () => {
  const activeTasks = ref<Map<string, DownloadState>>(new Map());
  const historyTasks = ref<DownloadState[]>([]);
  const concurrency = ref<number>(10);
  const drawerVisible = ref<boolean>(false);
  const initialized = ref<boolean>(false);
  const loadingHistory = ref<boolean>(false);

  let cleanupListener: (() => void) | null = null;

  // 活跃下载列表
  const activeList = computed<DownloadState[]>(() => {
    return Array.from(activeTasks.value.values()).sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
    );
  });

  // 进行中的任务数（排除已完成、已失败、已取消）
  const activeCount = computed<number>(() => {
    return activeList.value.filter((t) =>
      ["queued", "started", "progress", "paused", "interrupted"].includes(t.state),
    ).length;
  });

  // 全局实时总下载速度
  const totalSpeed = computed<number>(() => {
    return activeList.value.reduce((acc, cur) => {
      if (cur.state === "progress" && cur.speed) {
        return acc + cur.speed;
      }
      return acc;
    }, 0);
  });

  // 全局总体进度 (活跃任务加权进度)
  const overallPercent = computed<number>(() => {
    const list = activeList.value.filter((t) =>
      ["queued", "started", "progress", "paused", "interrupted"].includes(t.state),
    );
    if (list.length === 0) return 0;
    const totalBytes = list.reduce((acc, cur) => acc + (cur.totalBytes ?? 0), 0);
    const receivedBytes = list.reduce((acc, cur) => acc + (cur.receivedBytes ?? 0), 0);
    if (totalBytes > 0) {
      return Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
    }
    const sumPercent = list.reduce((acc, cur) => acc + (cur.percent ?? 0), 0);
    return Math.round(sumPercent / list.length);
  });

  /**
   * 初始化下载状态监听与拉取基础配置
   */
  async function init(): Promise<void> {
    if (initialized.value) return;
    initialized.value = true;
    const bridge = getBridge();

    // 绑定主进程状态推送
    cleanupListener = bridge.on("download:state", (state: DownloadState) => {
      handleStateUpdate(state);
    });

    // 读取当前并发上限与历史记录
    try {
      concurrency.value = await bridge.invoke("download:concurrency:get");
      await fetchHistory();
    } catch (e) {
      console.warn("Failed to initialize download store", e);
    }
  }

  function handleStateUpdate(state: DownloadState): void {
    const isTerminal = ["completed", "failed", "cancelled"].includes(state.state);
    if (isTerminal) {
      activeTasks.value.delete(state.id);
      // 插入/更新至历史记录首部
      const existingIdx = historyTasks.value.findIndex((t) => t.id === state.id);
      if (existingIdx >= 0) {
        historyTasks.value[existingIdx] = { ...historyTasks.value[existingIdx], ...state };
      } else {
        historyTasks.value.unshift(state);
      }
    } else {
      const prev = activeTasks.value.get(state.id);
      activeTasks.value.set(state.id, { ...prev, ...state });
    }
  }

  /**
   * 拉取持久化下载历史
   */
  async function fetchHistory(limit = 100): Promise<void> {
    loadingHistory.value = true;
    try {
      const bridge = getBridge();
      const list = await bridge.invoke("download:history:get", limit);
      if (Array.isArray(list)) {
        historyTasks.value = list;
      }
    } catch (e) {
      console.warn("Failed to fetch download history", e);
    } finally {
      loadingHistory.value = false;
    }
  }

  /**
   * 发起新下载任务
   */
  async function start(url: string, customFilename?: string): Promise<string> {
    const bridge = getBridge();
    const id = await bridge.invoke("download:start", url.trim());
    const initial: DownloadState = {
      id,
      url: url.trim(),
      filename: customFilename,
      state: "queued",
      createdAt: Date.now(),
    };
    activeTasks.value.set(id, initial);
    return id;
  }

  async function pause(id: string): Promise<void> {
    const bridge = getBridge();
    await bridge.invoke("download:pause", id);
  }

  async function resume(id: string): Promise<void> {
    const bridge = getBridge();
    await bridge.invoke("download:resume", id);
  }

  async function cancel(id: string): Promise<void> {
    const bridge = getBridge();
    await bridge.invoke("download:cancel", id);
    activeTasks.value.delete(id);
  }

  async function retry(id: string): Promise<string> {
    const bridge = getBridge();
    const nextId = await bridge.invoke("download:retry", id);
    return nextId;
  }

  async function setConcurrency(val: number): Promise<number> {
    const bridge = getBridge();
    const updated = await bridge.invoke("download:concurrency:set", val);
    concurrency.value = updated;
    return updated;
  }

  async function removeHistory(id: string): Promise<boolean> {
    try {
      const bridge = getBridge();
      const ok = await bridge.invoke("download:history:remove", id);
      if (ok) {
        historyTasks.value = historyTasks.value.filter((t) => t.id !== id);
      }
      return ok;
    } catch (e) {
      console.warn("Failed to remove history record", e);
      return false;
    }
  }

  async function clearCompleted(): Promise<void> {
    try {
      const bridge = getBridge();
      await bridge.invoke("download:history:clear");
      historyTasks.value = historyTasks.value.filter(
        (t) => !["completed", "failed", "cancelled"].includes(t.state),
      );
    } catch (e) {
      console.warn("Failed to clear completed history", e);
    }
  }

  async function checkFileExists(idOrPath: string, maybePath?: string): Promise<boolean> {
    const filePath = maybePath ? maybePath : idOrPath;
    const id = maybePath ? idOrPath : "";
    if (!filePath) return false;
    try {
      const bridge = getBridge();
      const exists = await bridge.invoke("download:file:exists", filePath);
      const target = historyTasks.value.find((t) => (id ? t.id === id : t.path === filePath));
      if (target) {
        target.fileExists = exists;
      }
      return exists;
    } catch (e) {
      console.warn("Failed to check file existence", e);
      return false;
    }
  }

  async function showInFolder(filePath: string): Promise<boolean> {
    if (!filePath) return false;
    try {
      const bridge = getBridge();
      return await bridge.invoke("shell:showItemInFolder", filePath);
    } catch (e) {
      console.warn("Failed to show item in folder", e);
      return false;
    }
  }

  async function openFile(idOrPath: string, maybePath?: string): Promise<boolean> {
    const filePath = maybePath ? maybePath : idOrPath;
    const id = maybePath ? idOrPath : "";
    if (!filePath) return false;
    try {
      const exists = await checkFileExists(id, filePath);
      if (!exists) {
        return false;
      }
      const bridge = getBridge();
      const err = await bridge.invoke("shell:openPath", filePath);
      return !err;
    } catch (e) {
      console.warn("Failed to open file", e);
      return false;
    }
  }

  function toggleDrawer(visible?: boolean): void {
    drawerVisible.value = visible !== undefined ? visible : !drawerVisible.value;
  }

  function dispose(): void {
    cleanupListener?.();
    cleanupListener = null;
    initialized.value = false;
  }

  return {
    activeTasks,
    historyTasks,
    concurrency,
    drawerVisible,
    loadingHistory,
    activeList,
    activeCount,
    totalSpeed,
    overallPercent,
    init,
    start,
    pause,
    resume,
    cancel,
    retry,
    setConcurrency,
    fetchHistory,
    removeHistory,
    clearCompleted,
    showInFolder,
    checkFileExists,
    openFile,
    toggleDrawer,
    dispose,
  };
});
