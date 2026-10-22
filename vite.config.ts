import { defineConfig } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const pidFile = path.join(rootDir, '.dev-electron.pid')

/** 启动新 Electron 前安全清理上次调试遗留的孤儿进程，彻底防止单实例锁死锁 */
function cleanupPreviousElectron(): void {
  if (!fs.existsSync(pidFile)) return
  try {
    const stat = fs.statSync(pidFile)
    const isRecent = Date.now() - stat.mtimeMs < 12 * 60 * 60 * 1000 // 仅处理 12 小时内产生的残留，规避长期搁置后的 PID 复用误杀
    if (isRecent) {
      const raw = fs.readFileSync(pidFile, 'utf-8').trim()
      const pid = parseInt(raw, 10)
      if (!Number.isNaN(pid) && pid > 0 && pid !== process.pid) {
        try {
          process.kill(pid, 0)
          process.kill(pid, 'SIGTERM')
        } catch {
          // 目标进程已退出或不可达
        }
      }
    }
  } catch {
    // 忽略文件读取异常
  } finally {
    try {
      if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile)
    } catch {
      // 忽略文件清理异常
    }
  }
}

export default defineConfig({
  root: 'src/renderer',
  // envDir 指向仓库根目录，允许各模式加载根目录下对应的 .env 文件。
  envDir: rootDir,
  check: { fmt: false },
  lint: { options: { typeAware: true, typeCheck: true } },
  test: { root: rootDir, include: ['tests/**/*.test.ts'] },
  publicDir: '../../public',
  base: './',
  plugins: [
    vue(),
    electron({
      main: {
        entry: fileURLToPath(new URL('./src/main/index.ts', import.meta.url)),
        vite: { build: { outDir: '../../dist-electron', emptyOutDir: false, rolldownOptions: { output: { entryFileNames: 'main.js' } } } },
        async onstart({ startup }) {
          cleanupPreviousElectron()
          // Explicitly avoid the plugin default '--no-sandbox' switch and resolve root cwd.
          await startup(['.'], { cwd: rootDir })
        }
      },
      preload: {
        input: fileURLToPath(new URL('./src/preload/index.ts', import.meta.url)),
        vite: { build: { outDir: '../../dist-electron', emptyOutDir: false, rolldownOptions: { output: { format: 'cjs', entryFileNames: 'preload.cjs' } } } }
      }
    })
  ],
  resolve: {
    alias: {
      '@renderer': fileURLToPath(new URL('./src/renderer', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url))
    }
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true
  },
  server: { port: 5173, strictPort: true }
})
