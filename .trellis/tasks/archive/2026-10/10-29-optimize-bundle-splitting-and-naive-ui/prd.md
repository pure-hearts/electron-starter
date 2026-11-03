# 构建产物精细分包与 Naive UI 按需加载优化

## Goal

通过引入 `unplugin-vue-components` 实现 Naive UI 组件的模板按需自动引入与按需打包；利用 Vite+（Rolldown）的进阶代码分割（`output.codeSplitting` 配合 `entriesAware`、四层缓存金字塔与资源目录归档）；实现 Web / Electron 双端差异化分包与编译期死代码消除（DCE），全面减小首屏包与热更新包体积。

## Requirements

1. **Naive UI 按需自动导入配置**：
   - 引入 `unplugin-vue-components` 并在 `vite.config.ts` 中配置 `NaiveUiResolver()`；
   - 检查并优化 `App.vue`、`Home.vue`、`Playground.vue`，享受模板自动按需引入；
   - 在 `feedback.ts` 中优化 `createDiscreteApi`，避免静态将完整消息体系强绑至首屏入口。
2. **Rolldown 精细分包与双模态策略（`vite.config.ts`）**：
   - 引入四层分包金字塔：`vue-core`（内核）、`infra-vendor`（工具/网络）、`naive-ui`（UI组件）、`vendor-shared`（共享三方）；
   - 开启 `entriesAware: true` 配合 `entriesAwareMergeThreshold: 20_000`，彻底斩断异步路由（如 `Playground.vue`）低频重型组件对首屏的连坐拉取；
   - 规范化产物目录输出（`assets/js/`、`assets/css/`、`assets/img/`、`assets/fonts/`）。
3. **双端编译期死代码消除（DCE）**：
   - 配置 `define: { __IS_WEB__: JSON.stringify(isWeb) }`；
   - 在 `src/renderer/bridge/index.ts` 中使用编译期条件，使 Electron 生产包完全剔除 `web-shim.ts`。

## Acceptance Criteria

- [x] `unplugin-vue-components` 接入且 `vue-tsc --noEmit`、`vp check` 零错误；
- [x] 模板中 Naive UI 组件按需打包生效；
- [x] Rolldown 分包清晰，输出归类到规范 assets 目录；
- [x] 首屏 JS/CSS 进一步瘦身，异步组件独立分块；
- [x] `pnpm fmt`、`pnpm check`、`pnpm test`、`pnpm build:web`、`pnpm build` 全量通过；
- [x] 经用户确认后再执行代码提交与归档。
