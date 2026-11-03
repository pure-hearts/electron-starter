# PRD: 全面迁移样式至 UnoCSS 与商务风格多主题滚动条

## 目标 (Goal)

1. **全面 UnoCSS 化**：彻底移除所有 Vue 组件内的 `<style scoped>` 样式块，不再自定义任何 CSS class，全部使用 UnoCSS 原子化类；
2. **多主题完美兼容**：保持现有系统的 Light（亮色）、Dark（暗色）以及 System（系统跟随）多主题自适应机制，原子类自动响应主题切换；
3. **全局精致商务滚动条**：全局统一定制一套现代、极简、高颜值的商务风滚动条，亮色和暗色主题下分别具有恰到好处的对比度、透明度与悬停反馈；
4. **视觉与功能等价**：重构前后桌面标题栏拖拽（`-webkit-app-region`）、Bento Grid 响应式布局、卡片悬停动效、各业务视图完全一致。

## 现状与技术事实 (Confirmed Facts)

1. **多主题底层实现**：
   - 由 `src/renderer/stores/app.ts` 监听系统偏好与用户设置，在 `<html>` 标签上切换 `.dark` 类；
   - 核心色彩由 CSS 变量控制：`--app-bg-page`, `--app-bg-surface`, `--app-bg-subtle`, `--app-bg-muted`, `--app-bg-hover`, `--app-border`, `--app-border-subtle`, `--app-border-focus`, `--app-text-primary`, `--app-text-regular`, `--app-text-secondary`, `--app-text-muted`, `--app-primary`, `--app-shadow-*` 等；
   - Naive UI 也同步注入对应主题覆盖变量；
2. **待迁移组件**：
   - 全局样式：`src/renderer/styles/index.css`（保留基础变量和滚动条，清理旧类）；
   - 9 个包含 `<style scoped>` 的 Vue 文件全部完成重构，0 标签残留。

## 验收结果 (Acceptance Criteria)

- [x] `pnpm check` 与 `pnpm fmt:check` 通过，无类型与代码质量问题；
- [x] `pnpm test` 全部 229 项单测与集成测试 100% 通过；
- [x] 所有 Vue 组件中完全不存在 `<style>` 标签（`grep -rn "<style" src/renderer` 为 0）；
- [x] Light / Dark 主题切换时，界面背景、文字、边框、阴影及滚动条均即时、平滑自适应；
- [x] 滚动条在桌面窗口、抽屉、长列表（Settings/Playground/DownloadDrawer）中均呈现高级商务质感；
- [x] 桌面拖拽功能、标题栏操作、响应式断点表现完好；
- [x] `pnpm build` 与 `pnpm build:web` 均构建成功。
