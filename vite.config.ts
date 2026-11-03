import { defineConfig } from "vite-plus";
import { loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import UnoCSS from "unocss/vite";
import electron from "vite-plugin-electron/simple";
import Components from "unplugin-vue-components/vite";
import { NaiveUiResolver } from "unplugin-vue-components/resolvers";
import { fileURLToPath, URL } from "node:url";
import path from "node:path";
import { cleanupPreviousElectron } from "./scripts/cleanup-electron";
import { createBuildOutputOptions } from "./scripts/build-chunk-split";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const resolveRoot = (...segments: string[]): string => path.resolve(rootDir, ...segments);

// 判定当前运行目标平台：web (纯浏览器端) 或 electron (桌面客户端)
const isWeb = process.env.TARGET_PLATFORM === "web";
const loadedEnv = loadEnv(process.env.NODE_ENV || "development", rootDir, "");
const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET || loadedEnv.VITE_DEV_PROXY_TARGET;

export default defineConfig({
  root: "src/renderer",
  // envDir 指向仓库根目录，允许各模式加载根目录下对应的 .env 文件。
  envDir: rootDir,
  check: { fmt: true },
  lint: {
    options: { typeAware: true, typeCheck: true },
    plugins: ["import"],
    rules: {
      "import/newline-after-import": "error",
    },
  },
  test: { root: rootDir, include: ["tests/**/*.test.ts"] },
  publicDir: resolveRoot("public"),
  // 支持环境变量覆盖基础路由子路径
  base: process.env.VITE_ROUTER_BASE || (isWeb ? "/" : "./"),
  define: {
    // 注入跨端编译期静态常量，激活死代码消除 (DCE)
    __IS_WEB__: JSON.stringify(isWeb),
  },
  plugins: [
    UnoCSS(),
    vue(),
    // Naive UI 模板组件按需自动引入
    Components({
      resolvers: [NaiveUiResolver()],
      dts: resolveRoot("src/renderer/components.d.ts"),
    }),
    // 仅在桌面模式下挂载 electron 启动与打包插件；Web 模式下按需跳过
    !isWeb &&
      electron({
        main: {
          entry: resolveRoot("src/main/index.ts"),
          vite: {
            build: {
              outDir: resolveRoot("dist-electron"),
              emptyOutDir: false,
              rolldownOptions: { output: { entryFileNames: "main.js" } },
            },
          },
          async onstart({ startup }) {
            cleanupPreviousElectron(rootDir);
            // 显式指定工作目录并关闭无沙箱开关
            await startup(["."], { cwd: rootDir });
          },
        },
        preload: {
          input: resolveRoot("src/preload/index.ts"),
          vite: {
            build: {
              outDir: resolveRoot("dist-electron"),
              emptyOutDir: false,
              rolldownOptions: { output: { format: "cjs", entryFileNames: "preload.cjs" } },
            },
          },
        },
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@renderer": resolveRoot("src/renderer"),
      "@shared": resolveRoot("src/shared"),
    },
  },
  build: {
    // 纯 Web 产物构建输出至 dist/web，Electron 前端构建输出至 dist/renderer
    outDir: resolveRoot(isWeb ? "dist/web" : "dist/renderer"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: createBuildOutputOptions(isWeb),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    open: isWeb, // 纯 Web 模式下自动唤起默认浏览器打开页面
    watch: {
      // 显式忽略输出目录、热更新目录与临时 PID 文件，彻底杜绝编译重启循环触发窗口闪烁
      ignored: [
        "**/dist-electron/**",
        "**/dist/**",
        "**/.dev-electron.pid",
        "**/release/**",
        "**/.trellis/**",
      ],
    },
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
