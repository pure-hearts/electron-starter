<template>
  <n-drawer
    v-model:show="downloadStore.drawerVisible"
    :width="460"
    placement="right"
    :trap-focus="false"
    :block-scroll="false"
  >
    <n-drawer-content closable>
      <template #header>
        <div class="drawer-header">
          <div class="header-title-box">
            <span class="header-title">{{ t("downloadDrawer.title") }}</span>
            <n-badge
              v-if="downloadStore.activeCount > 0"
              :value="downloadStore.activeCount"
              type="primary"
            />
          </div>
          <div v-if="downloadStore.totalSpeed > 0" class="header-speed-tag">
            <n-tag size="small" type="success" :bordered="false" round>
              {{ formatSpeed(downloadStore.totalSpeed) }}
            </n-tag>
          </div>
        </div>
      </template>

      <n-tabs v-model:value="activeTab" type="segment" animated>
        <!-- 1. 进行中任务 -->
        <n-tab-pane
          name="active"
          :tab="t('downloadDrawer.tabActive', { count: downloadStore.activeList.length })"
        >
          <div v-if="downloadStore.activeList.length === 0" class="empty-box">
            <n-empty :description="t('downloadDrawer.emptyActive')" />
          </div>

          <div v-else class="task-list">
            <div
              v-for="task in downloadStore.activeList"
              :key="task.id"
              class="task-card"
              :class="{ 'is-interrupted': task.state === 'interrupted' }"
            >
              <div class="task-card-header">
                <div class="task-name" :title="task.filename || task.url">
                  {{ task.filename || getFilenameFromUrl(task.url) }}
                </div>
                <n-tag :type="getStatusTagType(task.state)" size="small" round>
                  {{ getStatusText(task.state) }}
                </n-tag>
              </div>

              <!-- 进度条 -->
              <div class="task-progress-box">
                <n-progress
                  type="line"
                  :percentage="task.percent ?? 0"
                  :status="getProgressStatus(task.state)"
                  :show-indicator="false"
                  :height="6"
                />
              </div>

              <!-- 指标行：大小、速率、ETA -->
              <div class="task-metrics">
                <span class="metric-bytes">
                  {{ formatBytes(task.receivedBytes) }} / {{ formatBytes(task.totalBytes) }}
                  <span v-if="task.percent !== undefined" class="metric-percent"
                    >({{ task.percent }}%)</span
                  >
                </span>
                <span v-if="task.state === 'progress'" class="metric-speed">
                  {{ formatSpeed(task.speed) }}
                  <span v-if="task.eta" class="metric-eta">· 约剩 {{ formatEta(task.eta) }}</span>
                </span>
                <span v-else-if="task.state === 'interrupted'" class="metric-interrupted">
                  网络连接波动，可恢复
                </span>
              </div>

              <!-- 错误或中断警示 -->
              <div v-if="task.state === 'interrupted'" class="interrupted-banner">
                <span class="interrupted-icon">⚠️</span>
                <span>检测到网络中断，已保存当前下载断点，请点击恢复重试。</span>
              </div>

              <!-- 操作按钮行 -->
              <div class="task-actions">
                <template v-if="task.state === 'progress'">
                  <n-button
                    size="tiny"
                    secondary
                    type="warning"
                    @click="downloadStore.pause(task.id)"
                  >
                    暂停
                  </n-button>
                </template>

                <template v-else-if="['paused', 'interrupted'].includes(task.state)">
                  <n-button
                    size="tiny"
                    type="primary"
                    :disabled="task.canResume === false"
                    @click="downloadStore.resume(task.id)"
                  >
                    恢复下载
                  </n-button>
                </template>

                <n-button
                  size="tiny"
                  quaternary
                  type="error"
                  @click="downloadStore.cancel(task.id)"
                >
                  取消
                </n-button>
              </div>
            </div>
          </div>
        </n-tab-pane>

        <!-- 2. 历史记录 -->
        <n-tab-pane
          name="history"
          :tab="t('downloadDrawer.tabHistory', { count: downloadStore.historyTasks.length })"
        >
          <div class="history-toolbar">
            <span class="history-count">共 {{ downloadStore.historyTasks.length }} 条记录</span>
            <n-button
              v-if="downloadStore.historyTasks.length > 0"
              size="tiny"
              quaternary
              type="error"
              @click="handleClearHistory"
            >
              清空记录
            </n-button>
          </div>

          <div v-if="downloadStore.historyTasks.length === 0" class="empty-box">
            <n-empty :description="t('downloadDrawer.emptyHistory')" />
          </div>

          <div v-else class="task-list">
            <div
              v-for="item in downloadStore.historyTasks"
              :key="item.id"
              class="task-card history-card"
            >
              <div class="task-card-header">
                <div class="task-name" :title="item.path || item.filename || item.url">
                  {{
                    item.filename ||
                    (item.path ? getBasename(item.path) : getFilenameFromUrl(item.url))
                  }}
                </div>
                <div class="history-tags">
                  <n-tag
                    v-if="item.state === 'completed' && item.fileExists === false"
                    size="small"
                    type="error"
                    round
                  >
                    文件已失效
                  </n-tag>
                  <n-tag :type="getStatusTagType(item.state)" size="small" round>
                    {{ getStatusText(item.state) }}
                  </n-tag>
                </div>
              </div>

              <div class="history-info">
                <span>{{ formatBytes(item.totalBytes || item.receivedBytes) }}</span>
                <span v-if="item.completedAt" class="history-time">
                  · {{ formatTime(item.completedAt) }}
                </span>
                <span v-if="item.error" class="history-error"> · {{ item.error }} </span>
              </div>

              <div class="task-actions history-actions">
                <template v-if="item.state === 'completed' && item.path">
                  <n-button
                    size="tiny"
                    type="primary"
                    ghost
                    :disabled="item.fileExists === false"
                    :loading="checkingFileId === item.id"
                    @click="handleOpenFile(item)"
                  >
                    <template #icon>
                      <svg
                        viewBox="0 0 24 24"
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                    </template>
                    打开文件
                  </n-button>
                  <n-button size="tiny" secondary @click="handleShowInFolder(item)">
                    <template #icon>
                      <svg
                        viewBox="0 0 24 24"
                        width="12"
                        height="12"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path
                          d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                        />
                      </svg>
                    </template>
                    定位
                  </n-button>
                </template>

                <template v-else-if="item.state === 'failed'">
                  <n-button
                    size="tiny"
                    type="primary"
                    secondary
                    @click="downloadStore.retry(item.id)"
                  >
                    重新下载
                  </n-button>
                </template>

                <n-button size="tiny" quaternary @click="handleRemoveHistory(item.id)">
                  删除记录
                </n-button>
              </div>
            </div>
          </div>
        </n-tab-pane>
      </n-tabs>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useDownloadStore, formatBytes, formatSpeed, formatEta } from "../stores/download";
import { feedback } from "../utils/feedback";
import type { DownloadState } from "@shared/ipc";

const { t } = useI18n();
const downloadStore = useDownloadStore();
const activeTab = ref<"active" | "history">("active");
const checkingFileId = ref<string | null>(null);

async function handleOpenFile(item: DownloadState): Promise<void> {
  if (!item.path) {
    feedback.message.warning("文件路径未记录", 2000);
    return;
  }
  checkingFileId.value = item.id;
  try {
    const success = await downloadStore.openFile(item.id, item.path);
    if (!success) {
      feedback.message.error("文件不存在或已被移动/删除", 3000);
    }
  } catch {
    feedback.message.error("打开文件失败", 3000);
  } finally {
    checkingFileId.value = null;
  }
}

async function handleShowInFolder(item: DownloadState): Promise<void> {
  if (!item.path) {
    feedback.message.warning("文件路径未记录", 2000);
    return;
  }
  try {
    const exists = await downloadStore.checkFileExists(item.id, item.path);
    if (!exists) {
      feedback.message.error("文件不存在或已被移动/删除", 3000);
      return;
    }
    const success = await downloadStore.showInFolder(item.path);
    if (success === false) {
      feedback.message.error("无法打开文件所在目录", 3000);
    }
  } catch {
    feedback.message.error("定位文件失败", 3000);
  }
}

async function handleRemoveHistory(id: string): Promise<void> {
  const ok = await downloadStore.removeHistory(id);
  if (ok) {
    feedback.message.success("已删除该记录", 2000);
  } else {
    feedback.message.error("删除记录失败", 2000);
  }
}

async function handleClearHistory(): Promise<void> {
  await downloadStore.clearCompleted();
  feedback.message.success("已清空已完成的下载记录", 2000);
}

function getFilenameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const seg = pathname.split("/").filter(Boolean).pop();
    return seg ? decodeURIComponent(seg) : "download";
  } catch {
    return "download";
  }
}

function getBasename(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath;
}

function getStatusTagType(
  state: DownloadState["state"],
): "default" | "primary" | "info" | "success" | "warning" | "error" {
  switch (state) {
    case "queued":
      return "default";
    case "started":
      return "info";
    case "progress":
      return "primary";
    case "paused":
      return "warning";
    case "interrupted":
      return "warning";
    case "completed":
      return "success";
    case "cancelled":
      return "default";
    case "failed":
      return "error";
  }
}

function getStatusText(state: DownloadState["state"]): string {
  switch (state) {
    case "queued":
      return t("downloadDrawer.states.progressing");
    case "started":
      return t("downloadDrawer.states.progressing");
    case "progress":
      return t("downloadDrawer.states.progressing");
    case "paused":
      return t("downloadDrawer.states.paused");
    case "interrupted":
      return t("downloadDrawer.states.interrupted");
    case "completed":
      return t("downloadDrawer.states.completed");
    case "cancelled":
      return t("downloadDrawer.states.cancelled");
    case "failed":
      return t("downloadDrawer.states.error");
  }
}

function getProgressStatus(
  state: DownloadState["state"],
): "default" | "success" | "error" | "warning" | "info" {
  if (state === "completed") return "success";
  if (state === "failed") return "error";
  if (state === "interrupted" || state === "paused") return "warning";
  return "info";
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}
</script>

<style scoped>
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-right: 16px;
}

.header-title-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title {
  font-size: 16px;
  font-weight: 600;
}

.empty-box {
  padding: 48px 0;
  display: flex;
  justify-content: center;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.task-card {
  padding: 12px;
  background: var(--n-color-embedded, rgba(125, 125, 125, 0.05));
  border: 1px solid var(--n-border-color, rgba(125, 125, 125, 0.15));
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: all 0.2s ease;
}

.task-card:hover {
  border-color: var(--n-primary-color, #18a058);
}

.task-card.is-interrupted {
  border-color: #f0a020;
  background: rgba(240, 160, 32, 0.04);
}

.task-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.task-name {
  font-weight: 500;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 280px;
}

.task-metrics {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--n-text-color-3, #999);
}

.metric-percent {
  margin-left: 4px;
  font-weight: 500;
}

.metric-interrupted {
  color: #f0a020;
}

.interrupted-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #f0a020;
  background: rgba(240, 160, 32, 0.08);
  padding: 6px 8px;
  border-radius: 4px;
}

.task-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.history-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.history-count {
  font-size: 12px;
  color: var(--n-text-color-3, #999);
}

.history-tags {
  display: flex;
  align-items: center;
  gap: 6px;
}

.history-info {
  font-size: 11px;
  color: var(--n-text-color-3, #999);
}

.history-error {
  color: #d03050;
}
</style>
