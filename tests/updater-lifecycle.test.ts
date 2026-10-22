import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { EventEmitter } from 'node:events'
const mocks = vi.hoisted(() => ({ broadcast: vi.fn(), notify: vi.fn(), config: { appUpdateUrl: '' } }))
vi.mock('electron', () => ({ app: { isPackaged: true, getVersion: () => '1.0.0' } }))
vi.mock('../src/main/window', () => ({ broadcast: mocks.broadcast }))
vi.mock('../src/main/modules/notification', () => ({ notifyBusiness: mocks.notify }))
vi.mock('../src/main/modules/logger', () => ({ log: { error: vi.fn() } }))
vi.mock('../src/main/modules/config', () => ({ runtimeConfig: () => mocks.config }))
vi.mock('electron-updater', () => ({ autoUpdater: Object.assign(new EventEmitter(), {
  autoDownload: true, autoInstallOnAppQuit: true, setFeedURL: vi.fn(),
  checkForUpdates: vi.fn(), downloadUpdate: vi.fn(), quitAndInstall: vi.fn()
}) }))
import { autoUpdater } from 'electron-updater'
import { initUpdater, disposeUpdater, checkUpdate, installUpdate } from '../src/main/modules/updater'

describe('整包更新生命周期', () => {
  beforeEach(() => { disposeUpdater(); vi.clearAllMocks(); mocks.config.appUpdateUrl = '' })
  it('用户普通退出不会自动安装，重复初始化不增加监听器', () => {
    initUpdater(); initUpdater()
    expect(autoUpdater.autoInstallOnAppQuit).toBe(false)
    expect(autoUpdater.listenerCount('update-downloaded')).toBe(1)
    disposeUpdater()
    expect(autoUpdater.listenerCount('update-downloaded')).toBe(0)
  })
  it('配置错误后可修正重试初始化', () => {
    mocks.config.appUpdateUrl = 'http://bad.example/'
    expect(initUpdater).toThrow()
    mocks.config.appUpdateUrl = ''
    initUpdater()
    expect(autoUpdater.listenerCount('error')).toBe(1)
  })
  it('事件错误仅向页面发送固定信息，不携带凭据或路径', () => {
    initUpdater()
    autoUpdater.emit('error', new Error('/private/user/secret token=credential'))
    expect(JSON.stringify(mocks.broadcast.mock.calls)).not.toContain('credential')
    expect(() => installUpdate()).toThrow()
  })
  it('下载后必须显式安装，安装动作只允许一次', async () => {
    initUpdater()
    vi.mocked(autoUpdater.checkForUpdates).mockResolvedValue({ updateInfo: { version: '1.1.0' } } as never)
    vi.mocked(autoUpdater.downloadUpdate).mockImplementation(() => {
      autoUpdater.emit('update-downloaded', { version: '1.1.0' })
      return Promise.resolve([])
    })
    await checkUpdate()
    expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled()
    installUpdate()
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledOnce()
    expect(() => installUpdate()).toThrow()
  })
})
