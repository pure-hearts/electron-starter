<template>
  <div class="w-full">
    <!-- 头部工具操作栏 -->
    <div class="flex items-center justify-between pb-2">
      <div class="search-box">
        <n-input
          v-model:value="searchKeyword"
          placeholder="按命令名称、键位 (如 Ctrl, ,) 搜索快捷键..."
          clearable
          size="small"
          class="max-w-320px"
        >
          <template #prefix>
            <span class="text-13px opacity-60">🔍</span>
          </template>
        </n-input>
      </div>

      <div class="flex gap-2">
        <n-button secondary size="small" @click="handleResetAll"> 恢复全部默认 </n-button>
        <n-button text type="info" size="small" @click="showHelpModal = true">
          快捷键帮助与排障
        </n-button>
      </div>
    </div>

    <!-- 状态反馈提示 -->
    <div v-if="feedbackMsg.text" class="mt-2">
      <n-alert :type="feedbackMsg.type" closable @close="feedbackMsg.text = ''">
        {{ feedbackMsg.text }}
      </n-alert>
    </div>

    <!-- VS Code 风格键盘快捷键表格 -->
    <div class="mt-3 overflow-x-auto border border-app-border-subtle rounded-md bg-app-bg-surface">
      <table class="w-full border-collapse text-13px text-left">
        <thead>
          <tr>
            <th
              class="w-36% bg-app-bg-subtle px-3.5 py-2 font-semibold text-app-text-muted border-b border-app-border-subtle"
            >
              命令
            </th>
            <th
              class="w-28% bg-app-bg-subtle px-3.5 py-2 font-semibold text-app-text-muted border-b border-app-border-subtle"
            >
              键绑定
            </th>
            <th
              class="w-20% bg-app-bg-subtle px-3.5 py-2 font-semibold text-app-text-muted border-b border-app-border-subtle"
            >
              当
            </th>
            <th
              class="w-16% text-right bg-app-bg-subtle px-3.5 py-2 font-semibold text-app-text-muted border-b border-app-border-subtle"
            >
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in filteredShortcuts"
            :key="item.id"
            class="border-b border-app-border-subtle transition-colors duration-150 hover:bg-app-bg-hover"
            :class="{ 'bg-sky-500/6': editingId === item.id }"
          >
            <!-- 1. 命令列 -->
            <td class="w-36% px-3.5 py-2 align-middle">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="bg-transparent border-none cursor-pointer p-1 rounded inline-flex items-center text-app-text-muted transition-all hover:(text-emerald-500 bg-emerald-500/10)"
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
                <div class="flex flex-col">
                  <span class="font-medium text-app-text-primary">{{ item.name }}</span>
                  <span v-if="item.description" class="text-11px text-app-text-muted mt-0.5">{{
                    item.description
                  }}</span>
                </div>
              </div>
            </td>

            <!-- 2. 键绑定列 -->
            <td class="w-28% px-3.5 py-2 align-middle">
              <!-- 行内编辑态：输入框录制控件 -->
              <div v-if="editingId === item.id" class="max-w-240px">
                <ShortcutRecorder
                  :model-value="tempAccelerator"
                  placeholder="按键盘组合键进行录制..."
                  @update:model-value="onTempAcceleratorChange"
                  @error="onRecorderError"
                />
              </div>

              <!-- 静态展示态：按键标签 -->
              <div
                v-else
                class="inline-flex items-center gap-1 cursor-pointer"
                @dblclick="startEdit(item)"
              >
                <template v-if="item.accelerator">
                  <span
                    v-for="(k, idx) in formatKeys(item.accelerator)"
                    :key="idx"
                    class="inline-flex items-center justify-center min-w-22px h-22px px-1.5 text-11px font-mono font-600 rounded bg-app-bg-subtle text-app-text-primary border border-app-border-subtle shadow-sm"
                  >
                    {{ k.symbol }}
                  </span>
                </template>
                <span v-else class="text-12px text-app-text-muted italic">未设置快捷键</span>
              </div>
            </td>

            <!-- 3. 生效条件 (当) 列 -->
            <td class="w-20% px-3.5 py-2 align-middle">
              <span
                class="text-11px px-1.5 py-0.5 rounded bg-app-bg-subtle text-app-text-muted border border-app-border-subtle"
                :class="{ 'bg-sky-500/8 text-sky-600 border-sky-500/20': item.scope === 'global' }"
              >
                {{ item.when }}
              </span>
            </td>

            <!-- 4. 操作列 (可修改，可重置，可取消) -->
            <td class="w-16% text-right px-3.5 py-2 align-middle">
              <div v-if="editingId === item.id" class="inline-flex items-center gap-1.5">
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

              <div v-else class="inline-flex items-center gap-1.5">
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
            <td colspan="4" class="text-center py-6 text-app-text-muted">未找到匹配的快捷键设置</td>
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
      <div class="space-y-4">
        <div>
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

        <div>
          <h4 class="text-sm font-semibold mb-2">2. 快捷键冲突排障提示</h4>
          <ul class="text-xs space-y-1.5 text-app-text-muted pl-4 list-disc">
            <li>
              <strong>全局快捷键被占用</strong
              >：若设置的全局快捷键无响应，通常是已被系统其他软件（如微信、输入法、截图工具）独占。建议更换为带有三键修饰键的冷门组合。
            </li>
            <li>
              <strong>只在应用聚焦时生效</strong
              >：标识为“仅聚焦窗口”的快捷键，在窗口失焦或隐藏至系统托盘时不会触发，避免干扰桌面其他操作。
            </li>
          </ul>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end">
          <n-button size="small" type="primary" @click="showHelpModal = false"> 了解完毕 </n-button>
        </div>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useShortcutsStore } from "../stores/shortcuts";
import { formatAcceleratorDisplay, isMacPlatform } from "../utils/shortcut";
import ShortcutRecorder from "./ShortcutRecorder.vue";
import { feedback } from "../utils/feedback";
import type { ShortcutDefinition } from "@shared/ipc";

const shortcutsStore = useShortcutsStore();
const isMac = isMacPlatform();

const searchKeyword = ref("");
const editingId = ref<string | null>(null);
const tempAccelerator = ref<string>("");
const isSaving = ref(false);
const showHelpModal = ref(false);
const feedbackMsg = ref<{ type: "success" | "error" | "info"; text: string }>({
  type: "info",
  text: "",
});

const filteredShortcuts = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return shortcutsStore.shortcuts;

  return shortcutsStore.shortcuts.filter((s) => {
    return (
      s.name.toLowerCase().includes(kw) ||
      (s.description && s.description.toLowerCase().includes(kw)) ||
      s.accelerator.toLowerCase().includes(kw) ||
      s.when.toLowerCase().includes(kw)
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

function cancelEdit() {
  editingId.value = null;
  tempAccelerator.value = "";
  feedbackMsg.value.text = "";
}

function onTempAcceleratorChange(val: string) {
  tempAccelerator.value = val;
}

function onRecorderError(msg: string) {
  feedback.message.warning(msg);
}

async function saveEdit(id: string) {
  if (!tempAccelerator.value) {
    feedback.message.warning("快捷键不能为空");
    return;
  }

  isSaving.value = true;
  try {
    const res = await shortcutsStore.updateShortcut(id, tempAccelerator.value);
    if (res.success) {
      feedback.message.success("快捷键绑定已更新");
      cancelEdit();
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

async function handleResetAll() {
  await shortcutsStore.resetAll();
  cancelEdit();
  feedback.message.success("所有快捷键已恢复为出厂默认设置");
}
</script>
