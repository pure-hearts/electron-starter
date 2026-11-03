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
  <div v-if="capturedError" class="flex items-center justify-center min-h-[calc(100vh-80px)] p-6">
    <n-card class="max-w-620px w-full rounded-xl shadow-2xl" :bordered="true">
      <div class="text-center mb-5">
        <div
          class="w-14 h-14 rounded-full bg-red-500/12 text-red-500 inline-flex items-center justify-center mb-3.5"
        >
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
        <h2 class="text-18px font-semibold m-0 mb-2">视图渲染发生未捕获异常</h2>
        <p class="text-13px text-app-text-muted m-0 leading-normal">
          当前界面在渲染过程中遇到了错误。已阻止错误向上扩散，您可以尝试恢复或刷新。
        </p>
      </div>

      <div class="bg-black/25 rounded-lg p-3.5 mb-6 text-13px border border-white/8">
        <div class="text-red-400 break-words mb-1.5">
          <strong>错误摘要：</strong> {{ capturedError.message || String(capturedError) }}
        </div>
        <div v-if="errorInfo" class="text-slate-400 mb-2">
          <strong>生命周期钩子：</strong> {{ errorInfo }}
        </div>
        <n-collapse v-if="capturedError.stack" class="mt-2">
          <n-collapse-item title="查看详细堆栈跟踪 (Stack Trace)" name="stack">
            <pre
              class="font-mono text-11px leading-normal text-slate-300 bg-black/40 p-2.5 rounded-md max-h-200px overflow-auto whitespace-pre-wrap break-all"
              >{{ capturedError.stack }}</pre>
          </n-collapse-item>
        </n-collapse>
      </div>

      <div class="flex gap-3 justify-center">
        <n-button type="primary" @click="handleRetry"> 尝试重试 </n-button>
        <n-button secondary @click="handleGoHome"> 返回首页 </n-button>
        <n-button quaternary @click="handleReload"> 强制刷新页面 </n-button>
      </div>
    </n-card>
  </div>
  <slot v-else />
</template>
