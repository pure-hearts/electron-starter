<template>
  <div class="shortcut-center-container">
    <!-- 头部工具操作栏 -->
    <div class="table-toolbar flex-between">
      <div class="search-box">
        <n-input
          v-model:value="searchKeyword"
          placeholder="按命令名称、键位 (如 Ctrl, ,) 搜索快捷键..."
          clearable
          size="small"
          class="search-input"
        >
          <template #prefix>
            <span class="search-icon">🔍</span>
          </template>
        </n-input>
      </div>

      <div class="toolbar-actions flex gap-2">
        <n-button secondary size="small" @click="handleResetAll"> 恢复全部默认 </n-button>
        <n-button text type="info" size="small" @click="showHelpModal = true">
          快捷键帮助与排障
        </n-button>
      </div>
    </div>

    <!-- 状态反馈提示 -->
    <div v-if="feedbackMsg.text" class="status-alert mt-2">
      <n-alert :type="feedbackMsg.type" closable @close="feedbackMsg.text = ''">
        {{ feedbackMsg.text }}
      </n-alert>
    </div>

    <!-- VS Code 风格键盘快捷键表格 -->
    <div class="shortcut-table-wrapper mt-3">
      <table class="vscode-shortcut-table">
        <thead>
          <tr>
            <th class="col-cmd">命令</th>
            <th class="col-binding">键绑定</th>
            <th class="col-when">当</th>
            <th class="col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in filteredShortcuts"
            :key="item.id"
            class="shortcut-row"
            :class="{ 'is-editing': editingId === item.id }"
          >
            <!-- 1. 命令列 -->
            <td class="col-cmd">
              <div class="cmd-cell">
                <button
                  type="button"
                  class="edit-icon-btn"
                  title="点击修改此快捷键"
                  @click="startEdit(item)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="14"
                    height="14"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
                <div class="cmd-info">
                  <span class="cmd-title">{{ item.name }}</span>
                  <span v-if="item.description" class="cmd-desc">{{ item.description }}</span>
                </div>
              </div>
            </td>

            <!-- 2. 键绑定列 -->
            <td class="col-binding">
              <!-- 行内编辑态：输入框录制控件 -->
              <div v-if="editingId === item.id" class="inline-recorder-box">
                <ShortcutRecorder
                  :model-value="tempAccelerator"
                  placeholder="按键盘组合键进行录制..."
                  @update:model-value="onTempAcceleratorChange"
                  @error="onRecorderError"
                />
              </div>

              <!-- 静态展示态：按键标签 -->
              <div v-else class="keybinding-display" @dblclick="startEdit(item)">
                <template v-if="item.accelerator">
                  <span v-for="(k, idx) in formatKeys(item.accelerator)" :key="idx" class="key-cap">
                    {{ k.symbol }}
                  </span>
                </template>
                <span v-else class="key-none">未设置快捷键</span>
              </div>
            </td>

            <!-- 3. 生效条件 (当) 列 -->
            <td class="col-when">
              <span class="when-badge" :class="item.scope">
                {{ item.when }}
              </span>
            </td>

            <!-- 4. 操作列 (可修改，可重置，可取消) -->
            <td class="col-actions">
              <div v-if="editingId === item.id" class="edit-action-group">
                <n-button
                  type="primary"
                  size="tiny"
                  :loading="isSaving"
                  :disabled="isSaving || !tempAccelerator"
                  @click="saveEdit(item.id)"
                >
                  保存修改
                </n-button>
                <n-button
                  secondary
                  type="warning"
                  size="tiny"
                  :disabled="isSaving || tempAccelerator === item.defaultAccelerator"
                  @click="resetSingle(item.id)"
                >
                  重置默认
                </n-button>
                <n-button
                  secondary
                  type="default"
                  size="tiny"
                  :disabled="isSaving"
                  @click="cancelEdit"
                >
                  取消
                </n-button>
              </div>

              <div v-else class="normal-action-group">
                <n-button quaternary size="tiny" type="primary" @click="startEdit(item)">
                  修改
                </n-button>
                <n-button
                  v-if="item.accelerator !== item.defaultAccelerator"
                  quaternary
                  size="tiny"
                  type="warning"
                  @click="resetSingle(item.id)"
                >
                  重置
                </n-button>
              </div>
            </td>
          </tr>

          <tr v-if="filteredShortcuts.length === 0">
            <td colspan="4" class="empty-cell">未找到匹配的快捷键设置</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 快捷键指南与排障帮助弹窗 -->
    <n-modal
      v-model:show="showHelpModal"
      preset="card"
      title="键盘快捷键设置与排障指南"
      style="max-width: 640px; border-radius: 8px"
      :bordered="false"
      size="medium"
    >
      <div class="help-modal-content space-y-4">
        <div class="help-section">
          <h4 class="text-sm font-semibold mb-2">1. 操作系统键位对应关系</h4>
          <n-table size="small" :single-line="false">
            <thead>
              <tr>
                <th>通用规范 (Accelerator)</th>
                <th>macOS 对应按键</th>
                <th>Windows / Linux 对应按键</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><n-tag size="small" type="primary">CommandOrControl</n-tag></td>
                <td><code>⌘ Command</code></td>
                <td><code>Ctrl</code></td>
              </tr>
              <tr>
                <td><n-tag size="small" type="info">Alt</n-tag></td>
                <td><code>⌥ Option</code></td>
                <td><code>Alt</code></td>
              </tr>
              <tr>
                <td><n-tag size="small" type="info">Shift</n-tag></td>
                <td><code>⇧ Shift</code></td>
                <td><code>Shift</code></td>
              </tr>
            </tbody>
          </n-table>
        </div>

        <div class="help-section">
          <h4 class="text-sm font-semibold mb-1">2. 全局快捷键与应用内快捷键的区别</h4>
          <p class="text-xs text-neutral-500 leading-relaxed">
            <strong>全局系统热键</strong
            >：即使本应用处于后台或窗口最小化，在任何其他软件中按下该键位依然能呼出本应用。<br />
            <strong>应用内快捷键</strong
            >：仅在当前应用窗口被激活并聚焦时响应，避免与其他桌面软件发生全局热键抢占。
          </p>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <n-button type="primary" @click="showHelpModal = false">知道了</n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import ShortcutRecorder from "./ShortcutRecorder.vue";
import { useShortcutsStore, type ShortcutDefinition } from "../stores/shortcuts";
import { formatAcceleratorDisplay, isMacPlatform } from "../utils/shortcut";
import { feedback } from "../utils/feedback";

const shortcutsStore = useShortcutsStore();

const searchKeyword = ref("");
const editingId = ref<string | null>(null);
const tempAccelerator = ref("");
const isSaving = ref(false);
const showHelpModal = ref(false);

const feedbackMsg = ref<{ type: "success" | "error" | "warning"; text: string }>({
  type: "success",
  text: "",
});

const isMac = isMacPlatform();

const filteredShortcuts = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return shortcutsStore.shortcuts;
  return shortcutsStore.shortcuts.filter((item) => {
    return (
      item.name.toLowerCase().includes(kw) ||
      item.accelerator.toLowerCase().includes(kw) ||
      (item.description && item.description.toLowerCase().includes(kw)) ||
      item.when.toLowerCase().includes(kw)
    );
  });
});

function formatKeys(acc: string) {
  return formatAcceleratorDisplay(acc, isMac);
}

function startEdit(item: ShortcutDefinition) {
  editingId.value = item.id;
  tempAccelerator.value = item.accelerator;
  feedbackMsg.value.text = "";
}

function onTempAcceleratorChange(val: string) {
  tempAccelerator.value = val;
}

function onRecorderError(err: string) {
  feedbackMsg.value = {
    type: "warning",
    text: err,
  };
}

async function saveEdit(id: string) {
  if (!tempAccelerator.value) return;
  isSaving.value = true;
  try {
    const res = await shortcutsStore.updateShortcut(id, tempAccelerator.value);
    if (res.success) {
      feedback.message.success("快捷键已更新生效");
      editingId.value = null;
    } else {
      feedbackMsg.value = {
        type: "error",
        text: res.error || "快捷键更新失败，可能存在键位冲突",
      };
    }
  } finally {
    isSaving.value = false;
  }
}

async function resetSingle(id: string) {
  isSaving.value = true;
  try {
    const res = await shortcutsStore.resetShortcut(id);
    if (res.success) {
      feedback.message.success("已恢复为默认快捷键");
      if (editingId.value === id) {
        const item = shortcutsStore.shortcuts.find((s) => s.id === id);
        if (item) tempAccelerator.value = item.accelerator;
      }
    }
  } finally {
    isSaving.value = false;
  }
}

function cancelEdit() {
  editingId.value = null;
  tempAccelerator.value = "";
  feedbackMsg.value.text = "";
}

async function handleResetAll() {
  await shortcutsStore.resetAll();
  cancelEdit();
  feedback.message.success("所有快捷键已恢复为出厂默认设置");
}
</script>

<style scoped>
.shortcut-center-container {
  width: 100%;
}

.table-toolbar {
  padding-bottom: 8px;
}

.search-input {
  max-width: 320px;
}

.search-icon {
  font-size: 13px;
  opacity: 0.6;
}

.shortcut-table-wrapper {
  overflow-x: auto;
  border: 1px solid var(--app-border-subtle, rgba(0, 0, 0, 0.08));
  border-radius: 6px;
  background: var(--app-bg-card, #ffffff);
}

.vscode-shortcut-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}

.vscode-shortcut-table thead th {
  background: var(--app-bg-subtle, #f8fafc);
  padding: 8px 14px;
  font-weight: 600;
  color: var(--app-text-muted, #64748b);
  border-bottom: 1px solid var(--app-border-subtle, rgba(0, 0, 0, 0.08));
}

.vscode-shortcut-table tbody tr {
  border-bottom: 1px solid var(--app-border-subtle, rgba(0, 0, 0, 0.05));
  transition: background-color 0.15s ease;
}

.vscode-shortcut-table tbody tr:hover {
  background-color: var(--app-bg-hover, rgba(0, 0, 0, 0.02));
}

.vscode-shortcut-table tbody tr.is-editing {
  background-color: var(--app-bg-active, rgba(56, 189, 248, 0.06));
}

.vscode-shortcut-table td {
  padding: 8px 14px;
  vertical-align: middle;
}

.col-cmd {
  width: 36%;
}

.col-binding {
  width: 28%;
}

.col-when {
  width: 20%;
}

.col-actions {
  width: 16%;
  text-align: right;
}

.cmd-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.edit-icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  color: var(--app-text-muted, #94a3b8);
  transition: all 0.15s;
}

.edit-icon-btn:hover {
  color: var(--app-primary, #10b981);
  background: rgba(16, 185, 129, 0.1);
}

.cmd-info {
  display: flex;
  flex-direction: column;
}

.cmd-title {
  font-weight: 500;
  color: var(--app-text-primary, #1e293b);
}

.cmd-desc {
  font-size: 11px;
  color: var(--app-text-muted, #94a3b8);
  margin-top: 2px;
}

.keybinding-display {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.key-cap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
  border-radius: 4px;
  background: var(--app-bg-subtle, #f1f5f9);
  color: var(--app-text-primary, #334155);
  border: 1px solid var(--app-border-subtle, #cbd5e1);
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
}

.key-none {
  font-size: 12px;
  color: var(--app-text-muted, #94a3b8);
  font-style: italic;
}

.inline-recorder-box {
  max-width: 240px;
}

.when-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--app-bg-subtle, #f1f5f9);
  color: var(--app-text-muted, #64748b);
  border: 1px solid var(--app-border-subtle, rgba(0, 0, 0, 0.06));
}

.when-badge.global {
  background: rgba(14, 165, 233, 0.08);
  color: #0284c7;
  border-color: rgba(14, 165, 233, 0.2);
}

.edit-action-group,
.normal-action-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.empty-cell {
  text-align: center;
  padding: 24px 0;
  color: var(--app-text-muted, #94a3b8);
}
</style>
