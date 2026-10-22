<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useAppStore, type ThemeMode } from '../stores/app'
import type { DownloadState, UpdateState } from '../../shared/ipc'
const desktop = window.$ipcBridge
const appStore = useAppStore()
const output = ref('选择系统功能进行测试')
const downloadURL = ref('https://example.com/')
const downloadConcurrency = ref(10)
async function saveDownloadConcurrency() {
  await run('下载并发设置', async () => {
    downloadConcurrency.value = await desktop.invoke('download:concurrency:set', downloadConcurrency.value)
    return downloadConcurrency.value
  })
}
const value = ref('dark')
const closeToTray = ref(false)
// 用任务 ID 分别记录状态；同时下载时互不覆盖。
const downloads = ref<DownloadState[]>([])
function updateDownload(state: DownloadState) {
  const index = downloads.value.findIndex(task => task.id === state.id)
  if (index < 0) downloads.value.push(state)
  else downloads.value[index] = { ...downloads.value[index], ...state }
}
async function operateDownload(id: string, action: 'pause' | 'resume' | 'cancel' | 'retry') {
  await run('下载操作', async () => {
    if (action === 'pause') return window.$ipcBridge.invoke('download:pause', id)
    if (action === 'resume') return window.$ipcBridge.invoke('download:resume', id)
    if (action === 'cancel') return window.$ipcBridge.invoke('download:cancel', id)
    return window.$ipcBridge.invoke('download:retry', id)
  })
}
const printList = ref<string[]>([])
const version = ref('')
const unsubscribers: Array<() => void> = []
async function run(label: string, fn: () => Promise<unknown>) {
  try { const result = await fn(); output.value = label + ': ' + JSON.stringify(result ?? 'OK') }
  catch(err) { output.value = label + ' 出错: ' + String(err) }
}
async function loadPrinters() {
  await run('打印机', async () => {
    printList.value = (await window.$ipcBridge.invoke('print:printers')).map(p => p.displayName)
    return printList.value
  })
}
function updateCloseToTray(enabled: boolean | string | number) {
  void run('关闭到托盘', () => desktop.invoke('store:set', 'closeToTray', Boolean(enabled)))
}
async function beginDownload() {
  await run('下载任务', async () => {
    const id = await window.$ipcBridge.invoke('download:start', downloadURL.value)
    if (!downloads.value.some(task => task.id === id))
      downloads.value.push({ id, url: downloadURL.value, state: 'queued' })
    return id
  })
}
onMounted(async () => {
  unsubscribers.push(window.$ipcBridge.on('download:state', (state: DownloadState) => { updateDownload(state); output.value = JSON.stringify(state) }))
  unsubscribers.push(window.$ipcBridge.on('update:state', (state: UpdateState) => { output.value = JSON.stringify(state) }))
  unsubscribers.push(window.$ipcBridge.on('protocol:open', url => { output.value = 'Deep Link: ' + url }))
  unsubscribers.push(window.$ipcBridge.on('notification:clicked', title => { output.value = '通知点击：' + title }))
  await run('版本', async () => { version.value = await window.$ipcBridge.invoke('app:version'); return version.value })
  downloadConcurrency.value = await desktop.invoke('download:concurrency:get')
  const saved = await window.$ipcBridge.invoke('store:get', 'closeToTray')
  closeToTray.value = saved === true
})
onUnmounted(() => unsubscribers.forEach(stop => stop()))
</script>
<template>
  <section class="playground">
    <h1>系统功能 Playground</h1>
    <p>仅用于模板能力验证；安装更新与系统权限操作须在真实安装包中测试。</p>
    <el-alert :title="'应用版本：' + version" type="info" :closable="false" />
    <el-card header="窗口与系统" shadow="never">
      <el-space wrap>
        <el-button @click="run('新窗口', () => desktop.invoke('window:open','/playground'))">新窗口</el-button>
        <el-button @click="run('最小化', () => desktop.invoke('window:action','minimize'))">最小化</el-button>
        <el-button @click="run('最大化', () => desktop.invoke('window:action','maximize'))">最大化</el-button>
        <el-button @click="run('恢复', () => desktop.invoke('window:action','restore'))">恢复</el-button>
        <el-button @click="run('隐藏', () => desktop.invoke('window:action','hide'))">隐藏到托盘</el-button>
        <el-button @click="run('通知', () => desktop.invoke('notification:show','Electron Starter','桌面通知测试'))">桌面通知</el-button>
        <el-button @click="run('协议', () => desktop.invoke('protocol:scheme'))">协议名称</el-button>
        <el-text v-if="appStore.lastDeepLink" type="success">最近唤醒：{{ appStore.lastDeepLink }}</el-text>
      </el-space>
      <p><el-switch v-model="closeToTray" @change="updateCloseToTray"/> 关闭窗口时隐藏到托盘</p>
      <el-button @click="run('查询开机自启', () => desktop.invoke('startup:get'))">查询开机自启</el-button>
      <el-button @click="run('启用开机自启', () => desktop.invoke('startup:set',true))">启用</el-button>
      <el-button @click="run('禁用开机自启', () => desktop.invoke('startup:set',false))">禁用</el-button>
    </el-card>
    <el-card header="本地持久化、下载、打印" shadow="never">
      <el-space wrap>
        <el-input v-model="value" style="width:150px"/>
        <el-button @click="run('存储写入', () => appStore.setTheme(value as ThemeMode))">写入主题</el-button>
        <el-button @click="run('存储读取', () => desktop.invoke('store:get','theme'))">读取主题</el-button>
      </el-space>
      <el-space wrap>
        <span>最大同时下载数：</span>
        <el-input-number v-model="downloadConcurrency" :min="1" :max="50" :step="1" />
        <el-button @click="saveDownloadConcurrency">保存并立即生效</el-button>
      </el-space>
      <p><el-input v-model="downloadURL" placeholder="HTTPS 文件下载地址"/></p>
      <el-button @click="beginDownload">添加下载任务</el-button>
      <div v-for="item in downloads" :key="item.id" style="margin: 12px 0">
        <div style="overflow-wrap: anywhere">{{ item.url }}</div>
        <el-progress :percentage="item.percent ?? 0" />
        <div>状态：{{ item.state }} <span v-if="item.error">— {{ item.error }}</span></div>
        <el-space wrap>
          <el-button size="small" :disabled="!['started', 'progress'].includes(item.state)" @click="operateDownload(item.id, 'pause')">暂停</el-button>
          <el-button size="small" :disabled="item.state !== 'paused'" @click="operateDownload(item.id, 'resume')">恢复</el-button>
          <el-button size="small" :disabled="!['queued', 'started', 'progress', 'paused'].includes(item.state)" @click="operateDownload(item.id, 'cancel')">取消</el-button>
          <el-button size="small" :disabled="item.state !== 'failed'" @click="operateDownload(item.id, 'retry')">重试</el-button>
        </el-space>
      </div>
      <el-space wrap>
        <el-button @click="loadPrinters">获取打印机</el-button>
        <el-button @click="run('打印', () => desktop.invoke('print:execute'))">打印当前页面</el-button>
      </el-space>
      <p>{{ printList.join('、') }}</p>
    </el-card>
    <el-card header="应用更新、日志" shadow="never">
      <el-space wrap>
        <el-button @click="run('整包更新', () => desktop.invoke('updater:check'))">检查整包更新</el-button>
        <el-button @click="run('安装更新并重启', () => desktop.invoke('updater:install'))">安装已下载的更新</el-button>
        <el-button @click="run('热更新', () => desktop.invoke('hot:check'))">检查 ZIP 热更新</el-button>
        <el-button @click="run('重新启动', () => desktop.invoke('app:restart'))">重启以激活资源</el-button>
        <el-button @click="run('记录日志', () => desktop.invoke('log:write','info','Playground test'))">记录日志</el-button>
        <el-button @click="run('导出日志', () => desktop.invoke('log:export'))">导出日志</el-button>
      </el-space>
    </el-card>
    <el-alert :title="output" type="success" show-icon :closable="false"/>
  </section>
</template>
