import { spawn } from 'node:child_process'
import electron from 'electron'

const subprocess = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ELECTRON_STARTER_SMOKE: '1',
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'false'
  }
})

const timeout = setTimeout(() => {
  subprocess.kill('SIGKILL')
  console.error('Electron smoke process timed out')
  process.exitCode = 1
}, 45000)

subprocess.on('error', error => {
  clearTimeout(timeout)
  console.error(error)
  process.exitCode = 1
})
subprocess.on('close', (code, signal) => {
  clearTimeout(timeout)
  console.log('Electron smoke result:', { code, signal })
  process.exitCode = code === 0 ? 0 : 1
})
