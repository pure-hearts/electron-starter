import { defineConfig } from "vite-plus";
import { loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import electron from "vite-plugin-electron/simple";
import { fileURLToPath, URL } from "node:url";
import fs from "node:fs";
import path from "node:path";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const pidFile = path.join(rootDir, ".dev-electron.pid");

/** 启动新 Electron 前安全清理上次调试遗留的孤儿进程，彻底防止单实例锁死锁 */
function cleanupPreviousElectron(): void {
  if (!fs.existsSync(pidFile)) return;
  try {
    const stat = fs.statSync(pidFile);
    const isRecent = Date.now() - stat.mtimeMs < 12 * 60 * 60 * 1000; // 仅处理 12 小时内产生的残留，规避长期搁置后的 PID 复用误杀
    if (isRecent) {
      const raw = fs.readFileSync(pidFile, "utf-8").trim();
      const pid = parseInt(raw, 10);
      if (!Number.isNaN(pid) && pid > 0 && pid !== process.pid) {
        try {
          process.kill(pid, 0);
          process.kill(pid, "SIGTERM");
        } catch {
          // 目标进程已退出或不可达
        }
      }
    }
  } catch {
    // 忽略文件读取异常
  } finally {
    try {
      if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
    } catch {
      // 忽略文件清理异常
    }
  }
}

// 判定当前运行目标平台：web (纯浏览器端) 或 electron (桌面客户端)
const isWeb = process.env.TARGET_PLATFORM === "web";
const loadedEnv = loadEnv(process.env.NODE_ENV || "development", rootDir, "");
const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET || loadedEnv.VITE_DEV_PROXY_TARGET;

export default defineConfig({
  root: "src/renderer",
  // envDir 指向仓库根目录，允许各模式加载根目录下对应的 .env 文件。
  envDir: rootDir,
  check: { fmt: true },
  lint: { options: { typeAware: true, typeCheck: true } },
  test: { root: rootDir, include: ["tests/**/*.test.ts"] },
  publicDir: "../../public",
  // 支持环境变量覆盖基础路由子路径
  base: process.env.VITE_ROUTER_BASE || (isWeb ? "/" : "./"),
  plugins: [
    vue(),
    // 仅在桌面模式下挂载 electron 启动与打包插件；Web 模式下按需跳过
    !isWeb &&
      electron({
        main: {
          entry: fileURLToPath(new URL("./src/main/index.ts", import.meta.url)),
          vite: {
            build: {
              outDir: "../../dist-electron",
              emptyOutDir: false,
              rolldownOptions: { output: { entryFileNames: "main.js" } },
            },
          },
          async onstart({ startup }) {
            cleanupPreviousElectron();
            // 显式指定工作目录并关闭无沙箱开关
            await startup(["."], { cwd: rootDir });
          },
        },
        preload: {
          input: fileURLToPath(new URL("./src/preload/index.ts", import.meta.url)),
          vite: {
            build: {
              outDir: "../../dist-electron",
              emptyOutDir: false,
              rolldownOptions: { output: { format: "cjs", entryFileNames: "preload.cjs" } },
            },
          },
        },
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@renderer": fileURLToPath(new URL("./src/renderer", import.meta.url)),
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
    },
  },
  build: {
    // 纯 Web 产物构建输出至 dist/web，Electron 前端构建输出至 dist/renderer
    outDir: isWeb ? "../../dist/web" : "../../dist/renderer",
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "vue-vendor",
              test: /[\\/]node_modules[\\/](vue|vue-router|pinia|vue-i18n|@vue|@vueuse)[\\/]/,
            },
            {
              name: "naive-ui",
              test: /[\\/]node_modules[\\/](naive-ui|vueuc|evtd|vooks|css-render|seemly)[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    open: isWeb, // 纯 Web 模式下自动唤起默认浏览器打开页面
    proxy: devProxyTarget
      ? {
          "/api": {
            target: devProxyTarget,
            changeOrigin: true,
          },
        }
      : undefined,
  },
});
