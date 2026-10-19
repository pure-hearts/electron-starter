import { defineConfig } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  root: 'src/renderer',
  publicDir: '../../public',
  base: './',
  plugins: [
    vue(),
    electron({
      main: {
        entry: 'src/main/index.ts',
        onstart({ startup }) {
          // Explicitly avoid the plugin default '--no-sandbox' switch.
          return startup(['.'])
        }
      },
      preload: { input: 'src/preload/index.ts' }
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
