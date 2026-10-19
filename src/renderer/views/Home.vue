<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>
<template>
  <section class="home">
    <h1>{{ t('welcome') }}</h1>
    <p>{{ t('description') }}</p>
    <el-card shadow="never">
      <p>src/main · src/preload · src/renderer · src/shared</p>
      <el-button type="primary" @click="$router.push('/playground')">{{ t('openPlayground') }}</el-button>
    </el-card>
  </section>
</template>
