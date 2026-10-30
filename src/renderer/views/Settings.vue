<template>
  <div class="settings-page">
    <div class="settings-container">
      <!-- 页面头部 -->
      <div class="settings-header">
        <div class="header-left">
          <h2 class="title">设置中心</h2>
          <p class="subtitle">统一管理客户端常规偏好、下载配置、桌面通知、快捷键与系统诊断</p>
        </div>
        <div class="header-right">
          <n-button secondary size="small" :loading="settingsStore.saving" @click="handleSaveAll">
            保存配置
          </n-button>
        </div>
      </div>

      <n-card :bordered="false" class="settings-card" content-style="padding: 0;">
        <n-tabs type="line" size="large" animated class="settings-tabs" pane-class="settings-pane">
          <!-- 1. 常规设置 -->
          <n-tab-pane name="general" tab="常规设置">
            <div class="pane-content">
              <h3 class="section-title">界面与多语言</h3>
              <div class="setting-item">
                <div class="item-info">
                  <div class="item-title">语言偏好 (Language)</div>
                  <div class="item-desc">选择应用界面的首选语言，切换后立即生效并持久化</div>
                </div>
                <div class="item-control">
                  <n-select
                    v-model:value="form.locale"
                    :options="localeOptions"
                    style="width: 160px"
                    @update:value="onLocaleChange"
                  />
                </div>
              </div>

              <div class="setting-item">
                <div class="item-info">
                  <div class="item-title">外观主题 (Theme)</div>
                  <div class="item-desc">支持跟随系统偏好或固定选择浅色/深色主题模式</div>
                </div>
                <div class="item-control">
                  <n-radio-group
                    v-model:value="form.theme"
                    size="medium"
                    @update:value="onThemeChange"
                  >
                    <n-radio-button value="system">跟随系统</n-radio-button>
                    <n-radio-button value="light">浅色</n-radio-button>
                    <n-radio-button value="dark">深色</n-radio-button>
                  </n-radio-group>
                </div>
              </div>

              <n-divider />

              <h3 class="section-title">窗口与桌面启动行为</h3>
              <div class="setting-item">
                <div class="item-info">
                  <div class="item-title">关闭窗口时最小化到系统托盘</div>
                  <div class="item-desc">
                    关闭主窗口时不退出进程，常驻后台并通过托盘图标继续提供服务
                  </div>
                </div>
                <div class="item-control">
                  <n-switch v-model:value="form.closeToTray" @update:value="saveForm" />
                </div>
              </div>

              <div class="setting-item">
                <div class="item-info">
                  <div class="item-title">开机自动启动 (Auto Launch)</div>
                  <div class="item-desc">登录操作系统桌面时自动拉起主程序后台静默运行</div>
                </div>
                <div class="item-control">
                  <n-switch v-model:value="form.autoStart" @update:value="saveForm" />
                </div>
              </div>
            </div>
          </n-tab-pane>

          <!-- 2. 下载管理 -->
          <n-tab-pane name="download" tab="下载管理">
            <div class="pane-content">
              <h3 class="section-title">传输与存储路径</h3>
              <div class="setting-item column-layout">
                <div class="item-info">
                  <div class="item-title">默认下载保存目录</div>
                  <div class="item-desc">
                    未指定位置的新任务将自动存放至此文件夹；留空表示使用系统 Downloads 目录
                  </div>
                </div>
                <div class="item-control full-width flex items-center space-x-2 mt-2">
                  <n-input
                    v-model:value="form.defaultDownloadDir"
                    placeholder="系统默认 Downloads 文件夹"
                    readonly
                    class="flex-1"
                  />
                  <n-button secondary @click="handleSelectDownloadDir"> 更改目录 </n-button>
                  <n-button v-if="form.defaultDownloadDir" quaternary @click="resetDownloadDir">
                    重置
                  </n-button>
                </div>
              </div>

              <div class="setting-item column-layout">
                <div class="item-info flex justify-between items-center">
                  <div>
                    <div class="item-title">最大并发下载数</div>
                    <div class="item-desc">允许同时进行的最大网络下载传输连接数（1 ~ 50 任务）</div>
                  </div>
                  <n-tag type="info" size="small" round
                    >{{ form.downloadConcurrency }} 路并发</n-tag
                  >
                </div>
                <div class="item-control mt-3">
                  <n-slider
                    v-model:value="form.downloadConcurrency"
                    :min="1"
                    :max="50"
                    :step="1"
                    :marks="{ 1: '1', 10: '10 (推荐)', 25: '25', 50: '50' }"
                    @update:value="saveForm"
                  />
                </div>
              </div>

              <n-divider />

              <h3 class="section-title">任务恢复与自动化</h3>
              <div class="setting-item">
                <div class="item-info">
                  <div class="item-title">启动时自动恢复未完成任务</div>
                  <div class="item-desc">
                    应用意外中断或重启后，保留排队和未下载完成的文件任务状态
                  </div>
                </div>
                <div class="item-control">
                  <n-switch v-model:value="form.autoResumeDownloads" @update:value="saveForm" />
                </div>
              </div>
            </div>
          </n-tab-pane>

          <!-- 3. 通知偏好 -->
          <n-tab-pane name="notification" tab="通知中心">
            <div class="pane-content">
              <h3 class="section-title">系统桌面通知</h3>
              <div class="setting-item">
                <div class="item-info">
                  <div class="item-title">启用桌面通知</div>
                  <div class="item-desc">全局控制是否向系统通知中心推送横幅消息与提醒</div>
                </div>
                <div class="item-control">
                  <n-switch v-model:value="form.notificationsEnabled" @update:value="saveForm" />
                </div>
              </div>

              <div class="setting-item">
                <div class="item-info">
                  <div class="item-title">通知提示音</div>
                  <div class="item-desc">弹出系统桌面通知时伴随系统默认提示音效</div>
                </div>
                <div class="item-control">
                  <n-switch
                    v-model:value="form.notificationSound"
                    :disabled="!form.notificationsEnabled"
                    @update:value="saveForm"
                  />
                </div>
              </div>

              <n-divider />

              <h3 class="section-title">事件联动通知</h3>
              <div class="setting-item">
                <div class="item-info">
                  <div class="item-title">下载完成或失败时弹窗通知</div>
                  <div class="item-desc">
                    文件下载完毕后自动推送横幅，点击通知可直接在系统文件管理器中定位该文件
                  </div>
                </div>
                <div class="item-control">
                  <n-switch
                    v-model:value="form.notifyOnDownload"
                    :disabled="!form.notificationsEnabled"
                    @update:value="saveForm"
                  />
                </div>
              </div>

              <div class="setting-item">
                <div class="item-info">
                  <div class="item-title">版本更新就绪提醒</div>
                  <div class="item-desc">
                    整包更新或热更新补丁准备就绪时弹窗引导用户重启，防止静默重启
                  </div>
                </div>
                <div class="item-control">
                  <n-switch
                    v-model:value="form.notifyOnUpdate"
                    :disabled="!form.notificationsEnabled"
                    @update:value="saveForm"
                  />
                </div>
              </div>

              <div class="mt-4 pt-2">
                <n-button secondary type="info" size="small" @click="handleTestNotification">
                  测试发送一条系统通知
                </n-button>
              </div>
            </div>
          </n-tab-pane>

          <!-- 4. 全局快捷键 -->
          <n-tab-pane name="shortcut" tab="全局快捷键">
            <div class="pane-content">
              <h3 class="section-title">窗口显隐与老板键</h3>
              <div class="setting-item column-layout">
                <div class="item-info">
                  <div class="item-title">呼出 / 隐藏主窗口全局快捷键</div>
                  <div class="item-desc">
                    在任意应用程序中按下该快捷键，即可立即将主窗口调出并置顶；再次按下则隐藏至后台。
                  </div>
                </div>
                <div class="item-control mt-3">
                  <GlobalShortcutManager v-model="form.globalShortcutToggle" @change="saveForm" />
                </div>
              </div>
            </div>
          </n-tab-pane>

          <!-- 5. 系统诊断与日志 -->
          <n-tab-pane name="diagnostics" tab="系统诊断">
            <div class="pane-content">
              <div class="flex justify-between items-center mb-3">
                <h3 class="section-title mb-0">运行环境与硬件指标</h3>
                <n-button
                  secondary
                  size="small"
                  :loading="loadingDiagnostics"
                  @click="loadDiagnostics"
                >
                  刷新参数
                </n-button>
              </div>

              <div v-if="diagnostics" class="diagnostics-grid">
                <n-descriptions bordered size="small" :column="2">
                  <n-descriptions-item label="应用版本">
                    <n-tag size="small" type="success" round>{{ diagnostics.appVersion }}</n-tag>
                  </n-descriptions-item>
                  <n-descriptions-item label="打包状态">
                    <n-tag size="small" :type="diagnostics.isPackaged ? 'info' : 'warning'" round>
                      {{ diagnostics.isPackaged ? "已打包发布" : "开发/调试模式" }}
                    </n-tag>
                  </n-descriptions-item>
                  <n-descriptions-item label="Electron 核心">
                    {{ diagnostics.electronVersion || "N/A" }}
                  </n-descriptions-item>
                  <n-descriptions-item label="Chrome 引擎">
                    {{
                      diagnostics.chromeVersion ? diagnostics.chromeVersion.split(" ")[0] : "N/A"
                    }}
                  </n-descriptions-item>
                  <n-descriptions-item label="操作系统">
                    {{ diagnostics.osPlatform }} ({{ diagnostics.osRelease }},
                    {{ diagnostics.osArch }})
                  </n-descriptions-item>
                  <n-descriptions-item label="CPU 型号">
                    {{ diagnostics.cpuModel }}
                  </n-descriptions-item>
                  <n-descriptions-item label="系统内存">
                    空闲 {{ diagnostics.freeMemoryMb }} MB / 总计 {{ diagnostics.totalMemoryMb }} MB
                  </n-descriptions-item>
                  <n-descriptions-item label="进程运行时间">
                    {{ formatUptime(diagnostics.uptimeSeconds) }}
                  </n-descriptions-item>
                </n-descriptions>
              </div>

              <n-divider />

              <h3 class="section-title">故障排障与日志诊断包</h3>
              <div class="setting-item">
                <div class="item-info">
                  <div class="item-title">导出排障诊断包 (.zip)</div>
                  <div class="item-desc">
                    收集脱敏日志（密码、密钥与 Token 已自动屏蔽）与系统环境报告，压缩为标准 ZIP
                    文件以供技术支持定位问题。
                  </div>
                </div>
                <div class="item-control">
                  <n-button
                    type="primary"
                    secondary
                    :loading="exportingLogs"
                    @click="handleExportLogs"
                  >
                    打包并导出诊断日志
                  </n-button>
                </div>
              </div>
            </div>
          </n-tab-pane>

          <!-- 6. 关于 -->
          <n-tab-pane name="about" tab="关于模板">
            <div class="pane-content about-pane flex flex-col items-center py-6">
              <div class="about-logo mb-3">
                <svg
                  viewBox="0 0 24 24"
                  width="64"
                  height="64"
                  class="text-blue-500"
                  fill="currentColor"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <h2 class="text-xl font-bold mb-1">Electron Starter</h2>
              <div class="flex items-center space-x-2 mb-4">
                <n-tag type="info" size="small" round>v0.1.3</n-tag>
                <n-tag type="success" size="small" round>Commercial Ready</n-tag>
              </div>
              <p class="text-xs opacity-75 max-w-md text-center mb-6">
                轻量、严苛隔离、高可测性的现代化 Electron + Vue 3 + TypeScript
                商业脚手架模板。具备完整的双向类型化 IPC、安装与增量热更新、系统托盘、Shell
                安全集成与全套自动化测试门禁。
              </p>

              <div class="flex space-x-3">
                <n-button secondary size="small" @click="openRepo"> GitHub 仓库 </n-button>
                <n-button secondary size="small" @click="handleCheckUpdate">
                  检查版本更新
                </n-button>
              </div>
            </div>
          </n-tab-pane>
        </n-tabs>
      </n-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from "vue";
import { useSettingsStore } from "../stores/settings";
import { useAppStore } from "../stores/app";
import { feedback } from "../utils/feedback";
import GlobalShortcutManager from "../components/GlobalShortcutManager.vue";
import type { SystemDiagnostics, UserSettings } from "@shared/ipc";

const settingsStore = useSettingsStore();
const appStore = useAppStore();

const localeOptions = [
  { label: "简体中文 (zh-CN)", value: "zh-CN" },
  { label: "English (en-US)", value: "en-US" },
];

const form = reactive<UserSettings>({
  theme: "light",
  locale: "zh-CN",
  closeToTray: true,
  autoStart: false,
  defaultDownloadDir: "",
  downloadConcurrency: 10,
  autoResumeDownloads: true,
  notificationsEnabled: true,
  notificationSound: true,
  notifyOnDownload: true,
  notifyOnUpdate: true,
  globalShortcutToggle: "CommandOrControl+Shift+X",
});

const diagnostics = ref<SystemDiagnostics | null>(null);
const loadingDiagnostics = ref(false);
const exportingLogs = ref(false);

async function syncFromStore() {
  await settingsStore.loadSettings();
  Object.assign(form, settingsStore.settings);
}

onMounted(async () => {
  await syncFromStore();
  await loadDiagnostics();
});

async function saveForm() {
  await settingsStore.updateSettings({ ...form });
}

async function handleSaveAll() {
  await saveForm();
  feedback.message.success("设置已更新并持久化");
}

function onLocaleChange(val: string) {
  form.locale = val as "zh-CN" | "en-US";
  saveForm();
}

function onThemeChange(val: string) {
  form.theme = val as "light" | "dark" | "system";
  saveForm();
}

async function handleSelectDownloadDir() {
  if (typeof window !== "undefined" && window.$ipcBridge) {
    try {
      const selected = await window.$ipcBridge.invoke(
        "dialog:selectDirectory",
        form.defaultDownloadDir || undefined,
      );
      if (selected) {
        form.defaultDownloadDir = selected;
        await saveForm();
        feedback.message.success(`默认下载目录已更新为: ${selected}`);
      }
    } catch (e) {
      feedback.message.error("选择文件夹失败");
    }
  }
}

function resetDownloadDir() {
  form.defaultDownloadDir = "";
  saveForm();
  feedback.message.info("已重置为系统默认下载目录");
}

async function handleTestNotification() {
  if (typeof window !== "undefined" && window.$ipcBridge) {
    try {
      await window.$ipcBridge.invoke(
        "notification:show",
        "设置中心测试",
        "这是一条来自设置中心的测试桌面通知。",
      );
      feedback.message.success("已请求发送系统测试通知");
    } catch (e) {
      feedback.message.error("发送测试通知失败");
    }
  }
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
  } catch (e) {
    feedback.message.error("导出过程发生异常");
  } finally {
    exportingLogs.value = false;
  }
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h} 小时 ${m} 分 ${s} 秒`;
}

function openRepo() {
  if (typeof window !== "undefined" && window.$ipcBridge) {
    window.$ipcBridge.invoke(
      "shell:openExternal",
      "https://github.com/pure-hearts/electron-starter",
    );
  }
}

function handleCheckUpdate() {
  if (typeof window !== "undefined" && window.$ipcBridge) {
    window.$ipcBridge.invoke("updater:check");
    feedback.message.info("已触发检查版本更新，请查看状态提示");
  }
}
</script>

<style scoped>
.settings-page {
  padding: 24px;
  max-width: 960px;
  margin: 0 auto;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.settings-header .title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 6px 0;
}

.settings-header .subtitle {
  font-size: 13px;
  opacity: 0.7;
  margin: 0;
}

.settings-card {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.pane-content {
  padding: 16px 24px 28px 24px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 16px 0;
  opacity: 0.85;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
}

.setting-item.column-layout {
  flex-direction: column;
  align-items: flex-start;
}

.item-info .item-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.item-info .item-desc {
  font-size: 12px;
  opacity: 0.65;
  line-height: 1.4;
}

.diagnostics-grid {
  margin-top: 8px;
}

.about-logo {
  animation: float 4s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}
</style>
