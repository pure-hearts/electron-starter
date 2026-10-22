<script setup lang="ts">
import { useI18n } from "vue-i18n";
const { t } = useI18n();
</script>
<template>
  <section class="home">
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px">
      <h1>{{ t("welcome") }}</h1>
      <el-tag type="success" size="large" effect="dark">v0.1.1 升级版</el-tag>
    </div>
    <p>{{ t("description") }}</p>

    <el-card shadow="never" style="margin-bottom: 16px; border: 1px dashed var(--el-color-primary)">
      <template #header>
        <span style="font-weight: 600; color: var(--el-color-primary)"
          >🎉 v0.1.1 新版本特性展示</span
        >
      </template>
      <ul
        style="margin: 0; padding-left: 20px; line-height: 1.8; color: var(--el-text-color-regular)"
      >
        <li>
          ✨ <strong>全自动整包更新</strong>：支持通过 GitHub Releases 自动检测与下载全量更新包
        </li>
        <li>🎨 <strong>主题系统完善</strong>：完美适配深色模式、浅色模式与系统跟随</li>
        <li>🛡️ <strong>系统自愈加固</strong>：PID 孤儿进程守护与 macOS 通知签名增强</li>
      </ul>
    </el-card>

    <el-card shadow="never">
      <p>src/main · src/preload · src/renderer · src/shared</p>
      <el-button type="primary" @click="$router.push('/playground')">{{
        t("openPlayground")
      }}</el-button>
    </el-card>
  </section>
</template>
