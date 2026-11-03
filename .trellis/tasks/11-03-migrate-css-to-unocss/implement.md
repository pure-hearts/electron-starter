# Implementation Plan: 全面迁移样式至 UnoCSS 与商务风格多主题滚动条

## 执行清单 (Implementation Checklist)

### 阶段 1：UnoCSS 基础设施集成

- [x] 1.1 安装依赖：`unocss`；
- [x] 1.2 创建根目录 `uno.config.ts`：
  - 配置 `presetUno()`；
  - 映射 `theme.colors.app` 系列变量到 CSS 变量；
  - 增加 Electron 专用 rules（`drag`, `no-drag`）；
- [x] 1.3 更新 `vite.config.ts`：引入并在插件列表中挂载 `UnoCSS()`；
- [x] 1.4 更新 `src/renderer/main.ts`：在入口处导入 `'virtual:uno.css'`。

### 阶段 2：全局样式重构与商务滚动条

- [x] 2.1 重写 `src/renderer/styles/index.css`：
  - 增加滚动条主题变量（`--scrollbar-thumb`, `--scrollbar-thumb-hover`, `--scrollbar-thumb-active`）；
  - 实现通用精致商务滚动条规则（WebKit 系列伪元素 + 标准 `scrollbar-width` 与 `scrollbar-color`）；
  - 移除旧的 `.app`, `.app-main`, `.glass-panel`, `.bento-grid`, `.col-span-*` 等手写类；
- [x] 2.2 更新 `src/renderer/App.vue`：
  - 将 `.app` 替换为 `min-h-screen bg-app-bg-page flex flex-col`；
  - 将 `.app-main` 替换为 `w-full max-w-1200px mx-auto p-6 flex-1`。

### 阶段 3：组件级手写 CSS 消除与原子化重构（无 `<style>` 残留）

- [x] 3.1 重构 `src/renderer/components/NetworkBanner.vue`，删除 `<style scoped>`；
- [x] 3.2 重构 `src/renderer/components/ErrorFallback.vue`，删除 `<style scoped>`；
- [x] 3.3 重构 `src/renderer/components/ShortcutRecorder.vue`，删除 `<style scoped>`；
- [x] 3.4 重构 `src/renderer/components/GlobalShortcutManager.vue`，删除 `<style scoped>`；
- [x] 3.5 重构 `src/renderer/components/TitleBar.vue`，删除 `<style scoped>`；
- [x] 3.6 重构 `src/renderer/components/GlobalDownloadDrawer.vue`，删除 `<style scoped>`；
- [x] 3.7 重构 `src/renderer/views/Home.vue`，删除 `<style scoped>`；
- [x] 3.8 重构 `src/renderer/views/Settings.vue`，删除 `<style scoped>`；
- [x] 3.9 重构 `src/renderer/views/Playground.vue`，删除 `<style scoped>`。

### 阶段 4：质量门禁与回归验证

- [x] 4.1 确认 `grep -rn "<style" src/renderer` 结果为 0；
- [x] 4.2 运行代码格式化与静态检查：`pnpm fmt` 与 `pnpm check`（全部通过）；
- [x] 4.3 运行全量单元与集成测试：`pnpm test`（53 个套件，229 个用例通过）；
- [x] 4.4 检查 Vite 构建产物：`pnpm build` 与 `pnpm build:web` 均构建成功；
- [x] 4.5 验证多主题自适应表现与滚动条商务外观。
