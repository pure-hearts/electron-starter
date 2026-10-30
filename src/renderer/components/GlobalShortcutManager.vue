<template>
  <div class="global-shortcut-manager">
    <!-- 主操作栏 -->
    <div class="manager-bar flex flex-wrap items-center gap-3">
      <!-- 录制输入器 -->
      <ShortcutRecorder
        :model-value="modelValue"
        :disabled="disabled || isRegistering"
        @update:model-value="onShortcutChange"
        @error="onRecorderError"
      />

      <!-- 快捷动作按钮组 -->
      <n-button
        secondary
        type="default"
        size="small"
        :disabled="disabled || isRegistering || isDefaultShortcut"
        @click="resetToDefault"
      >
        恢复默认
      </n-button>

      <n-button text type="info" size="small" class="help-link-btn" @click="showHelpModal = true">
        <template #icon>
          <span class="help-icon">?</span>
        </template>
        快捷键排障与帮助
      </n-button>
    </div>

    <!-- 冲突与状态提示信息 -->
    <div v-if="statusFeedback.message" class="status-tip mt-2">
      <n-alert
        :type="statusFeedback.type"
        :title="statusFeedback.title"
        closable
        @close="clearStatusTip"
      >
        {{ statusFeedback.message }}
      </n-alert>
    </div>

    <!-- 快捷键指南与排障帮助弹窗 -->
    <n-modal
      v-model:show="showHelpModal"
      preset="card"
      title="全局快捷键设置与排障指南"
      style="max-width: 640px; border-radius: 8px"
      :bordered="false"
      size="medium"
    >
      <div class="help-modal-content space-y-4">
        <!-- 1. 跨平台键位映射说明 -->
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
              <tr>
                <td><n-tag size="small" type="default">Control</n-tag></td>
                <td><code>⌃ Control</code></td>
                <td><code>Ctrl</code></td>
              </tr>
            </tbody>
          </n-table>
        </div>

        <!-- 2. 为什么系统无法识别具体冲突软件？ -->
        <div class="help-section">
          <h4 class="text-sm font-semibold mb-1">2. 为什么无法获知哪个外部软件占用了按键？</h4>
          <p class="text-xs text-neutral-500 leading-relaxed">
            Windows 与 macOS
            内核为了保护用户隐私和防范键盘窃听（Keylogger），设计了严格的进程安全隔离。当热键被抢占时，底层
            API 仅返回“已被注册”布尔值或错误码，不提供持有者进程名。
          </p>
        </div>

        <!-- 3. 常见冲突软件与排查建议 -->
        <div class="help-section">
          <h4 class="text-sm font-semibold mb-2">3. 常见高频冲突排查排障</h4>
          <n-collapse default-expanded-names="common-apps">
            <n-collapse-item title="典型占用场景参考" name="common-apps">
              <ul class="text-xs space-y-1.5 list-disc pl-4 text-neutral-600 dark:text-neutral-400">
                <li>
                  <strong>微信 / QQ</strong>：默认占用
                  <code>Ctrl+Alt+A</code>、<code>Ctrl+Alt+W</code>。
                </li>
                <li>
                  <strong>输入法</strong>：例如 <code>Ctrl+Space</code> 或
                  <code>Ctrl+Shift</code> 用于中英文切换。
                </li>
                <li>
                  <strong>网易云音乐 / QQ音乐</strong>：常占用
                  <code>Ctrl+Alt+方向键</code> 切换曲目。
                </li>
                <li>
                  <strong>系统保留</strong>：macOS 的 <code>Cmd+Space</code>（聚焦搜索）、Windows 的
                  <code>Win+L</code>、<code>Ctrl+Alt+Del</code>。
                </li>
              </ul>
            </n-collapse-item>
          </n-collapse>
        </div>

        <!-- 4. 推荐安全预设 -->
        <div class="help-section">
          <h4 class="text-sm font-semibold mb-2">4. 推荐安全预设组合（低冲突率）</h4>
          <div class="flex flex-wrap gap-2">
            <n-button
              v-for="preset in recommendedPresets"
              :key="preset.val"
              size="small"
              secondary
              type="info"
              @click="applyPreset(preset.val)"
            >
              {{ preset.label }} ({{ preset.val }})
            </n-button>
          </div>
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

const props = withDefaults(
  defineProps<{
    modelValue: string;
    disabled?: boolean;
    defaultShortcut?: string;
  }>(),
  {
    disabled: false,
    defaultShortcut: "CommandOrControl+Shift+X",
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "change", value: string): void;
}>();

const showHelpModal = ref(false);
const isRegistering = ref(false);

const statusFeedback = ref<{
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
}>({
  type: "info",
  title: "",
  message: "",
});

const isDefaultShortcut = computed(() => {
  return props.modelValue === props.defaultShortcut;
});

const recommendedPresets = [
  { label: "主窗口切换", val: "CommandOrControl+Shift+X" },
  { label: "推荐组合 A", val: "CommandOrControl+Alt+K" },
  { label: "推荐组合 B", val: "CommandOrControl+Shift+H" },
  { label: "推荐组合 C", val: "Alt+Shift+O" },
];

function clearStatusTip() {
  statusFeedback.value = {
    type: "info",
    title: "",
    message: "",
  };
}

async function registerToMainProcess(newAccelerator: string): Promise<boolean> {
  if (typeof window === "undefined" || !window.$ipcBridge) {
    // 浏览器 Web 预览模式降级
    return true;
  }

  isRegistering.value = true;
  clearStatusTip();

  try {
    const res = await window.$ipcBridge.invoke("shortcut:register", newAccelerator);
    if (res.success) {
      statusFeedback.value = {
        type: "success",
        title: "快捷键已生效",
        message: `已成功绑定并注册全局快捷键: ${newAccelerator}`,
      };
      return true;
    } else {
      statusFeedback.value = {
        type: "error",
        title: "快捷键注册冲突",
        message:
          res.error || `快捷键 ${newAccelerator} 已被系统或其他应用程序占用，保持原设置不变。`,
      };
      return false;
    }
  } catch (error) {
    statusFeedback.value = {
      type: "error",
      title: "系统异常",
      message: "注册快捷键时发生异常，请稍后重试",
    };
    return false;
  } finally {
    isRegistering.value = false;
  }
}

async function onShortcutChange(newVal: string) {
  if (newVal === props.modelValue) return;

  if (!newVal) {
    emit("update:modelValue", "");
    emit("change", "");
    return;
  }

  // 先在主进程执行冲突检测与注册验证，验证通过后才向父级提交更新
  const ok = await registerToMainProcess(newVal);
  if (ok) {
    emit("update:modelValue", newVal);
    emit("change", newVal);
  }
}

function onRecorderError(errMsg: string) {
  statusFeedback.value = {
    type: "warning",
    title: "按键无效",
    message: errMsg,
  };
}

async function resetToDefault() {
  await onShortcutChange(props.defaultShortcut);
}

async function applyPreset(val: string) {
  showHelpModal.value = false;
  await onShortcutChange(val);
}
</script>

<style scoped>
.global-shortcut-manager {
  width: 100%;
}

.help-link-btn {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
}

.help-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: 1px solid currentColor;
  font-size: 11px;
  line-height: 1;
}

.help-modal-content code {
  background-color: rgba(0, 0, 0, 0.06);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
