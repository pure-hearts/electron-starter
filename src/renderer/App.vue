<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from './stores/app'
const { t, locale } = useI18n()
const appStore = useAppStore()
const current = computed(() => locale.value)
function change(value: string) {
  locale.value = value
  appStore.setLocale(value)
}
</script>
<template>
  <el-container class="app">
    <el-header class="header">
      <strong>Electron Starter</strong>
      <nav>
        <router-link to="/">{{ t('home') }}</router-link>
        <router-link to="/playground">{{ t('playground') }}</router-link>
      </nav>
      <el-select :model-value="current" style="width: 128px" @change="change">
        <el-option label="简体中文" value="zh-CN"/>
        <el-option label="English" value="en-US"/>
      </el-select>
    </el-header>
    <el-main><router-view/></el-main>
  </el-container>
</template>
