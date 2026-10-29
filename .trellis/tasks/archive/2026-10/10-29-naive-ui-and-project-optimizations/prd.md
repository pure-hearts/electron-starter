# Naive UI 迁移、useAxios 集成与工程化综合优化

## Goal

将渲染层 UI 组件库从 `element-plus` 全面迁移至轻量、纯 TypeScript 且原生支持按需 Tree-Shaking 的 `naive-ui`；接入 `@vueuse/core` 与 `@vueuse/integrations` 的 `useAxios` 响应式网络请求层；完善打包产物过滤、增量热更新 CI 闭环、跨端指令 `v-if-web` 与 `build:web` CI 门禁。

## Requirements

1. **模块一：UI 组件库迁移至 Naive UI 与构建体积优化**
   - 移除 `element-plus`，安装 `naive-ui`。
   - 封装基于 `createDiscreteApi` 的独立 `message` / `notification` 工具，供 `web-shim.ts` 与视图组件调用。
   - 迁移 `App.vue`（集成 `n-config-provider` 明暗主题与中英文国际化）、`Home.vue`、`Playground.vue` 及全局 CSS 样式。
   - 在 `electron-builder.yml` 中将 `dist/**/*` 收窄为 `dist/renderer/**/*`，避免将 `dist/web` 打入 Electron 安装包。
2. **模块二：热更新（Hot Update）生产化闭环**
   - 新增 `.github/workflows/hot-release.yml` 自动化热更新打包与发布流水线。
   - 增强 `scripts/pack-hot.ts` 私钥环境变量解析（支持标准 PEM、`\n` 转义单行 PEM、Base64 编码）。
3. **模块三：双端（Web & Electron）开发体验进阶（含 `useAxios`）**
   - 安装 `@vueuse/core` 与 `@vueuse/integrations`，在 `src/renderer/api/request.ts` 中封装导出预绑定 `request` 实例与 `normalizeRequestError` 拦截器的 `useAxios`。
   - 在 `vite.config.ts` 支持 `VITE_DEV_PROXY_TARGET` 开发期跨域代理。
   - 在 `Playground.vue` 新增 `useAxios` 响应式请求与取消控制演示卡片。
   - 在 `src/renderer/directives/electron.ts` 新增 `v-if-web` 跨端指令。
   - 在 `.github/workflows/check.yml` 新增 `pnpm run build:web` 构建门禁。

## Acceptance Criteria

- [x] `element-plus` 完全移除，`naive-ui` 按需引入无报错；
- [x] `useAxios` 在 `request.ts` 正常导出并在 `Playground.vue` 及单元测试中验证通过；
- [x] `v-if-web` 指令在 Web 端显示、Electron 端隐藏，通过单元测试；
- [x] `vp fmt`、`vp check`、`vue-tsc --noEmit`、`vp test --run`、`pnpm build`、`pnpm build:web` 全部通过。
