import { spawn } from 'node:child_process'
import electron from 'electron'

// 使用本地 Electron 可执行文件真正启动应用，而非只运行 Node.js 单元测试。
const subprocess = spawn(electron, ['.'], {
  // 继承标准输出/错误输出，让 CI 日志保留 Electron 运行错误。
  stdio: 'inherit',
  env: {
    ...process.env,
    // 通过环境变量启用主进程内置的窗口、Preload、IPC 运行检查。
    ELECTRON_STARTER_SMOKE: '1',
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'false'
  }
})

// 超时强制结束，避免窗口无法启动导致 CI 永久挂起。
const timeout = setTimeout(() => {
  subprocess.kill('SIGKILL')
  console.error('Electron smoke process timed out')
  process.exitCode = 1
}, 45000)

// 进程创建失败时将退出码设为 1，让 CI 明确失败。
subprocess.on('error', error => {
  clearTimeout(timeout)
  console.error(error)
  process.exitCode = 1
})
// Electron 正常返回 0 才算通过，其余状态均失败。
subprocess.on('close', (code, signal) => {
  clearTimeout(timeout)
  console.log('Electron smoke result:', { code, signal })
  process.exitCode = code === 0 ? 0 : 1
})
