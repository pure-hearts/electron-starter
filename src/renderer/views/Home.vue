<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>
<template>
  <section class="home">
    <div class="home-hero">
      <div class="home-title-row">
        <h1>{{ t("welcome") }}</h1>
        <n-tag type="success" size="large" round>v0.1.3 升级版</n-tag>
      </div>
      <p class="home-subtitle">{{ t("description") }}</p>
    </div>

    <n-card style="margin-bottom: 16px; border: 1px dashed var(--app-primary)">
      <template #header>
        <span style="font-weight: 600; color: var(--app-primary)">🎉 v0.1.3 新版本特性展示</span>
      </template>
      <ul style="margin: 0; padding-left: 20px; line-height: 1.8; color: var(--app-text-regular)">
        <li>
          ✨ <strong>双端同构与热更新闭环</strong>：支持 Electron 桌面端与纯 Web 端独立启动，内置
          Ed25519 增量资源热更新与崩溃自愈回滚
        </li>
        <li>
          🎨 <strong>Naive UI 全面升级</strong>：纯 TypeScript
          按需引入、完美适配深色模式、浅色模式与系统跟随
        </li>
        <li>
          ⚡ <strong>VueUse 响应式请求层</strong>：内置 <code>useAxios</code>
          与脱敏错误拦截器，告别繁琐样板代码
        </li>
      </ul>
    </n-card>

    <n-card>
      <p style="margin-top: 0">src/main · src/preload · src/renderer · src/shared</p>
      <n-button type="primary" @click="$router.push('/playground')">{{
        t("openPlayground")
      }}</n-button>
    </n-card>
  </section>
</template>
