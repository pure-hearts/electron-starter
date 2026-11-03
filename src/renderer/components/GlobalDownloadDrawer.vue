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
        <div class="flex items-center justify-between w-full pr-4">
          <div class="flex items-center gap-2">
            <span class="text-16px font-semibold">{{ t("downloadDrawer.title") }}</span>
            <n-badge
              v-if="downloadStore.activeCount > 0"
              :value="downloadStore.activeCount"
              type="info"
            />
          </div>
          <div v-if="downloadStore.totalSpeed > 0">
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
          <div v-if="downloadStore.activeList.length === 0" class="py-12 flex justify-center">
            <n-empty :description="t('downloadDrawer.emptyActive')" />
          </div>

          <div v-else class="flex flex-col gap-3 mt-3">
            <div
              v-for="task in downloadStore.activeList"
              :key="task.id"
              class="p-3 bg-app-bg-subtle/50 border border-app-border rounded-lg flex flex-col gap-2 transition-all duration-200 hover:border-app-border-focus"
              :class="{ 'border-amber-500 bg-amber-500/4': task.state === 'interrupted' }"
            >
              <div class="flex items-center justify-between gap-2">
                <div
                  class="font-medium text-13px truncate max-w-280px"
                  :title="task.filename || task.url"
                >
                  {{ task.filename || getFilenameFromUrl(task.url) }}
                </div>
                <n-tag :type="getStatusTagType(task.state)" size="small" round>
                  {{ getStatusText(task.state) }}
                </n-tag>
              </div>

              <!-- 进度条 -->
              <div>
                <n-progress
                  type="line"
                  :percentage="task.percent ?? 0"
                  :status="getProgressStatus(task.state)"
                  :show-indicator="false"
                  :height="6"
                />
              </div>

              <!-- 指标行：大小、速率、ETA -->
              <div class="flex justify-between text-11px text-app-text-muted">
                <span>
                  {{ formatBytes(task.receivedBytes) }} / {{ formatBytes(task.totalBytes) }}
                  <span v-if="task.percent !== undefined" class="ml-1 font-medium"
                    >({{ task.percent }}%)</span
                  >
                </span>
                <span v-if="task.state === 'progress'">
                  {{ formatSpeed(task.speed) }}
                  <span v-if="task.eta">· 约剩 {{ formatEta(task.eta) }}</span>
                </span>
                <span v-else-if="task.state === 'interrupted'" class="text-amber-500">
                  网络连接波动，可恢复
                </span>
              </div>

              <!-- 错误或中断警示 -->
              <div
                v-if="task.state === 'interrupted'"
                class="flex items-center gap-1.5 text-11px text-amber-500 bg-amber-500/8 p-1.5 rounded"
              >
                <span>⚠️</span>
                <span>检测到网络中断，已保存当前下载断点，请点击恢复重试。</span>
              </div>

              <!-- 操作按钮行 -->
              <div class="flex justify-end gap-2 mt-1">
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
          <div class="flex justify-between items-center mb-2">
            <span class="text-12px text-app-text-muted"
              >共 {{ downloadStore.historyTasks.length }} 条记录</span
            >
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

          <div v-if="downloadStore.historyTasks.length === 0" class="py-12 flex justify-center">
            <n-empty :description="t('downloadDrawer.emptyHistory')" />
          </div>

          <div v-else class="flex flex-col gap-3 mt-3">
            <div
              v-for="item in downloadStore.historyTasks"
              :key="item.id"
              class="p-3 bg-app-bg-subtle/50 border border-app-border rounded-lg flex flex-col gap-2 transition-all duration-200 hover:border-app-border-focus"
            >
              <div class="flex items-center justify-between gap-2">
                <div
                  class="font-medium text-13px truncate max-w-280px"
                  :title="item.path || item.filename || item.url"
                >
                  {{
                    item.filename ||
                    (item.path ? getBasename(item.path) : getFilenameFromUrl(item.url))
                  }}
                </div>
                <div class="flex items-center gap-1.5">
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

              <div class="text-11px text-app-text-muted">
                <span>{{ formatBytes(item.totalBytes || item.receivedBytes) }}</span>
                <span v-if="item.completedAt"> · {{ formatTime(item.completedAt) }} </span>
                <span v-if="item.error" class="text-red-500"> · {{ item.error }} </span>
              </div>

              <div class="flex justify-end gap-2 mt-1">
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
import { useIpcBridge } from "../bridge";
import { feedback } from "../utils/feedback";
import type { DownloadItem } from "@shared/ipc";

const { t } = useI18n();
const downloadStore = useDownloadStore();
const { invoke } = useIpcBridge();

const activeTab = ref<"active" | "history">("active");
const checkingFileId = ref<string | null>(null);

function getStatusTagType(state: string): "default" | "info" | "success" | "warning" | "error" {
  switch (state) {
    case "progress":
      return "info";
    case "completed":
      return "success";
    case "paused":
      return "warning";
    case "interrupted":
      return "warning";
    case "failed":
    case "cancelled":
      return "error";
    default:
      return "default";
  }
}

function getProgressStatus(state: string): "default" | "success" | "warning" | "error" {
  switch (state) {
    case "completed":
      return "success";
    case "interrupted":
    case "paused":
      return "warning";
    case "failed":
    case "cancelled":
      return "error";
    default:
      return "default";
  }
}

function getStatusText(state: string): string {
  switch (state) {
    case "progress":
      return "正在下载";
    case "completed":
      return "已完成";
    case "paused":
      return "已暂停";
    case "interrupted":
      return "已断开";
    case "failed":
      return "失败";
    case "cancelled":
      return "已取消";
    default:
      return state;
  }
}

function getFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname.substring(pathname.lastIndexOf("/") + 1) || "download";
  } catch {
    return "download";
  }
}

function getBasename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  return normalized.substring(normalized.lastIndexOf("/") + 1);
}

async function handleOpenFile(item: DownloadItem) {
  if (!item.path) return;
  checkingFileId.value = item.id;
  try {
    const exists = await invoke("fs:exists", item.path);
    if (!exists) {
      item.fileExists = false;
      feedback.message.error("该本地文件已被移动或删除");
      return;
    }
    await invoke("shell:openPath", item.path);
  } catch (err) {
    feedback.message.error(String(err));
  } finally {
    checkingFileId.value = null;
  }
}

async function handleShowInFolder(item: DownloadItem) {
  if (!item.path) return;
  try {
    await invoke("shell:showItemInFolder", item.path);
  } catch (err) {
    feedback.message.error(String(err));
  }
}

async function handleRemoveHistory(id: string) {
  await downloadStore.removeHistory(id);
  feedback.message.success("已从历史记录中移除");
}

async function handleClearHistory() {
  await downloadStore.clearHistory();
  feedback.message.success("历史记录已全部清空");
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}-${date.getDate()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}
</script>
