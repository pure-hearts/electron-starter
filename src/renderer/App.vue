<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppStore } from './stores/app'
const { t, locale } = useI18n()
const appStore = useAppStore()
const current = computed(() => locale.value)
let unsubscribeDeepLink: (() => void) | undefined
onMounted(async () => {
  // Register listener first, then consume cold-start links so no link is lost.
  unsubscribeDeepLink = window.desktop.on('protocol:open', url => appStore.receiveDeepLink(url))
  try {
    const pending = await window.desktop.invoke('protocol:pending')
    for (const url of pending) appStore.receiveDeepLink(url)
  } catch (error) { console.warn('Could not load pending Deep Links', error) }
  try { locale.value = await appStore.hydrate() }
  catch (error) { console.warn('Could not load language preference', error) }
})
onUnmounted(() => unsubscribeDeepLink?.())
async function change(value: string) {
  try {
    await appStore.setLocale(value)
    locale.value = appStore.locale
  } catch (error) {
    console.warn('Language preference could not be saved', error)
  }
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
