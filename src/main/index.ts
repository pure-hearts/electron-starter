/**
 * Electron 主进程入口：先隔离测试用户数据，再获取单实例锁。
 * 只有获得锁的实例才能注册系统事件和启动桌面模块。
 */
import { app } from 'electron'
import fs from 'node:fs'
import { registerDeepLink } from './modules/protocol'
import { log } from './modules/logger'
import { bootstrapMain } from './bootstrap'
import { registerAppLifecycle } from './app-lifecycle'

// 自动化测试使用隔离目录，避免 Smoke 测试覆盖用户真实配置。
if (process.env.ELECTRON_STARTER_TEST_USERDATA) {
  fs.mkdirSync(process.env.ELECTRON_STARTER_TEST_USERDATA, { recursive: true })
  app.setPath('userData', process.env.ELECTRON_STARTER_TEST_USERDATA)
}
// 第二实例无需再次注册 IPC、托盘等系统资源。
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // 先注册唤醒和退出事件，再启动 Electron 模块。
  registerAppLifecycle()
  registerDeepLink()
  app.whenReady().then(bootstrapMain).catch(err => {
    log.error('Startup failure', err)
    app.quit()
  })
}
