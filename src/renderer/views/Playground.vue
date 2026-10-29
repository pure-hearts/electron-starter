<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { useAppStore, type ThemeMode } from "../stores/app";
import type { DownloadState, UpdateState, HotUpdateResult, HotUpdateInfo } from "../../shared/ipc";

const desktop = window.$ipcBridge;
const appStore = useAppStore();

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
const autoScroll = ref(true);
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
  ElMessage.info("调试日志已清空");
}

async function copyConsole() {
  try {
    const text = JSON.stringify(consoleLogs.value, null, 2);
    await navigator.clipboard.writeText(text);
    ElMessage.success("日志内容已复制到剪贴板");
  } catch {
    ElMessage.warning("复制失败，请手动选择复制");
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
    ElMessage.success({ message: `${label} 执行成功`, duration: 2000 });
    return result;
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    const msg = String(err);
    appendLog(label, "error", msg, duration);
    ElMessage.error({ message: `${label} 失败: ${msg}`, duration: 3500 });
    return undefined;
  } finally {
    setLoading(key, false);
  }
}

// ----------------- Tab 1: 窗口与系统 -----------------
const customNoticeTitle = ref("Electron Starter");
const customNoticeBody = ref("这是一条来自开发者控制台的原生通知测试");

async function toggleStartup(enabled: boolean | string | number) {
  const val = Boolean(enabled);
  await run("startup", "开机自启动设置", async () => {
    startupEnabled.value = await desktop.invoke("startup:set", val);
    return startupEnabled.value ? "已开启自启动" : "已关闭自启动";
  });
}

function updateCloseToTray(enabled: boolean | string | number) {
  const val = Boolean(enabled);
  void run("closeToTray", "关闭到托盘设置", async () => {
    await desktop.invoke("store:set", "closeToTray", val);
    closeToTray.value = val;
    return val ? "开启关闭到托盘" : "关闭窗口直接退出";
  });
}

// ----------------- Tab 2: 数据与传输 -----------------
const defaultDownloadURL =
  import.meta.env.VITE_APP_DOWNLOAD_TEST_URL ||
  "https://github.com/pure-hearts/electron-starter/releases/download/v0.1.0/latest.yml";
const downloadURL = ref(defaultDownloadURL);
const downloads = ref<DownloadState[]>([]);
const printList = ref<string[]>([]);
const themeValue = ref<ThemeMode>("system");

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
    ElMessage.warning("请输入合法的 HTTP/HTTPS 下载地址");
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
  if (!fullUpdateState.value) return 0;
  const status = fullUpdateState.value.status;
  if (status === "checking") return 1;
  if (status.startsWith("available") || status === "downloading") return 2;
  if (status === "ready") return 3;
  return 0;
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
        refreshHotState();
      }
      appendLog("更新状态推送", state.error ? "error" : "info", state);
    }),
  );
  unsubscribers.push(
    desktop.on("protocol:open", (url) => {
      appendLog("Deep Link 唤醒", "info", { url });
      ElMessage.info({ message: `接收到 Deep Link 唤醒: ${url}`, duration: 3000 });
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
          <el-tag type="primary" effect="dark" size="small" round>Playground Pro</el-tag>
        </div>
        <p class="hero-sub">22 项原生系统能力综合测试面板 · 严格运行在沙箱与类型安全 IPC 架构下</p>
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
          <el-progress
            :percentage="concurrencyRatio"
            :stroke-width="6"
            :show-text="false"
            style="width: 80px; margin-top: 4px"
            :status="concurrencyRatio >= 100 ? 'warning' : 'primary'"
          />
        </div>
        <div class="metric-chip">
          <span class="metric-label">Deep Link</span>
          <strong class="metric-value" style="color: var(--el-color-success)">
            {{ appStore.lastDeepLink ? "已连接" : "就绪监听" }}
          </strong>
        </div>
      </div>
    </header>

    <!-- 核心功能标签页 Tabs -->
    <el-tabs v-model="activeTab" class="dashboard-tabs" type="border-card">
      <!-- Tab 1: 窗口与系统 -->
      <el-tab-pane name="window">
        <template #label>
          <span class="tab-label">🖥️ 窗口与系统控制</span>
        </template>
        <div class="tab-grid">
          <!-- 窗口动作控制卡片 -->
          <el-card class="feature-card" shadow="never">
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
              <el-button
                type="primary"
                plain
                :loading="isLoading('win:open')"
                @click="
                  run('win:open', '打开新窗口', () => desktop.invoke('window:open', '/playground'))
                "
              >
                新建子窗口
              </el-button>
              <el-button
                :loading="isLoading('win:min')"
                @click="
                  run('win:min', '最小化窗口', () => desktop.invoke('window:action', 'minimize'))
                "
              >
                最小化
              </el-button>
              <el-button
                :loading="isLoading('win:max')"
                @click="
                  run('win:max', '最大化窗口', () => desktop.invoke('window:action', 'maximize'))
                "
              >
                最大化
              </el-button>
              <el-button
                :loading="isLoading('win:restore')"
                @click="
                  run('win:restore', '恢复窗口', () => desktop.invoke('window:action', 'restore'))
                "
              >
                还原尺寸
              </el-button>
              <el-button
                type="warning"
                plain
                :loading="isLoading('win:hide')"
                @click="
                  run('win:hide', '隐藏到托盘', () => desktop.invoke('window:action', 'hide'))
                "
              >
                隐藏至托盘
              </el-button>
            </div>
          </el-card>

          <!-- 系统偏好与托盘设置 -->
          <el-card class="feature-card" shadow="never">
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
              <el-switch
                v-model="closeToTray"
                :loading="isLoading('closeToTray')"
                @change="updateCloseToTray"
              />
            </div>
            <el-divider style="margin: 14px 0" />
            <div class="switch-row">
              <div class="switch-meta">
                <strong>开机自动启动应用</strong>
                <small>跨平台支持 Windows 注册表、macOS LoginItem 与 Linux XDG autostart</small>
              </div>
              <el-switch
                v-model="startupEnabled"
                :loading="isLoading('startup')"
                @change="toggleStartup"
              />
            </div>
          </el-card>

          <!-- 桌面通知测试 -->
          <el-card class="feature-card full-width" shadow="never">
            <template #header>
              <div class="card-header-bar">
                <span class="card-title">🔔 原生桌面通知与协议</span>
                <span class="card-badge">NotificationCenter</span>
              </div>
            </template>
            <div class="form-row">
              <el-input v-model="customNoticeTitle" placeholder="通知标题" style="width: 220px" />
              <el-input v-model="customNoticeBody" placeholder="通知内容主体" style="flex: 1" />
              <el-button
                type="primary"
                :loading="isLoading('notice:send')"
                @click="
                  run('notice:send', '发送桌面通知', () =>
                    desktop.invoke('notification:show', customNoticeTitle, customNoticeBody),
                  )
                "
              >
                发送测试通知
              </el-button>
              <el-button
                :loading="isLoading('protocol')"
                @click="run('protocol', '查询协议名', () => desktop.invoke('protocol:scheme'))"
              >
                查询 Deep Link 协议
              </el-button>
            </div>
            <div v-if="appStore.lastDeepLink" class="deep-link-banner">
              <span>🔗 捕获到唤醒参数：</span>
              <code>{{ appStore.lastDeepLink }}</code>
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- Tab 2: 数据传输与存储 -->
      <el-tab-pane name="transfer">
        <template #label>
          <span class="tab-label">📦 数据持久化与传输</span>
        </template>
        <div class="tab-grid">
          <!-- 并发控制器与新建下载 -->
          <el-card class="feature-card full-width" shadow="never">
            <template #header>
              <div class="card-header-bar">
                <span class="card-title">⚡ 传输队列调度中心</span>
                <span class="card-badge">FIFO 队列 & 1-50 并发限制</span>
              </div>
            </template>

            <!-- 并发设置联动 -->
            <div class="concurrency-control-bar">
              <span class="label">最大并行下载并发数：</span>
              <el-slider
                v-model="downloadConcurrency"
                :min="1"
                :max="50"
                style="flex: 1; max-width: 320px; margin: 0 16px"
              />
              <el-input-number
                v-model="downloadConcurrency"
                :min="1"
                :max="50"
                :step="1"
                size="small"
              />
              <el-button
                type="primary"
                size="small"
                plain
                :loading="isLoading('concurrency:set')"
                @click="saveDownloadConcurrency"
              >
                保存设置并持久化
              </el-button>
            </div>

            <!-- 下载新建 -->
            <div class="download-create-box">
              <el-input
                v-model="downloadURL"
                placeholder="请输入完整 HTTPS 文件下载地址"
                clearable
                style="flex: 1"
              >
                <template #prepend>HTTPS</template>
              </el-input>
              <el-button
                type="success"
                :loading="isLoading('download:start')"
                @click="beginDownload"
              >
                发起下载任务
              </el-button>
            </div>

            <!-- 下载任务列表展示 -->
            <div class="downloads-wrapper">
              <el-empty
                v-if="downloads.length === 0"
                description="暂无活跃下载任务，请在上方输入地址创建"
                :image-size="64"
                style="padding: 12px 0"
              />
              <div v-else class="download-list">
                <div v-for="item in downloads" :key="item.id" class="download-item-card">
                  <div class="item-header">
                    <span class="url-text" :title="item.url">{{ item.url }}</span>
                    <el-tag
                      size="small"
                      :type="
                        item.state === 'completed'
                          ? 'success'
                          : item.state === 'failed'
                            ? 'danger'
                            : item.state === 'paused'
                              ? 'warning'
                              : 'primary'
                      "
                    >
                      {{ item.state }}
                    </el-tag>
                  </div>

                  <!-- 生产级动画进度条 -->
                  <div class="item-progress">
                    <el-progress
                      :percentage="item.percent ?? 0"
                      :stroke-width="10"
                      :striped="item.state === 'progress'"
                      :striped-flow="item.state === 'progress'"
                      :status="
                        item.state === 'completed'
                          ? 'success'
                          : item.state === 'failed'
                            ? 'exception'
                            : item.state === 'paused'
                              ? 'warning'
                              : undefined
                      "
                    />
                  </div>

                  <div class="item-footer">
                    <span v-if="item.error" class="error-msg">⚠️ {{ item.error }}</span>
                    <span v-else class="id-text">TaskID: {{ item.id.slice(0, 8) }}...</span>

                    <el-button-group class="action-group">
                      <el-button
                        size="small"
                        :disabled="!['started', 'progress'].includes(item.state)"
                        :loading="isLoading(`${item.id}:pause`)"
                        @click="operateDownload(item.id, 'pause')"
                      >
                        暂停
                      </el-button>
                      <el-button
                        size="small"
                        :disabled="item.state !== 'paused'"
                        :loading="isLoading(`${item.id}:resume`)"
                        @click="operateDownload(item.id, 'resume')"
                      >
                        恢复
                      </el-button>
                      <el-button
                        size="small"
                        type="danger"
                        plain
                        :disabled="
                          !['queued', 'started', 'progress', 'paused'].includes(item.state)
                        "
                        :loading="isLoading(`${item.id}:cancel`)"
                        @click="operateDownload(item.id, 'cancel')"
                      >
                        取消
                      </el-button>
                      <el-button
                        size="small"
                        type="primary"
                        plain
                        :disabled="!['failed', 'cancelled'].includes(item.state)"
                        :loading="isLoading(`${item.id}:retry`)"
                        @click="operateDownload(item.id, 'retry')"
                      >
                        重试
                      </el-button>
                    </el-button-group>
                  </div>
                </div>
              </div>
            </div>
          </el-card>

          <!-- 本地配置与持久化 -->
          <el-card class="feature-card" shadow="never">
            <template #header>
              <div class="card-header-bar">
                <span class="card-title">🗄️ 本地配置存储 (electron-store)</span>
                <span class="card-badge">安全持久化</span>
              </div>
            </template>
            <p class="card-desc">对应用偏好进行 Schema 校验写入，保证系统启动自动恢复。</p>
            <div class="form-row">
              <el-select v-model="themeValue" style="width: 140px">
                <el-option label="跟随系统" value="system" />
                <el-option label="浅色模式" value="light" />
                <el-option label="深色模式" value="dark" />
              </el-select>
              <el-button
                type="primary"
                :loading="isLoading('theme:set')"
                @click="run('theme:set', '写入主题模式', () => appStore.setTheme(themeValue))"
              >
                写入主题
              </el-button>
              <el-button
                :loading="isLoading('theme:get')"
                @click="
                  run('theme:get', '读取持久化主题', () => desktop.invoke('store:get', 'theme'))
                "
              >
                读取存储
              </el-button>
            </div>
          </el-card>

          <!-- 打印服务 -->
          <el-card class="feature-card" shadow="never">
            <template #header>
              <div class="card-header-bar">
                <span class="card-title">🖨️ 系统打印服务</span>
                <span class="card-badge">原生打印机探测</span>
              </div>
            </template>
            <div class="button-matrix" style="margin-bottom: 12px">
              <el-button
                type="primary"
                plain
                :loading="isLoading('printers:get')"
                @click="loadPrinters"
              >
                扫描本地打印机
              </el-button>
              <el-button
                :loading="isLoading('print:run')"
                @click="run('print:run', '调用系统打印', () => desktop.invoke('print:execute'))"
              >
                打印当前视图
              </el-button>
            </div>
            <div class="printer-tags">
              <span v-if="printList.length === 0" class="muted-text"
                >暂未发现打印设备，点击上方按钮扫描</span
              >
              <el-tag
                v-for="p in printList"
                :key="p"
                size="small"
                type="info"
                style="margin-right: 6px; margin-bottom: 6px"
              >
                {{ p }}
              </el-tag>
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- Tab 3: 更新与系统诊断 -->
      <el-tab-pane name="update">
        <template #label>
          <span class="tab-label">🔄 应用升级与诊断</span>
        </template>
        <div class="tab-grid">
          <!-- 整包自动更新流程 -->
          <el-card class="feature-card full-width" shadow="never">
            <template #header>
              <div class="card-header-bar">
                <span class="card-title">🚀 全量自动更新 (electron-updater)</span>
                <span class="card-badge">跨平台差分下载</span>
              </div>
            </template>

            <!-- 更新步骤流转 -->
            <el-steps
              :active="updateStep"
              finish-status="success"
              simple
              style="margin-bottom: 18px"
            >
              <el-step title="1. 检查最新版本" />
              <el-step title="2. 下载更新包" />
              <el-step title="3. 就绪安装" />
            </el-steps>

            <!-- 更新下载专用大进度条 -->
            <div v-if="isFullUpdateDownloading" class="update-progress-box">
              <div class="progress-info">
                <span>正在下载新版本安装包...</span>
                <strong>{{ fullUpdatePercent }}%</strong>
              </div>
              <el-progress
                :percentage="fullUpdatePercent"
                :stroke-width="12"
                striped
                striped-flow
                status="primary"
              />
            </div>

            <div class="button-matrix">
              <el-button
                type="primary"
                :loading="isLoading('updater:check') || fullUpdateState?.status === 'checking'"
                :disabled="isFullUpdateDownloading"
                @click="run('updater:check', '检查整包更新', () => desktop.invoke('updater:check'))"
              >
                检查整包更新
              </el-button>

              <el-button
                type="success"
                :disabled="fullUpdateState?.status !== 'ready'"
                :loading="isLoading('updater:install')"
                @click="
                  run('updater:install', '退出并安装更新', () => desktop.invoke('updater:install'))
                "
              >
                安装整包并重启
              </el-button>

              <el-button
                :loading="isLoading('app:restart')"
                @click="run('app:restart', '重启应用进程', () => desktop.invoke('app:restart'))"
              >
                重启应用
              </el-button>
            </div>
          </el-card>

          <!-- 增量热更新卡片 (独立卡片) -->
          <el-card class="feature-card full-width" shadow="never">
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
              仅下载并热替换渲染层静态资源（2~5MB），跳过主进程与安装向导，支持多源分发与异常自动回退。
            </p>

            <!-- 热更状态信息面板 -->
            <div class="hot-status-panel">
              <div class="status-metric">
                <span class="metric-label">生效版本标签</span>
                <el-tag size="small" type="primary" effect="plain" class="metric-tag">
                  {{ hotInfo?.currentVersionTag || "内置版本" }}
                </el-tag>
              </div>

              <div class="status-metric">
                <span class="metric-label">Git 提交 Hash</span>
                <el-tag size="small" type="info" effect="plain" class="metric-tag font-mono">
                  {{ hotInfo?.currentCommit || "base" }}
                </el-tag>
              </div>

              <div class="status-metric">
                <span class="metric-label">生命周期阶段</span>
                <el-tag
                  size="small"
                  :type="
                    hotInfo?.phase === 'active'
                      ? 'success'
                      : hotInfo?.phase === 'staged'
                        ? 'warning'
                        : hotInfo?.phase === 'trying'
                          ? 'danger'
                          : 'info'
                  "
                  effect="dark"
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
                </el-tag>
              </div>
            </div>

            <!-- 待重启生效警告条 -->
            <el-alert
              v-if="hotInfo?.phase === 'staged'"
              title="增量补丁已安全解压就绪，点击下方按钮立即重启应用即可生效"
              type="warning"
              show-icon
              :closable="false"
              style="margin-bottom: 16px"
            />

            <div class="button-matrix">
              <el-button
                type="warning"
                plain
                :loading="isLoading('hot:check')"
                @click="checkHotUpdateAction"
              >
                检查增量更新
              </el-button>

              <el-button
                type="success"
                :disabled="hotInfo?.phase !== 'staged'"
                :loading="isLoading('hot:restart')"
                @click="restartForHotUpdate"
              >
                立即重启生效
              </el-button>

              <el-button plain :loading="isLoading('hot:state')" @click="refreshHotState">
                刷新热更状态
              </el-button>
            </div>
          </el-card>

          <!-- 诊断与日志导出 -->
          <el-card class="feature-card full-width" shadow="never">
            <template #header>
              <div class="card-header-bar">
                <span class="card-title">📝 生产日志与审计 (electron-log)</span>
                <span class="card-badge">凭据自动脱敏</span>
              </div>
            </template>
            <p class="card-desc">主进程写入带有敏感字段脱敏保护的诊断日志，支持一键安全导出。</p>
            <div class="form-row">
              <el-select v-model="testLogLevel" style="width: 100px">
                <el-option label="Info" value="info" />
                <el-option label="Warn" value="warn" />
                <el-option label="Error" value="error" />
              </el-select>
              <el-input v-model="testLogMessage" style="flex: 1" placeholder="输入日志内容" />
              <el-button
                type="primary"
                plain
                :loading="isLoading('log:write')"
                @click="
                  run('log:write', '记录日志', () =>
                    desktop.invoke('log:write', testLogLevel, testLogMessage),
                  )
                "
              >
                写入日志
              </el-button>
              <el-button
                type="success"
                plain
                :loading="isLoading('log:export')"
                @click="run('log:export', '导出诊断日志', () => desktop.invoke('log:export'))"
              >
                导出系统日志
              </el-button>
            </div>
          </el-card>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 底部结构化控制台输出终端 -->
    <el-card class="console-card" shadow="never">
      <template #header>
        <div class="console-header">
          <div class="console-title">
            <span class="dot green"></span>
            <strong>实时交互与调试终端 (Interactive Terminal Console)</strong>
            <el-tag size="small" type="info" round>{{ consoleLogs.length }} 条记录</el-tag>
          </div>
          <div class="console-actions">
            <el-button size="small" text @click="copyConsole">复制全部</el-button>
            <el-button size="small" text type="danger" @click="clearConsole">清空控制台</el-button>
          </div>
        </div>
      </template>

      <div ref="consoleContainer" class="console-body">
        <div v-if="consoleLogs.length === 0" class="console-empty">
          <span class="code-symbol">>_</span>
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
    </el-card>
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
  background: var(--el-bg-color-overlay, #ffffff);
  border: 1px solid var(--el-border-color-light, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.hero-title-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hero-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary, #0f172a);
}

.hero-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary, #64748b);
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
  background: var(--el-fill-color-light, #f8fafc);
  border: 1px solid var(--el-border-color-lighter, #f1f5f9);
  border-radius: 8px;
}

.metric-label {
  font-size: 11px;
  color: var(--el-text-color-placeholder, #94a3b8);
}

.metric-value {
  font-size: 14px;
  color: var(--el-text-color-primary, #1e293b);
}

/* 标签页与网格布局 */
.dashboard-tabs {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-light, #e2e8f0);
}

.tab-label {
  font-weight: 600;
  font-size: 14px;
}

.tab-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 8px 4px;
}

.full-width {
  grid-column: span 2;
}

/* 功能卡片通用样式 */
.feature-card {
  border-radius: 10px;
  border: 1px solid var(--el-border-color-light, #e2e8f0);
  transition: all 0.2s ease;
}

.card-header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary, #0f172a);
}

.card-badge {
  font-size: 11px;
  color: var(--el-text-color-placeholder, #94a3b8);
  background: var(--el-fill-color-light, #f1f5f9);
  padding: 2px 8px;
  border-radius: 4px;
}

.badge-group {
  display: flex;
  gap: 6px;
}

.hot-status-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  background: var(--el-fill-color-light, #f8fafc);
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.status-metric {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.metric-label {
  font-size: 12px;
  color: var(--el-text-color-secondary, #64748b);
}

.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.card-desc {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--el-text-color-secondary, #64748b);
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
  color: var(--el-text-color-primary, #1e293b);
}

.switch-meta small {
  font-size: 12px;
  color: var(--el-text-color-secondary, #64748b);
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
  background: var(--el-fill-color-light, #f8fafc);
  border-radius: 6px;
  font-size: 12px;
}

.deep-link-banner code {
  color: var(--el-color-primary, #2563eb);
  word-break: break-all;
}

/* 下载传输样式 */
.concurrency-control-bar {
  display: flex;
  align-items: center;
  padding: 10px 14px;
  background: var(--el-fill-color-light, #f8fafc);
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
  border: 1px solid var(--el-border-color-lighter, #f1f5f9);
  background: var(--el-fill-color-blank, #ffffff);
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
  color: var(--el-text-color-placeholder, #94a3b8);
}

.error-msg {
  font-size: 12px;
  color: var(--el-color-danger, #ef4444);
}

.update-progress-box {
  background: var(--el-fill-color-light, #f8fafc);
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
  border: 1px solid var(--el-border-color-light, #e2e8f0);
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
  background: var(--el-fill-color-darker, #0f172a);
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
