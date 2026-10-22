import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { IpcMainInvokeEvent } from 'electron'

const mocks = vi.hoisted(() => ({ handle: vi.fn(), removeHandler: vi.fn(), version: vi.fn(), error: vi.fn() }))
vi.mock('electron', () => ({ ipcMain: { handle: mocks.handle, removeHandler: mocks.removeHandler } }))
vi.mock('../src/main/ipc/handlers/system', () => ({ systemHandlers: { 'app:version': mocks.version } }))
vi.mock('../src/main/ipc/handlers/services', () => ({ serviceHandlers: {} }))
vi.mock('../src/main/ipc/handlers/transfer', () => ({ transferHandlers: {} }))
vi.mock('../src/main/modules/core/logger', () => ({ log: { error: mocks.error } }))
import { registerIPC, unregisterIPC } from '../src/main/ipc'
import { allowedChannels } from '../src/shared/validation'

function sender(url = 'app://renderer/index.html', child = false) {
  const frame = { url }
  return { senderFrame: frame, sender: { mainFrame: child ? {} : frame, isDestroyed: () => false } } as unknown as IpcMainInvokeEvent
}
function invoke(event = sender(), ...args: unknown[]) {
  const callback = mocks.handle.mock.calls.find(([channel]) => channel === 'app:version')![1]
  return callback(event, ...args) as Promise<unknown>
}
beforeEach(() => { unregisterIPC(); vi.clearAllMocks(); mocks.version.mockResolvedValue('1.2.3') })
describe('IPC Gateway 实际注册边界', () => {
  it('仅注册白名单且重复注册幂等，释放后可重新初始化', async () => {
    registerIPC(); registerIPC()
    expect(mocks.handle.mock.calls.map(([channel]) => channel)).toEqual([...allowedChannels])
    expect(await invoke()).toBe('1.2.3')
    unregisterIPC(); unregisterIPC()
    expect(mocks.removeHandler).toHaveBeenCalledTimes(allowedChannels.size)
    registerIPC()
    expect(mocks.handle).toHaveBeenCalledTimes(allowedChannels.size * 2)
  })
  it('拒绝外部页面、子框架和多余参数，业务函数不得执行', async () => {
    registerIPC()
    await expect(invoke(sender('https://evil.example/'))).rejects.toThrow('IPC_FORBIDDEN')
    await expect(invoke(sender('app://renderer/', true))).rejects.toThrow('IPC_FORBIDDEN')
    await expect(invoke(sender(), 'extra')).rejects.toThrow('IPC_INVALID_ARGUMENTS')
    expect(mocks.version).not.toHaveBeenCalled()
  })
  it('归一化同步及异步异常，凭据、文件路径和内部堆栈不进入页面', async () => {
    registerIPC()
    for (const asynchronous of [false, true]) {
      const error = new Error('token=secret /Users/private/signing.key')
      mocks.version.mockImplementation(() => { if (asynchronous) return Promise.reject(error); throw error })
      await expect(invoke()).rejects.toThrow(/^IPC_OPERATION_FAILED: 操作失败，请重试或查看诊断日志$/)
    }
    expect(mocks.error).toHaveBeenCalledTimes(2)
  })
  it('中途注册失败仅撤销本次已安装通道，并允许重试', () => {
    mocks.handle.mockImplementationOnce(() => undefined).mockImplementationOnce(() => { throw new Error('duplicate') })
    expect(() => registerIPC()).toThrow('duplicate')
    expect(mocks.removeHandler.mock.calls).toEqual([['app:version']])
    mocks.handle.mockReset()
    registerIPC()
    expect(mocks.handle).toHaveBeenCalledTimes(allowedChannels.size)
  })
})
