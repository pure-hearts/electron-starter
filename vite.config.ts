import { defineConfig } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  root: 'src/renderer',
  // envDir 指向仓库根目录，允许各模式加载根目录下对应的 .env 文件。
  envDir: fileURLToPath(new URL('.', import.meta.url)),
  check: { fmt: false },
  lint: { options: { typeAware: true, typeCheck: true } },
  test: { root: fileURLToPath(new URL('.', import.meta.url)), include: ['tests/**/*.test.ts'] },
  publicDir: '../../public',
  base: './',
  plugins: [
    vue(),
    electron({
      main: {
        entry: fileURLToPath(new URL('./src/main/index.ts', import.meta.url)),
        vite: { build: { outDir: '../../dist-electron', emptyOutDir: false, rolldownOptions: { output: { entryFileNames: 'main.js' } } } },
        async onstart({ startup }) {
          // Explicitly avoid the plugin default '--no-sandbox' switch.
          await startup(['.'])
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
