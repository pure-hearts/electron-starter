<template>
  <div
    ref="recorderRef"
    tabindex="0"
    class="relative inline-flex items-center justify-between min-w-260px max-w-380px h-38px px-3 rounded-md bg-app-bg-surface border border-app-border cursor-pointer outline-none transition-all duration-200 select-none box-border hover:border-emerald-400"
    :class="[
      isRecording ? 'border-emerald-400 ring-2 ring-emerald-400/30' : '',
      disabled ? 'opacity-60 cursor-not-allowed bg-black/3' : '',
      errorMessage ? 'border-red-400' : '',
    ]"
    @click="startRecording"
    @focus="startRecording"
    @blur="stopRecording"
    @keydown="handleKeyDown"
    @keyup="handleKeyUp"
  >
    <div class="flex items-center flex-1 overflow-hidden">
      <!-- 录制激活态 -->
      <template v-if="isRecording">
        <span
          v-if="tempModifiers.length === 0"
          class="inline-flex items-center gap-1.5 text-12px text-app-text-muted"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          {{ placeholder || "请在键盘上按下组合键..." }}
        </span>
        <div v-else class="flex items-center gap-1.5 flex-nowrap">
          <span
            v-for="mod in tempModifiers"
            :key="mod"
            class="inline-flex items-center gap-0.75 px-1.75 py-0.5 rounded font-mono text-12px font-600 leading-tight text-emerald-500 border border-emerald-400 bg-emerald-400/10 shadow-sm"
          >
            {{ mod }}
          </span>
          <span class="text-12px text-emerald-400 ml-0.5">+ ...</span>
        </div>
      </template>

      <!-- 静态展示态 -->
      <template v-else>
        <div v-if="displayKeys.length > 0" class="flex items-center gap-1.5 flex-nowrap">
          <span
            v-for="(key, index) in displayKeys"
            :key="index"
            class="inline-flex items-center gap-0.75 px-1.75 py-0.5 rounded font-mono text-12px font-600 leading-tight text-app-text-regular bg-app-bg-subtle border border-app-border shadow-sm"
            :title="key.label"
          >
            <span class="text-13px">{{ key.symbol }}</span>
            <span v-if="key.symbol !== key.label" class="text-11px opacity-80">{{
              key.label
            }}</span>
          </span>
        </div>
        <span v-else class="inline-flex items-center gap-1.5 text-12px text-app-text-muted">
          未设置快捷键
        </span>
      </template>
    </div>

    <!-- 右侧操作小图标 -->
    <div class="flex items-center ml-2" @click.stop>
      <button
        v-if="isRecording"
        type="button"
        class="bg-transparent border-none cursor-pointer text-12px px-1.5 py-0.5 rounded text-app-text-secondary transition-all hover:(bg-black/8 text-app-text-primary)"
        title="按 Esc 或点击取消"
        @click="cancelRecording"
      >
        取消 (Esc)
      </button>
      <button
        v-else-if="modelValue && !disabled && allowClear"
        type="button"
        class="bg-transparent border-none cursor-pointer text-12px px-1.5 py-0.5 rounded text-app-text-secondary transition-all hover:(bg-black/8 text-app-text-primary)"
        title="清除快捷键"
        @click="clearShortcut"
      >
        ✕
      </button>
      <span v-else-if="!disabled" class="text-11px text-app-text-muted">点击修改</span>
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
