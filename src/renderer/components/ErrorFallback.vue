<script setup lang="ts">
import { ref, onErrorCaptured } from "vue";
import { useRouter } from "vue-router";
import { NButton, NCard, NCollapse, NCollapseItem } from "naive-ui";

const router = useRouter();
const capturedError = ref<Error | null>(null);
const errorInfo = ref<string>("");

onErrorCaptured((err: Error, _instance, info: string) => {
  capturedError.value = err;
  errorInfo.value = info;
  // 返回 false 阻止错误继续向上传播导致整页白屏
  return false;
});

function handleRetry() {
  capturedError.value = null;
  errorInfo.value = "";
}

function handleReload() {
  window.location.reload();
}

function handleGoHome() {
  capturedError.value = null;
  errorInfo.value = "";
  void router.push("/");
}
</script>

<template>
  <div v-if="capturedError" class="error-fallback-container">
    <n-card class="error-card" :bordered="true">
      <div class="error-header">
        <div class="error-icon">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 class="error-title">视图渲染发生未捕获异常</h2>
        <p class="error-desc">
          当前界面在渲染过程中遇到了错误。已阻止错误向上扩散，您可以尝试恢复或刷新。
        </p>
      </div>

      <div class="error-detail">
        <div class="error-message">
          <strong>错误摘要：</strong> {{ capturedError.message || String(capturedError) }}
        </div>
        <div v-if="errorInfo" class="error-info">
          <strong>生命周期钩子：</strong> {{ errorInfo }}
        </div>
        <n-collapse v-if="capturedError.stack" class="stack-collapse">
          <n-collapse-item title="查看详细堆栈跟踪 (Stack Trace)" name="stack">
            <pre class="stack-box">{{ capturedError.stack }}</pre>
          </n-collapse-item>
        </n-collapse>
      </div>

      <div class="error-actions">
        <n-button type="primary" @click="handleRetry"> 尝试重试 </n-button>
        <n-button secondary @click="handleGoHome"> 返回首页 </n-button>
        <n-button quaternary @click="handleReload"> 强制刷新页面 </n-button>
      </div>
    </n-card>
  </div>
  <slot v-else />
</template>

<style scoped>
.error-fallback-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 80px);
  padding: 24px;
}

.error-card {
  max-width: 620px;
  width: 100%;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
}

.error-header {
  text-align: center;
  margin-bottom: 20px;
}

.error-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}

.error-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.error-desc {
  font-size: 13px;
  color: #8c8c8c;
  margin: 0;
  line-height: 1.5;
}

.error-detail {
  background: rgba(0, 0, 0, 0.25);
  border-radius: 8px;
  padding: 14px;
  margin-bottom: 24px;
  font-size: 13px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.error-message {
  color: #f87171;
  word-break: break-word;
  margin-bottom: 6px;
}

.error-info {
  color: #94a3b8;
  margin-bottom: 8px;
}

.stack-collapse {
  margin-top: 8px;
}

.stack-box {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  line-height: 1.5;
  color: #cbd5e1;
  background: rgba(0, 0, 0, 0.4);
  padding: 10px;
  border-radius: 6px;
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.error-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
