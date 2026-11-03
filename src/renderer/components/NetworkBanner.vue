<template>
  <transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="-translate-y-full opacity-0"
    leave-active-class="transition-all duration-300 ease-in"
    leave-to-class="-translate-y-full opacity-0"
  >
    <div
      v-if="!isOnline"
      class="flex items-center justify-between px-4 py-2 bg-amber-500 text-white text-xs font-medium shadow-md select-none z-50"
    >
      <div class="flex items-center space-x-2">
        <svg
          class="w-4 h-4 animate-pulse flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.166a1 1 0 111.414 1.414M3 3l18 18"
          />
        </svg>
        <span>当前网络已断开连接，部分远程服务与下载功能可能受限</span>
      </div>
      <button
        class="underline opacity-90 hover:opacity-100 transition-opacity ml-4 cursor-pointer"
        @click="checkStatus"
      >
        刷新检测
      </button>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { feedback } from "../utils/feedback";
import { useIpcBridge } from "../bridge";

const isOnline = ref(true);
let unsubscribe: (() => void) | null = null;
const { invoke, on } = useIpcBridge();

async function checkStatus() {
  try {
    const res = await invoke("app:networkStatus");
    const prev = isOnline.value;
    isOnline.value = res.isOnline;
    if (!prev && res.isOnline) {
      feedback.message.success("网络连接已恢复正常");
    }
  } catch {
    isOnline.value = typeof navigator !== "undefined" ? navigator.onLine : true;
  }
}

function handleOnline() {
  isOnline.value = true;
  feedback.message.success("网络连接已恢复正常");
}

function handleOffline() {
  isOnline.value = false;
}

onMounted(() => {
  checkStatus();
  if (typeof window !== "undefined") {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    unsubscribe = on("network:change", ({ isOnline: online }) => {
      const prev = isOnline.value;
      isOnline.value = online;
      if (!prev && online) {
        feedback.message.success("网络连接已恢复正常");
      }
    });
  }
});

onUnmounted(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  }
  unsubscribe?.();
});
</script>
