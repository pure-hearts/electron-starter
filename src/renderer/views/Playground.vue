<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  NAlert,
  NButton,
  NButtonGroup,
  NCard,
  NDivider,
  NEmpty,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NProgress,
  NSelect,
  NSlider,
  NStep,
  NSteps,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  type SelectOption,
} from "naive-ui";
import { useAppStore, type ThemeMode } from "../stores/app";
import { usePlatform } from "../bridge";
import { useAxios } from "../api/request";
import { feedback } from "../utils/feedback";
import type { DownloadState, UpdateState, HotUpdateResult, HotUpdateInfo } from "../../shared/ipc";

const desktop = window.$ipcBridge;
const appStore = useAppStore();
const { isElectron } = usePlatform();

// 基础系统与环境状态
const version = ref("");
const downloadConcurrency = ref(10);
const closeToTray = ref(false);
const startupEnabled = ref(false);
const activeTab = ref<"window" | "transfer" | "update">("window");

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
    await navigator.clipboard.writeText(text);
    feedback.message.success("日志内容已复制到剪贴板");
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

// ----------------- Tab 2: 数据与传输 + VueUse useAxios -----------------
const defaultDownloadURL =
  import.meta.env.VITE_APP_DOWNLOAD_TEST_URL ||
  "https://github.com/pure-hearts/electron-starter/releases/download/v0.1.0/latest.yml";
const downloadURL = ref(defaultDownloadURL);
const downloads = ref<DownloadState[]>([]);
const printList = ref<string[]>([]);
const themeValue = ref<ThemeMode>("system");

const themeSelectOptions: SelectOption[] = [
  { label: "跟随系统", value: "system" },
  { label: "浅色模式", value: "light" },
  { label: "深色模式", value: "dark" },
];

// VueUse useAxios 响应式请求状态管理
const apiTestURL = ref("https://api.github.com/repos/pure-hearts/electron-starter");
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
        full_name: payload?.full_name ?? "OK",
        stargazers_count: payload?.stargazers_count,
        default_branch: payload?.default_branch,
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

const activeDownloadsCount = computed(
  () => downloads.value.filter((t) => ["started", "progress"].includes(t.state)).length,
);
const concurrencyRatio = computed(() => {
  if (downloadConcurrency.value <= 0) return 0;
  return Math.min(100, Math.round((activeDownloadsCount.value / downloadConcurrency.value) * 100));
});

function updateDownload(state: DownloadState) {
  const index = downloads.value.findIndex((task) => task.id === state.id);
  if (index < 0) downloads.value.push(state);
  else downloads.value[index] = { ...downloads.value[index], ...state };
}

async function beginDownload() {
  if (!downloadURL.value.trim().startsWith("http")) {
    feedback.message.warning("请输入合法的 HTTP/HTTPS 下载地址");
    return;
  }
  await run("download:start", "创建下载任务", async () => {
    const id = await desktop.invoke("download:start", downloadURL.value.trim());
    if (!downloads.value.some((task) => task.id === id)) {
      downloads.value.unshift({ id, url: downloadURL.value.trim(), state: "queued", percent: 0 });
    }
    return { taskId: id };
  });
}

async function operateDownload(id: string, action: "pause" | "resume" | "cancel" | "retry") {
  const key = `${id}:${action}`;
  const actionName = { pause: "暂停", resume: "恢复", cancel: "取消", retry: "重试" }[action];
  await run(key, `下载任务${actionName}`, async () => {
    if (action === "pause") return desktop.invoke("download:pause", id);
    if (action === "resume") return desktop.invoke("download:resume", id);
    if (action === "cancel") return desktop.invoke("download:cancel", id);
    return desktop.invoke("download:retry", id);
  });
}

async function saveDownloadConcurrency() {
  await run("concurrency:set", "保存并发限制", async () => {
    downloadConcurrency.value = await desktop.invoke(
      "download:concurrency:set",
      downloadConcurrency.value,
    );
    return downloadConcurrency.value;
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
      updateDownload(state);
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
  <section class="playground-dashboard">
    <!-- 顶部状态横幅 Hero Bar -->
    <header class="dashboard-hero">
      <div class="hero-main">
        <div class="hero-title-group">
          <h1 class="hero-title">系统功能控制台</h1>
          <n-tag type="primary" size="small" round>Playground Pro</n-tag>
          <n-tag :type="isElectron ? 'success' : 'warning'" size="small" round>
            {{ isElectron ? "🖥️ Electron 桌面客户端" : "🌐 Web 纯浏览器模式" }}
          </n-tag>
          <span v-if-web class="web-mode-hint">Web Shim 降级垫片已激活</span>
        </div>
        <p class="hero-sub">
          22 项原生系统能力综合测试面板 · Naive UI + VueUse 架构 · 严格运行在沙箱与类型安全 IPC 下
        </p>
      </div>

      <div class="hero-metrics">
        <div class="metric-chip">
          <span class="metric-label">应用版本</span>
          <strong class="metric-value">{{ version || "检测中..." }}</strong>
        </div>
        <div class="metric-chip">
          <span class="metric-label"
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
        <div class="metric-chip">
          <span class="metric-label">Deep Link</span>
          <strong class="metric-value" style="color: var(--app-success)">
            {{ appStore.lastDeepLink ? "已连接" : "就绪监听" }}
          </strong>
        </div>
      </div>
    </header>

    <!-- 核心功能标签页 Tabs -->
    <n-tabs v-model:value="activeTab" type="card" animated class="dashboard-tabs">
      <!-- Tab 1: 窗口与系统 -->
      <n-tab-pane name="window" tab="🖥️ 窗口与系统控制">
        <div class="tab-grid">
          <!-- 窗口动作控制卡片 -->
          <n-card class="feature-card" size="small">
            <template #header>
              <div class="card-header-bar">
                <span class="card-title">🪟 窗口行为矩阵</span>
                <span class="card-badge">多窗口与生命周期</span>
              </div>
            </template>
            <p class="card-desc">
              通过受限白名单调用底层 BrowserWindow 控制动作，严禁任意字符串执行。
            </p>
            <div class="button-matrix">
              <n-button
                type="primary"
                secondary
                :loading="isLoading('win:open')"
                @click="
                  run('win:open', '打开新窗口', () => desktop.invoke('window:open', '/playground'))
                "
              >
                新建子窗口
              </n-button>
              <n-button
                :loading="isLoading('win:min')"
                @click="
                  run('win:min', '最小化窗口', () => desktop.invoke('window:action', 'minimize'))
                "
              >
                最小化
              </n-button>
              <n-button
                :loading="isLoading('win:max')"
                @click="
                  run('win:max', '最大化窗口', () => desktop.invoke('window:action', 'maximize'))
                "
              >
                最大化
              </n-button>
              <n-button
                :loading="isLoading('win:restore')"
                @click="
                  run('win:restore', '恢复窗口', () => desktop.invoke('window:action', 'restore'))
                "
              >
                还原尺寸
              </n-button>
              <n-button
                type="warning"
                secondary
                :loading="isLoading('win:hide')"
                @click="
                  run('win:hide', '隐藏到托盘', () => desktop.invoke('window:action', 'hide'))
                "
              >
                隐藏至托盘
              </n-button>
            </div>
          </n-card>

          <!-- 系统偏好与托盘设置 -->
          <n-card class="feature-card" size="small">
            <template #header>
              <div class="card-header-bar">
                <span class="card-title">⚙️ 系统集成偏好</span>
                <span class="card-badge">开机自启 & 托盘</span>
              </div>
            </template>
            <div class="switch-row">
              <div class="switch-meta">
                <strong>关闭窗口时隐藏至系统托盘</strong>
                <small>开启后点击窗口关闭按钮不退出进程，由系统托盘常驻守护</small>
              </div>
              <n-switch
                :value="closeToTray"
                v-disabled-electron="'仅在 Electron 桌面客户端支持设置关闭到托盘'"
                :loading="isLoading('closeToTray')"
                @update:value="updateCloseToTray"
              />
            </div>
            <n-divider style="margin: 14px 0" />
            <div class="switch-row">
              <div class="switch-meta">
                <strong>开机自动启动应用</strong>
                <small>跨平台支持 Windows 注册表、macOS LoginItem 与 Linux XDG autostart</small>
              </div>
              <n-switch
                :value="startupEnabled"
                v-disabled-electron="'仅在 Electron 桌面客户端支持设置开机自启动'"
                :loading="isLoading('startup')"
                @update:value="toggleStartup"
              />
            </div>
          </n-card>

          <!-- 桌面通知测试 -->
          <n-card class="feature-card full-width" size="small">
            <template #header>
              <div class="card-header-bar">
                <span class="card-title">🔔 原生桌面通知与协议</span>
                <span class="card-badge">NotificationCenter</span>
              </div>
            </template>
            <div class="form-row">
              <n-input
                v-model:value="customNoticeTitle"
                placeholder="通知标题"
                style="width: 220px"
              />
              <n-input
                v-model:value="customNoticeBody"
                placeholder="通知内容主体"
                style="flex: 1"
              />
              <n-button
                type="primary"
                :loading="isLoading('notice:send')"
                @click="
                  run('notice:send', '发送桌面通知', () =>
                    desktop.invoke('notification:show', customNoticeTitle, customNoticeBody),
                  )
                "
              >
                发送测试通知
              </n-button>
              <n-button
                :loading="isLoading('protocol')"
                @click="run('protocol', '查询协议名', () => desktop.invoke('protocol:scheme'))"
              >
                查询 Deep Link 协议
              </n-button>
            </div>
            <div v-if="appStore.lastDeepLink" class="deep-link-banner">
              <span>🔗 捕获到唤醒参数：</span>
              <code>{{ appStore.lastDeepLink }}</code>
            </div>
          </n-card>
        </div>
      </n-tab-pane>

      <!-- Tab 2: 数据传输与存储 -->
      <n-tab-pane name="transfer" tab="📦 数据持久化与传输">
        <div class="tab-grid">
          <!-- VueUse useAxios 响应式网络请求卡片 -->
          <n-card class="feature-card full-width" size="small">
            <template #header>
              <div class="card-header-bar">
                <span class="card-title">🌐 响应式 HTTP 请求 (VueUse useAxios)</span>
                <div class="badge-group">
                  <span class="card-badge">双端同构</span>
                  <span class="card-badge">AbortSignal 取消与脱敏拦截</span>
                </div>
              </div>
            </template>
            <p class="card-desc">
              基于预绑定拦截器的 <code>useAxios</code>，自动维护响应式
              <code>isLoading</code>、<code>data</code>、<code>error</code> 与一键中断控制。
            </p>
            <div class="form-row" style="margin-bottom: 12px">
              <n-input
                v-model:value="apiTestURL"
                placeholder="请输入 HTTPS JSON 接口地址"
                clearable
                style="flex: 1"
              />
              <n-button type="primary" :loading="axiosLoading" @click="triggerUseAxios">
                发起 GET 请求
              </n-button>
              <n-button
                type="warning"
                secondary
                :disabled="!axiosLoading"
                @click="abortAxios('用户手动中止请求')"
              >
                中止请求 (Abort)
              </n-button>
            </div>
            <div class="axios-status-bar">
              <n-tag
                size="small"
                :type="
                  axiosLoading
                    ? 'info'
                    : axiosCanceled
                      ? 'warning'
                      : axiosError
                        ? 'error'
                        : axiosFinished
                          ? 'success'
                          : 'default'
                "
              >
                状态:
                {{
                  axiosLoading
                    ? "请求中..."
                    : axiosCanceled
                      ? "已中止 (Canceled)"
                      : axiosError
                        ? "异常"
                        : axiosFinished
                          ? "已完成"
                          : "空闲就绪"
                }}
              </n-tag>
              <span v-if="axiosError" class="error-msg">异常摘要: {{ String(axiosError) }}</span>
              <span v-else-if="axiosData" class="muted-text font-mono">
                Repo: {{ axiosData.full_name || "已接收 JSON 负载" }} (★
                {{ axiosData.stargazers_count ?? 0 }})
              </span>
            </div>
          </n-card>

          <!-- 并发控制器与新建下载 -->
          <n-card class="feature-card full-width" size="small">
            <template #header>
              <div class="card-header-bar">
                <span class="card-title">⚡ 传输队列调度中心</span>
                <span class="card-badge">FIFO 队列 & 1-50 并发限制</span>
              </div>
            </template>

            <!-- 并发设置联动 -->
            <div class="concurrency-control-bar">
              <span class="label">最大并行下载并发数：</span>
              <n-slider
                v-model:value="downloadConcurrency"
                :min="1"
                :max="50"
                style="flex: 1; max-width: 300px; margin: 0 16px"
              />
              <n-input-number
                v-model:value="downloadConcurrency"
                :min="1"
                :max="50"
                :step="1"
                size="small"
                style="width: 100px; margin-right: 10px"
              />
              <n-button
                type="primary"
                size="small"
                secondary
                :loading="isLoading('concurrency:set')"
                @click="saveDownloadConcurrency"
              >
                保存设置并持久化
              </n-button>
            </div>

            <!-- 下载新建 -->
            <div class="download-create-box">
              <n-input-group style="flex: 1">
                <n-input-group-label>HTTPS</n-input-group-label>
                <n-input
                  v-model:value="downloadURL"
                  placeholder="请输入完整 HTTPS 文件下载地址"
                  clearable
                />
              </n-input-group>
              <n-button
                type="success"
                :loading="isLoading('download:start')"
                @click="beginDownload"
              >
                发起下载任务
              </n-button>
            </div>

            <!-- 下载任务列表展示 -->
            <div class="downloads-wrapper">
              <n-empty
                v-if="downloads.length === 0"
                description="暂无活跃下载任务，请在上方输入地址创建"
                style="padding: 16px 0"
              />
              <div v-else class="download-list">
                <div v-for="item in downloads" :key="item.id" class="download-item-card">
                  <div class="item-header">
                    <span class="url-text" :title="item.url">{{ item.url }}</span>
                    <n-tag
                      size="small"
                      :type="
                        item.state === 'completed'
                          ? 'success'
                          : item.state === 'failed'
                            ? 'error'
                            : item.state === 'paused'
                              ? 'warning'
                              : 'info'
                      "
                    >
                      {{ item.state }}
                    </n-tag>
                  </div>

                  <!-- 生产级动画进度条 -->
                  <div class="item-progress">
                    <n-progress
                      type="line"
                      :percentage="item.percent ?? 0"
                      :height="10"
                      :processing="item.state === 'progress'"
                      :status="
                        item.state === 'completed'
                          ? 'success'
                          : item.state === 'failed'
                            ? 'error'
                            : item.state === 'paused'
                              ? 'warning'
                              : 'default'
                      "
                    />
                  </div>

                  <div class="item-footer">
                    <span v-if="item.error" class="error-msg">⚠️ {{ item.error }}</span>
                    <span v-else class="id-text">TaskID: {{ item.id.slice(0, 8) }}...</span>

                    <n-button-group size="small">
                      <n-button
                        :disabled="!['started', 'progress'].includes(item.state)"
                        :loading="isLoading(`${item.id}:pause`)"
                        @click="operateDownload(item.id, 'pause')"
                      >
                        暂停
                      </n-button>
                      <n-button
                        :disabled="item.state !== 'paused'"
                        :loading="isLoading(`${item.id}:resume`)"
                        @click="operateDownload(item.id, 'resume')"
                      >
                        恢复
                      </n-button>
                      <n-button
                        type="error"
                        secondary
                        :disabled="
                          !['queued', 'started', 'progress', 'paused'].includes(item.state)
                        "
                        :loading="isLoading(`${item.id}:cancel`)"
                        @click="operateDownload(item.id, 'cancel')"
                      >
                        取消
                      </n-button>
                      <n-button
                        type="primary"
                        secondary
                        :disabled="!['failed', 'cancelled'].includes(item.state)"
                        :loading="isLoading(`${item.id}:retry`)"
                        @click="operateDownload(item.id, 'retry')"
                      >
                        重试
                      </n-button>
                    </n-button-group>
                  </div>
                </div>
              </div>
            </div>
          </n-card>

          <!-- 本地配置与持久化 -->
          <n-card class="feature-card" size="small">
            <template #header>
              <div class="card-header-bar">
                <span class="card-title">🗄️ 本地配置存储 (electron-store)</span>
                <span class="card-badge">安全持久化</span>
              </div>
            </template>
            <p class="card-desc">对应用偏好进行 Schema 校验写入，保证系统启动自动恢复。</p>
            <div class="form-row">
              <n-select
                v-model:value="themeValue"
                :options="themeSelectOptions"
                style="width: 140px"
              />
              <n-button
                type="primary"
                :loading="isLoading('theme:set')"
                @click="run('theme:set', '写入主题模式', () => appStore.setTheme(themeValue))"
              >
                写入主题
              </n-button>
              <n-button
                :loading="isLoading('theme:get')"
                @click="
                  run('theme:get', '读取持久化主题', () => desktop.invoke('store:get', 'theme'))
                "
              >
                读取存储
              </n-button>
            </div>
          </n-card>

          <!-- 打印服务 -->
          <n-card class="feature-card" size="small">
            <template #header>
              <div class="card-header-bar">
                <span class="card-title">🖨️ 系统打印服务</span>
                <span class="card-badge">原生打印机探测</span>
              </div>
            </template>
            <div class="button-matrix" style="margin-bottom: 12px">
              <n-button
                type="primary"
                secondary
                :loading="isLoading('printers:get')"
                @click="loadPrinters"
              >
                扫描本地打印机
              </n-button>
              <n-button
                :loading="isLoading('print:run')"
                @click="run('print:run', '调用系统打印', () => desktop.invoke('print:execute'))"
              >
                打印当前视图
              </n-button>
            </div>
            <div class="printer-tags">
              <span v-if="printList.length === 0" class="muted-text"
                >暂未发现打印设备，点击上方按钮扫描</span
              >
              <n-tag
                v-for="p in printList"
                :key="p"
                size="small"
                type="info"
                style="margin-right: 6px; margin-bottom: 6px"
              >
                {{ p }}
              </n-tag>
            </div>
          </n-card>
        </div>
      </n-tab-pane>

      <!-- Tab 3: 更新与系统诊断 -->
      <n-tab-pane name="update" tab="🔄 应用升级与诊断">
        <div class="tab-grid">
          <!-- 整包自动更新流程 -->
          <n-card class="feature-card full-width" size="small">
            <template #header>
              <div class="card-header-bar">
                <span class="card-title">🚀 全量自动更新 (electron-updater)</span>
                <span class="card-badge">跨平台差分下载</span>
              </div>
            </template>

            <!-- 更新步骤流转 -->
            <n-steps
              :current="updateStep"
              :status="fullUpdateState?.error ? 'error' : 'process'"
              size="small"
              style="margin-bottom: 18px"
            >
              <n-step title="检查最新版本" />
              <n-step title="下载更新包" />
              <n-step title="就绪安装" />
            </n-steps>

            <!-- 更新下载专用大进度条 -->
            <div v-if="isFullUpdateDownloading" class="update-progress-box">
              <div class="progress-info">
                <span>正在下载新版本安装包...</span>
                <strong>{{ fullUpdatePercent }}%</strong>
              </div>
              <n-progress
                type="line"
                :percentage="fullUpdatePercent"
                :height="12"
                processing
                status="info"
              />
            </div>

            <div class="button-matrix">
              <n-button
                type="primary"
                v-disabled-electron="'整包安装更新仅在桌面客户端支持'"
                :loading="isLoading('updater:check') || fullUpdateState?.status === 'checking'"
                :disabled="isFullUpdateDownloading"
                @click="run('updater:check', '检查整包更新', () => desktop.invoke('updater:check'))"
              >
                检查整包更新
              </n-button>

              <n-button
                type="success"
                v-disabled-electron="'整包安装更新仅在桌面客户端支持'"
                :disabled="fullUpdateState?.status !== 'ready'"
                :loading="isLoading('updater:install')"
                @click="
                  run('updater:install', '退出并安装更新', () => desktop.invoke('updater:install'))
                "
              >
                安装整包并重启
              </n-button>

              <n-button
                :loading="isLoading('app:restart')"
                @click="run('app:restart', '重启应用进程', () => desktop.invoke('app:restart'))"
              >
                重启应用
              </n-button>
            </div>
          </n-card>

          <!-- 增量热更新卡片 -->
          <n-card class="feature-card full-width" size="small">
            <template #header>
              <div class="card-header-bar">
                <span class="card-title">⚡ 增量热更新 (ZIP Hot Update)</span>
                <div class="badge-group">
                  <span class="card-badge">Ed25519 签名校验</span>
                  <span class="card-badge">崩溃自愈回滚</span>
                </div>
              </div>
            </template>
            <p class="card-desc">
              仅下载并热替换渲染层静态资源，跳过主进程与安装向导，支持多源分发与异常自动回退。
            </p>

            <!-- 热更状态信息面板 -->
            <div class="hot-status-panel">
              <div class="status-metric">
                <span class="metric-label">生效版本标签</span>
                <n-tag size="small" type="primary" class="metric-tag">
                  {{ hotInfo?.currentVersionTag || "内置版本" }}
                </n-tag>
              </div>

              <div class="status-metric">
                <span class="metric-label">Git 提交 Hash</span>
                <n-tag size="small" type="info" class="metric-tag font-mono">
                  {{ hotInfo?.currentCommit || "base" }}
                </n-tag>
              </div>

              <div class="status-metric">
                <span class="metric-label">生命周期阶段</span>
                <n-tag
                  size="small"
                  :type="
                    hotInfo?.phase === 'active'
                      ? 'success'
                      : hotInfo?.phase === 'staged'
                        ? 'warning'
                        : hotInfo?.phase === 'trying'
                          ? 'error'
                          : 'default'
                  "
                >
                  {{
                    hotInfo?.phase === "active"
                      ? "Active (稳定生效)"
                      : hotInfo?.phase === "staged"
                        ? "Staged (已就绪待重启)"
                        : hotInfo?.phase === "trying"
                          ? "Trying (试跑验证中)"
                          : "内置初始"
                  }}
                </n-tag>
              </div>
            </div>

            <!-- 待重启生效警告条 -->
            <n-alert
              v-if="hotInfo?.phase === 'staged'"
              title="增量补丁已安全解压就绪"
              type="warning"
              :closable="false"
              style="margin-bottom: 16px"
            >
              点击下方按钮立即重启应用即可切换至新静态资源版本。
            </n-alert>

            <div class="button-matrix">
              <n-button
                type="warning"
                secondary
                :loading="isLoading('hot:check')"
                @click="checkHotUpdateAction"
              >
                检查增量更新
              </n-button>

              <n-button
                type="success"
                :disabled="hotInfo?.phase !== 'staged'"
                :loading="isLoading('hot:restart')"
                @click="restartForHotUpdate"
              >
                立即重启生效
              </n-button>

              <n-button secondary :loading="isLoading('hot:state')" @click="refreshHotState">
                刷新热更状态
              </n-button>
            </div>
          </n-card>

          <!-- 诊断与日志导出 -->
          <n-card class="feature-card full-width" size="small">
            <template #header>
              <div class="card-header-bar">
                <span class="card-title">📝 生产日志与审计 (electron-log)</span>
                <span class="card-badge">凭据自动脱敏</span>
              </div>
            </template>
            <p class="card-desc">主进程写入带有敏感字段脱敏保护的诊断日志，支持一键安全导出。</p>
            <div class="form-row">
              <n-select
                v-model:value="testLogLevel"
                :options="logLevelOptions"
                style="width: 110px"
              />
              <n-input v-model:value="testLogMessage" style="flex: 1" placeholder="输入日志内容" />
              <n-button
                type="primary"
                secondary
                :loading="isLoading('log:write')"
                @click="
                  run('log:write', '记录日志', () =>
                    desktop.invoke('log:write', testLogLevel, testLogMessage),
                  )
                "
              >
                写入日志
              </n-button>
              <n-button
                type="success"
                secondary
                :loading="isLoading('log:export')"
                @click="run('log:export', '导出诊断日志', () => desktop.invoke('log:export'))"
              >
                导出系统日志
              </n-button>
            </div>
          </n-card>
        </div>
      </n-tab-pane>
    </n-tabs>

    <!-- 底部结构化控制台输出终端 -->
    <n-card class="console-card" size="small">
      <template #header>
        <div class="console-header">
          <div class="console-title">
            <span class="dot"></span>
            <strong>实时交互与调试终端 (Interactive Terminal Console)</strong>
            <n-tag size="small" type="info" round>{{ consoleLogs.length }} 条记录</n-tag>
          </div>
          <div class="console-actions">
            <n-button size="small" quaternary @click="copyConsole">复制全部</n-button>
            <n-button size="small" quaternary type="error" @click="clearConsole"
              >清空控制台</n-button
            >
          </div>
        </div>
      </template>

      <div ref="consoleContainer" class="console-body">
        <div v-if="consoleLogs.length === 0" class="console-empty">
          <span class="code-symbol">&gt;_</span>
          <span>控制台已就绪，触发上方功能按钮即可查看实时结构化返回结果...</span>
        </div>
        <div v-for="log in consoleLogs" :key="log.id" class="console-row" :class="log.type">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-badge" :class="log.type">{{ log.label }}</span>
          <span v-if="log.duration !== undefined" class="log-duration">{{ log.duration }}ms</span>
          <div class="log-payload">
            <code>{{ typeof log.data === "string" ? log.data : JSON.stringify(log.data) }}</code>
          </div>
        </div>
      </div>
    </n-card>
  </section>
</template>

<style scoped>
.playground-dashboard {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding-bottom: 40px;
}

/* 顶部 Hero 仪表 */
.dashboard-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding: 18px 24px;
  background: var(--app-bg-surface);
  border: 1px solid var(--app-border);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.hero-title-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.hero-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--app-text-primary);
}

.web-mode-hint {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--app-bg-muted);
  color: var(--app-text-secondary);
}

.hero-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--app-text-secondary);
}

.hero-metrics {
  display: flex;
  gap: 18px;
  align-items: center;
}

.metric-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 6px 14px;
  background: var(--app-bg-subtle);
  border: 1px solid var(--app-border-subtle);
  border-radius: 8px;
}

.metric-label {
  font-size: 11px;
  color: var(--app-text-muted);
}

.metric-value {
  font-size: 14px;
  color: var(--app-text-primary);
}

/* 标签页与网格布局 */
.tab-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 8px 0;
}

.full-width {
  grid-column: span 2;
}

/* 功能卡片通用样式 */
.feature-card {
  border-radius: 10px;
  border: 1px solid var(--app-border);
}

.card-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text-primary);
}

.card-badge {
  font-size: 11px;
  color: var(--app-text-muted);
  background: var(--app-bg-muted);
  padding: 2px 8px;
  border-radius: 4px;
}

.badge-group {
  display: flex;
  gap: 6px;
}

.axios-status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--app-bg-subtle);
  border-radius: 6px;
}

.muted-text {
  font-size: 12px;
  color: var(--app-text-secondary);
}

.hot-status-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  background: var(--app-bg-subtle);
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.status-metric {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.card-desc {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--app-text-secondary);
}

.button-matrix {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.switch-meta strong {
  display: block;
  font-size: 14px;
  color: var(--app-text-primary);
}

.switch-meta small {
  font-size: 12px;
  color: var(--app-text-secondary);
}

.form-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.deep-link-banner {
  margin-top: 12px;
  padding: 8px 12px;
  background: var(--app-bg-subtle);
  border-radius: 6px;
  font-size: 12px;
}

.deep-link-banner code {
  color: var(--app-primary);
  word-break: break-all;
}

/* 下载传输样式 */
.concurrency-control-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  padding: 10px 14px;
  background: var(--app-bg-subtle);
  border-radius: 8px;
  margin-bottom: 14px;
  font-size: 13px;
}

.download-create-box {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.download-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.download-item-card {
  padding: 12px 14px;
  border: 1px solid var(--app-border-subtle);
  background: var(--app-bg-surface);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.url-text {
  font-size: 13px;
  font-weight: 500;
  max-width: 70%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.id-text {
  font-size: 11px;
  color: var(--app-text-muted);
}

.error-msg {
  font-size: 12px;
  color: var(--app-danger);
}

.update-progress-box {
  background: var(--app-bg-subtle);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
}

/* 控制台终端卡片样式 */
.console-card {
  border-radius: 12px;
  border: 1px solid var(--app-border);
}

.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.console-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.console-actions {
  display: flex;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
}

.console-body {
  max-height: 280px;
  overflow-y: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  background: #0f172a;
  color: #f8fafc;
  padding: 12px 16px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.console-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #64748b;
  padding: 16px 0;
}

.code-symbol {
  color: #38bdf8;
  font-weight: 700;
}

.console-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  line-height: 1.6;
}

.log-time {
  color: #64748b;
  font-size: 11px;
}

.log-badge {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.log-badge.success {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.log-badge.error {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.log-badge.info {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
}

.log-duration {
  font-size: 10px;
  color: #eab308;
}

.log-payload {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-payload code {
  color: #cbd5e1;
}
</style>
