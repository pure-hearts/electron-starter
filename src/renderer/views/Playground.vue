<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import type { SelectOption } from "naive-ui";
import { useAppStore, type ThemeMode } from "../stores/app";
import { usePlatform, useIpcBridge } from "../bridge";
import { useAxios } from "../api/request";
import { feedback } from "../utils/feedback";
import { useDownloadStore, formatBytes, formatSpeed, formatEta } from "../stores/download";
import type { DownloadState, UpdateState, HotUpdateResult, HotUpdateInfo } from "../../shared/ipc";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const desktop = useIpcBridge();
const appStore = useAppStore();
const downloadStore = useDownloadStore();
const { isElectron } = usePlatform();

// 基础系统与环境状态
const version = ref("");
const downloadConcurrency = ref(10);
const closeToTray = ref(false);
const startupEnabled = ref(false);
const activeTab = ref<"window" | "transfer" | "update">("window");

// 与路由 Query 中的 tab 双向同步
watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab === "window" || newTab === "transfer" || newTab === "update") {
      activeTab.value = newTab;
    }
  },
  { immediate: true },
);

watch(activeTab, (val) => {
  if (route.path === "/playground" && route.query.tab !== val) {
    void router.replace({ query: { ...route.query, tab: val } });
  }
});

// 独立 Loading 状态字典
const loadingMap = ref<Record<string, boolean>>({});
function setLoading(key: string, val: boolean) {
  loadingMap.value[key] = val;
}
function isLoading(key: string): boolean {
  return Boolean(loadingMap.value[key]);
}

// 结构化终端日志项
interface ConsoleLogItem {
  id: string;
  time: string;
  label: string;
  type: "success" | "error" | "info";
  duration?: number;
  data: unknown;
}
const consoleLogs = ref<ConsoleLogItem[]>([]);
const consoleContainer = ref<HTMLElement | null>(null);

function appendLog(
  label: string,
  type: "success" | "error" | "info",
  data: unknown,
  duration?: number,
) {
  const item: ConsoleLogItem = {
    id: String(Date.now()) + Math.random().toString(36).slice(2, 6),
    time: new Date().toLocaleTimeString(),
    label,
    type,
    duration,
    data,
  };
  consoleLogs.value.unshift(item);
  if (consoleLogs.value.length > 50) {
    consoleLogs.value.pop();
  }
}

function clearConsole() {
  consoleLogs.value = [];
  feedback.message.info("调试日志已清空");
}

async function copyConsole() {
  try {
    const text = JSON.stringify(consoleLogs.value, null, 2);
    // 优先尝试原生剪贴板 API，失败或未授权时回退到主进程或 DOM 降级
    let copied = false;
    if (typeof desktop !== "undefined" && desktop.invoke) {
      try {
        await desktop.invoke("clipboard:write", text);
        copied = true;
      } catch {
        // 继续回退
      }
    }
    if (!copied && typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        // 继续回退
      }
    }
    if (!copied && typeof document !== "undefined") {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      copied = document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    if (copied) {
      feedback.message.success("日志内容已复制到剪贴板");
    } else {
      feedback.message.warning("复制失败，请手动选择复制");
    }
  } catch {
    feedback.message.warning("复制失败，请手动选择复制");
  }
}

// 统一异步运行包装器：提供按钮 Loading、耗时统计、Toast 与结构化控制台输出
async function run<T>(key: string, label: string, fn: () => Promise<T>): Promise<T | undefined> {
  setLoading(key, true);
  const start = performance.now();
  try {
    const result = await fn();
    const duration = Math.round(performance.now() - start);
    appendLog(label, "success", result ?? "OK", duration);
    feedback.message.success(`${label} 执行成功`, 2000);
    return result;
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    const msg = String(err);
    appendLog(label, "error", msg, duration);
    feedback.message.error(`${label} 失败: ${msg}`, 3500);
    return undefined;
  } finally {
    setLoading(key, false);
  }
}

// ----------------- Tab 1: 窗口与系统 -----------------
const customNoticeTitle = ref("Electron Starter");
const customNoticeBody = ref("这是一条来自开发者控制台的原生通知测试");

async function toggleStartup(enabled: boolean) {
  await run("startup", "开机自启动设置", async () => {
    startupEnabled.value = await desktop.invoke("startup:set", enabled);
    return startupEnabled.value ? "已开启自启动" : "已关闭自启动";
  });
}

function updateCloseToTray(enabled: boolean) {
  void run("closeToTray", "关闭到托盘设置", async () => {
    await desktop.invoke("store:set", "closeToTray", enabled);
    closeToTray.value = enabled;
    return enabled ? "开启关闭到托盘" : "关闭窗口直接退出";
  });
}

// ----------------- 系统原生 Shell 与外观体验 -----------------
const externalTestUrl = ref("https://github.com/pure-hearts/electron-vue-template");
const folderTestPath = ref("");
const trashTestPath = ref("");

onMounted(async () => {
  folderTestPath.value = isElectron ? "package.json" : "/tmp";
});

function copyAccentColorHex() {
  const hex = appStore.accentColor || "#10b981";
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    navigator.clipboard.writeText(hex);
  }
  feedback.message.success(`${t("playgroundView.shell.copyHexSuccess")}: ${hex}`);
}

async function handleSelectDirectoryForShell() {
  if (isElectron) {
    try {
      const selected = await desktop.invoke(
        "dialog:selectDirectory",
        folderTestPath.value || undefined,
      );
      if (selected) {
        folderTestPath.value = selected;
        feedback.message.success(`已选定目录: ${selected}`);
      }
    } catch (e) {
      feedback.message.error(String(e));
    }
  } else {
    feedback.message.info("Web 模式下不支持唤起系统目录选择框");
  }
}

async function handleConfirmTrash() {
  const p = trashTestPath.value.trim();
  if (!p) {
    feedback.message.warning("请输入有效的文件或目录路径");
    return;
  }
  await run("shell:trashItem", t("playgroundView.shell.trashTitle"), async () => {
    const ok = await desktop.invoke("shell:trashItem", p);
    if (ok) {
      feedback.message.success(`${t("playgroundView.shell.trashBtn")} 成功: ${p}`);
      trashTestPath.value = "";
    } else {
      feedback.message.warning(`移入废纸篓失败或路径不存在: ${p}`);
    }
    return ok;
  });
}

// ----------------- Tab 2: 数据与传输 + VueUse useAxios -----------------
const defaultDownloadURL =
  import.meta.env.VITE_APP_DOWNLOAD_TEST_URL ||
  "https://github.com/pure-hearts/electron-vue-template/releases/download/v0.1.0/latest.yml";
const downloadURL = ref(defaultDownloadURL);
const downloads = computed(() => downloadStore.activeList);
const printList = ref<string[]>([]);
const themeValue = ref<ThemeMode>("system");

const themeSelectOptions: SelectOption[] = [
  { label: "跟随系统", value: "system" },
  { label: "浅色模式", value: "light" },
  { label: "深色模式", value: "dark" },
];

// VueUse useAxios 响应式请求状态管理
const apiPresets = [
  { label: "HttpBin (稳定回显)", url: "https://httpbin.org/get" },
  { label: "JSONPlaceholder (Mock)", url: "https://jsonplaceholder.typicode.com/todos/1" },
  {
    label: "GitHub API (易限流)",
    url: "https://api.github.com/repos/pure-hearts/electron-vue-template",
  },
];
const apiTestURL = ref(apiPresets[0].url);
const {
  data: axiosData,
  isLoading: axiosLoading,
  isFinished: axiosFinished,
  isCanceled: axiosCanceled,
  error: axiosError,
  abort: abortAxios,
  execute: executeAxios,
} = useAxios<Record<string, unknown>>(
  apiTestURL.value,
  { method: "GET" },
  {
    immediate: false,
    resetOnExecute: true,
    onSuccess(payload) {
      const summary = {
        status: "OK",
        origin: payload?.origin,
        url: payload?.url,
        title: payload?.title,
        full_name: payload?.full_name,
      };
      appendLog("useAxios 响应成功", "success", summary);
      feedback.message.success("useAxios 请求成功");
    },
    onError(err) {
      appendLog("useAxios 请求异常", "error", String(err));
    },
  },
);

async function triggerUseAxios() {
  const target = apiTestURL.value.trim();
  if (!target.startsWith("http")) {
    feedback.message.warning("请输入合法的 HTTP/HTTPS 接口地址");
    return;
  }
  await executeAxios(target).catch(() => undefined);
}

const activeDownloadsCount = computed(() => downloadStore.activeCount);
const concurrencyRatio = computed(() => {
  if (downloadStore.concurrency <= 0) return 0;
  return Math.min(100, Math.round((activeDownloadsCount.value / downloadStore.concurrency) * 100));
});

async function beginDownload() {
  if (!downloadURL.value.trim().startsWith("http")) {
    feedback.message.warning("请输入合法的 HTTP/HTTPS 下载地址");
    return;
  }
  await run("download:start", "创建下载任务", async () => {
    const id = await downloadStore.start(downloadURL.value.trim());
    return { taskId: id };
  });
}

async function operateDownload(id: string, action: "pause" | "resume" | "cancel" | "retry") {
  const key = `${id}:${action}`;
  const actionName = { pause: "暂停", resume: "恢复", cancel: "取消", retry: "重试" }[action];
  await run(key, `下载任务${actionName}`, async () => {
    if (action === "pause") return downloadStore.pause(id);
    if (action === "resume") return downloadStore.resume(id);
    if (action === "cancel") return downloadStore.cancel(id);
    return downloadStore.retry(id);
  });
}

async function saveDownloadConcurrency() {
  await run("concurrency:set", "保存并发限制", async () => {
    return downloadStore.setConcurrency(downloadConcurrency.value);
  });
}

async function loadPrinters() {
  await run("printers:get", "扫描打印机设备", async () => {
    const list = await desktop.invoke("print:printers");
    printList.value = list.map((p) => p.displayName);
    return list;
  });
}

// ----------------- Tab 3: 更新与日志诊断 -----------------
const fullUpdateState = ref<UpdateState | null>(null);
const hotUpdateResult = ref<HotUpdateResult | null>(null);
const hotInfo = ref<HotUpdateInfo | null>(null);
const testLogLevel = ref<"info" | "warn" | "error">("info");
const testLogMessage = ref("Playground 诊断测试日志");

const logLevelOptions: SelectOption[] = [
  { label: "Info", value: "info" },
  { label: "Warn", value: "warn" },
  { label: "Error", value: "error" },
];

/** 刷新增量热更新运行时指针状态 */
async function refreshHotState() {
  await run("hot:state", "查询增量热更状态", async () => {
    hotInfo.value = await desktop.invoke("hot:state");
    return hotInfo.value;
  });
}

/** 检查并下载增量热更新包 */
async function checkHotUpdateAction() {
  await run("hot:check", "检查 ZIP 增量热更新", async () => {
    hotUpdateResult.value = await desktop.invoke("hot:check");
    await refreshHotState();
    return hotUpdateResult.value;
  });
}

/** 立即重启应用以激活就绪的增量热更 */
async function restartForHotUpdate() {
  await run("hot:restart", "重启激活增量更新", async () => {
    await desktop.invoke("hot:restart");
  });
}

const updateStep = computed(() => {
  if (!fullUpdateState.value) return 1;
  const status = fullUpdateState.value.status;
  if (status === "checking") return 1;
  if (status.startsWith("available") || status === "downloading") return 2;
  if (status === "ready") return 3;
  return 1;
});

const isFullUpdateDownloading = computed(() => fullUpdateState.value?.status === "downloading");
const fullUpdatePercent = computed(() => Math.round(fullUpdateState.value?.percent ?? 0));

// 生命周期与订阅
const unsubscribers: Array<() => void> = [];

onMounted(async () => {
  unsubscribers.push(
    desktop.on("download:state", (state: DownloadState) => {
      appendLog("下载状态推送", "info", state);
    }),
  );
  unsubscribers.push(
    desktop.on("update:state", (state: UpdateState) => {
      if (state.kind === "full") {
        fullUpdateState.value = state;
      }
      if (state.kind === "hot" && state.status === "ready") {
        void refreshHotState();
      }
      appendLog("更新状态推送", state.error ? "error" : "info", state);
    }),
  );
  unsubscribers.push(
    desktop.on("protocol:open", (url) => {
      appendLog("Deep Link 唤醒", "info", { url });
      feedback.message.info(`接收到 Deep Link 唤醒: ${url}`, 3000);
    }),
  );
  unsubscribers.push(
    desktop.on("notification:clicked", (title) => {
      appendLog("通知点击响应", "info", { title });
    }),
  );

  // 初始化基础数据
  try {
    version.value = await desktop.invoke("app:version");
    downloadConcurrency.value = await desktop.invoke("download:concurrency:get");
    const savedClose = await desktop.invoke("store:get", "closeToTray");
    closeToTray.value = savedClose === true;
    startupEnabled.value = await desktop.invoke("startup:get");
    const savedTheme = (await desktop.invoke("store:get", "theme")) as ThemeMode;
    if (savedTheme) themeValue.value = savedTheme;
    await refreshHotState();
  } catch (err) {
    appendLog("系统初始化", "error", String(err));
  }
});

onUnmounted(() => {
  unsubscribers.forEach((stop) => stop());
});
</script>

<template>
  <section class="flex flex-col gap-4.5 pb-10">
    <!-- 顶部状态横幅 Hero Bar -->
    <header
      class="flex justify-between items-center flex-wrap gap-4 px-6 py-4.5 bg-app-bg-surface border border-app-border rounded-xl shadow-sm"
    >
      <div class="flex flex-col">
        <div class="flex items-center flex-wrap gap-2.5">
          <h1 class="m-0 text-22px font-700 text-app-text-primary">系统功能控制台</h1>
          <n-tag type="primary" size="small" round>Playground Pro</n-tag>
          <n-tag :type="isElectron ? 'success' : 'warning'" size="small" round>
            {{ isElectron ? "🖥️ Electron 桌面客户端" : "🌐 Web 纯浏览器模式" }}
          </n-tag>
        </div>
        <p class="m-0 mt-1 text-13px text-app-text-secondary">
          22 项原生系统能力综合测试面板 · Naive UI + VueUse 架构 · 严格运行在沙箱与类型安全 IPC 下
        </p>
      </div>

      <div class="flex gap-4.5 items-center">
        <div
          class="flex flex-col items-start px-3.5 py-1.5 bg-app-bg-subtle border border-app-border-subtle rounded-lg"
        >
          <span class="text-11px text-app-text-muted">应用版本</span>
          <strong class="text-14px text-app-text-primary">{{ version || "检测中..." }}</strong>
        </div>
        <div
          class="flex flex-col items-start px-3.5 py-1.5 bg-app-bg-subtle border border-app-border-subtle rounded-lg"
        >
          <span class="text-11px text-app-text-muted"
            >并发负载 ({{ activeDownloadsCount }}/{{ downloadConcurrency }})</span
          >
          <n-progress
            type="line"
            :percentage="concurrencyRatio"
            :height="6"
            :show-indicator="false"
            style="width: 80px; margin-top: 6px"
            :status="concurrencyRatio >= 100 ? 'warning' : 'success'"
          />
        </div>
        <div
          class="flex flex-col items-start px-3.5 py-1.5 bg-app-bg-subtle border border-app-border-subtle rounded-lg"
        >
          <span class="text-11px text-app-text-muted">Deep Link</span>
          <strong class="text-14px text-app-text-primary" style="color: var(--app-success)">
            {{ appStore.lastDeepLink ? "已连接" : "就绪监听" }}
          </strong>
        </div>
      </div>
    </header>

    <!-- 核心功能标签页 Tabs -->
    <n-tabs v-model:value="activeTab" type="card" animated class="w-full">
      <!-- Tab 1: 窗口与系统 -->
      <n-tab-pane name="window" tab="🖥️ 窗口与系统控制">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <!-- 窗口动作控制卡片 -->
          <n-card class="rounded-10px border border-app-border" size="small">
            <template #header>
              <div class="flex justify-between items-center">
                <span class="text-15px font-600 text-app-text-primary">🪟 窗口行为矩阵</span>
                <span class="text-11px text-app-text-muted bg-app-bg-muted px-2 py-0.5 rounded"
                  >多窗口与生命周期</span
                >
              </div>
            </template>
          </n-card>
        </div></n-tab-pane
      ></n-tabs
    >
  </section>
</template>
