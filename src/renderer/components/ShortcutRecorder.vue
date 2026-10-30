<template>
  <div
    ref="recorderRef"
    tabindex="0"
    class="shortcut-recorder"
    :class="{
      'is-recording': isRecording,
      'is-disabled': disabled,
      'has-error': !!errorMessage,
    }"
    @click="startRecording"
    @focus="startRecording"
    @blur="stopRecording"
    @keydown="handleKeyDown"
    @keyup="handleKeyUp"
  >
    <div class="recorder-content">
      <!-- 录制激活态 -->
      <template v-if="isRecording">
        <span v-if="tempModifiers.length === 0" class="placeholder-text">
          <span class="recording-dot"></span>
          {{ placeholder || "请在键盘上按下组合键..." }}
        </span>
        <div v-else class="key-tags">
          <span v-for="mod in tempModifiers" :key="mod" class="key-badge active">
            {{ mod }}
          </span>
          <span class="recording-wait">+ ...</span>
        </div>
      </template>

      <!-- 静态展示态 -->
      <template v-else>
        <div v-if="displayKeys.length > 0" class="key-tags">
          <span
            v-for="(key, index) in displayKeys"
            :key="index"
            class="key-badge"
            :title="key.label"
          >
            <span class="key-symbol">{{ key.symbol }}</span>
            <span v-if="key.symbol !== key.label" class="key-sublabel">{{ key.label }}</span>
          </span>
        </div>
        <span v-else class="placeholder-text empty">未设置快捷键</span>
      </template>
    </div>

    <!-- 右侧操作小图标 -->
    <div class="recorder-actions" @click.stop>
      <button
        v-if="isRecording"
        type="button"
        class="action-btn cancel-btn"
        title="按 Esc 或点击取消"
        @click="cancelRecording"
      >
        取消 (Esc)
      </button>
      <button
        v-else-if="modelValue && !disabled && allowClear"
        type="button"
        class="action-btn clear-btn"
        title="清除快捷键"
        @click="clearShortcut"
      >
        ✕
      </button>
      <span v-else-if="!disabled" class="action-hint">点击修改</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { parseKeyboardEvent, formatAcceleratorDisplay, isMacPlatform } from "../utils/shortcut";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    disabled?: boolean;
    placeholder?: string;
    allowClear?: boolean;
  }>(),
  {
    disabled: false,
    placeholder: "请在键盘上按下快捷键组合...",
    allowClear: false,
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "change", value: string): void;
  (e: "error", msg: string): void;
}>();

const recorderRef = ref<HTMLElement | null>(null);
const isRecording = ref(false);
const errorMessage = ref("");
const tempModifiers = ref<string[]>([]);

const isMac = isMacPlatform();

const displayKeys = computed(() => {
  return formatAcceleratorDisplay(props.modelValue, isMac);
});

function startRecording() {
  if (props.disabled || isRecording.value) return;
  isRecording.value = true;
  errorMessage.value = "";
  tempModifiers.value = [];
}

function stopRecording() {
  isRecording.value = false;
  tempModifiers.value = [];
}

function cancelRecording() {
  stopRecording();
  recorderRef.value?.blur();
}

function clearShortcut() {
  emit("update:modelValue", "");
  emit("change", "");
}

function handleKeyDown(e: KeyboardEvent) {
  if (!isRecording.value || props.disabled) return;

  // 阻止浏览器或系统默认快捷键
  e.preventDefault();
  e.stopPropagation();

  // 更新临时修饰键预览
  const mods: string[] = [];
  if (isMac ? e.metaKey : e.ctrlKey) mods.push(isMac ? "⌘ Cmd" : "Ctrl");
  if (e.altKey) mods.push(isMac ? "⌥ Option" : "Alt");
  if (e.shiftKey) mods.push(isMac ? "⇧ Shift" : "Shift");
  tempModifiers.value = mods;

  const result = parseKeyboardEvent(e);

  if (result.valid) {
    emit("update:modelValue", result.accelerator);
    emit("change", result.accelerator);
    stopRecording();
    recorderRef.value?.blur();
  } else if (!result.inProgress) {
    if (result.error === "已取消录制") {
      cancelRecording();
    } else if (result.error) {
      errorMessage.value = result.error;
      emit("error", result.error);
    }
  }
}

function handleKeyUp(e: KeyboardEvent) {
  if (!isRecording.value) return;

  // 当用户松开按键时刷新修饰键状态
  const mods: string[] = [];
  if (isMac ? e.metaKey : e.ctrlKey) mods.push(isMac ? "⌘ Cmd" : "Ctrl");
  if (e.altKey) mods.push(isMac ? "⌥ Option" : "Alt");
  if (e.shiftKey) mods.push(isMac ? "⇧ Shift" : "Shift");
  tempModifiers.value = mods;
}
</script>

<style scoped>
.shortcut-recorder {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  min-width: 260px;
  max-width: 380px;
  height: 38px;
  padding: 0 12px;
  border-radius: 6px;
  background-color: var(--n-color, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--n-border-color, rgba(140, 140, 140, 0.3));
  cursor: pointer;
  outline: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  box-sizing: border-box;
}

.shortcut-recorder:hover:not(.is-disabled) {
  border-color: #63e2b7;
}

.shortcut-recorder.is-recording {
  border-color: #63e2b7;
  box-shadow: 0 0 0 2px rgba(99, 226, 183, 0.2);
  animation: pulse-border 1.5s infinite;
}

.shortcut-recorder.is-disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: rgba(0, 0, 0, 0.03);
}

.shortcut-recorder.has-error {
  border-color: #e88080;
}

.recorder-content {
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
}

.key-tags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
}

.key-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--n-text-color, #333);
  background-color: var(--n-action-color, rgba(0, 0, 0, 0.06));
  border: 1px solid var(--n-border-color, rgba(0, 0, 0, 0.15));
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
}

.key-badge.active {
  color: #63e2b7;
  border-color: #63e2b7;
  background-color: rgba(99, 226, 183, 0.1);
}

.key-symbol {
  font-size: 13px;
}

.key-sublabel {
  font-size: 11px;
  opacity: 0.8;
}

.placeholder-text {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--n-text-color-disabled, #888);
}

.recording-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #63e2b7;
  animation: blink 1s infinite alternate;
}

.recording-wait {
  font-size: 12px;
  color: #63e2b7;
  margin-left: 2px;
}

.recorder-actions {
  display: flex;
  align-items: center;
  margin-left: 8px;
}

.action-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--n-text-color-secondary, #666);
  transition: all 0.15s ease;
}

.action-btn:hover {
  background-color: rgba(0, 0, 0, 0.08);
  color: var(--n-text-color, #111);
}

.action-hint {
  font-size: 11px;
  color: var(--n-text-color-disabled, #aaa);
}

@keyframes blink {
  from {
    opacity: 0.3;
  }
  to {
    opacity: 1;
  }
}

@keyframes pulse-border {
  0% {
    box-shadow: 0 0 0 1px rgba(99, 226, 183, 0.2);
  }
  50% {
    box-shadow: 0 0 0 3px rgba(99, 226, 183, 0.35);
  }
  100% {
    box-shadow: 0 0 0 1px rgba(99, 226, 183, 0.2);
  }
}
</style>
