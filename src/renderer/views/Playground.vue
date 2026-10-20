<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useAppStore } from '../stores/app'
import type { DownloadState, UpdateState } from '../../shared/ipc'
const desktop = window.desktop
const appStore = useAppStore()
const output = ref('选择系统功能进行测试')
const downloadURL = ref('https://example.com/')
const value = ref('dark')
const closeToTray = ref(false)
const downloadId = ref('')
const status = ref('')
const printList = ref<string[]>([])
const version = ref('')
const unsubscribers: Array<() => void> = []
async function run(label: string, fn: () => Promise<unknown>) {
  try { const result = await fn(); output.value = label + ': ' + JSON.stringify(result ?? 'OK') }
  catch(err) { output.value = label + ' 出错: ' + String(err) }
}
async function loadPrinters() {
  await run('打印机', async () => {
    printList.value = (await window.desktop.invoke('print:printers')).map(p => p.displayName)
    return printList.value
  })
}
function updateCloseToTray(enabled: boolean | string | number) {
  void run('关闭到托盘', () => desktop.invoke('store:set', 'closeToTray', Boolean(enabled)))
}
async function retryFailed() {
  await run('重试失败下载', async () => {
    downloadId.value = await desktop.invoke('download:retry', downloadId.value)
    return downloadId.value
  })
}
async function beginDownload() {
  await run('下载任务', async () => { downloadId.value = await window.desktop.invoke('download:start', downloadURL.value); return downloadId.value })
}
onMounted(async () => {
  unsubscribers.push(window.desktop.on('download:state', (state: DownloadState) => { status.value = state.state + ' ' + (state.percent ?? '') + '%'; output.value = JSON.stringify(state) }))
  unsubscribers.push(window.desktop.on('update:state', (state: UpdateState) => { output.value = JSON.stringify(state) }))
  unsubscribers.push(window.desktop.on('protocol:open', url => { output.value = 'Deep Link: ' + url }))
  unsubscribers.push(window.desktop.on('notification:clicked', title => { output.value = '通知点击：' + title }))
  await run('版本', async () => { version.value = await window.desktop.invoke('app:version'); return version.value })
  const saved = await window.desktop.invoke('store:get', 'closeToTray')
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
        <el-button @click="run('存储写入', () => desktop.invoke('store:set','theme',value))">写入主题</el-button>
        <el-button @click="run('存储读取', () => desktop.invoke('store:get','theme'))">读取主题</el-button>
      </el-space>
      <p><el-input v-model="downloadURL" placeholder="HTTPS 文件下载地址"/></p>
      <el-space wrap>
        <el-button @click="beginDownload">开始下载</el-button>
        <el-button :disabled="!downloadId" @click="run('暂停下载', () => desktop.invoke('download:pause',downloadId))">暂停</el-button>
        <el-button :disabled="!downloadId" @click="run('恢复下载', () => desktop.invoke('download:resume',downloadId))">恢复</el-button>
        <el-button :disabled="!downloadId" @click="run('取消下载', () => desktop.invoke('download:cancel',downloadId))">取消</el-button>
        <el-button :disabled="!downloadId" @click="retryFailed">重试</el-button>
      </el-space>
      <p>{{ status }}</p>
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
