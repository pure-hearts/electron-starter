# Design: 全面迁移样式至 UnoCSS 与商务风格多主题滚动条

## 1. 架构与设计原则

### 1.1 模块边界

- 样式基础设施集中在 `uno.config.ts` 与 `src/renderer/styles/index.css`。
- `src/renderer/styles/index.css` 仅保留：
  - 全局设计系统 Token（`:root` 与 `html.dark` 下的 CSS 变量）；
  - 全局重置样式（`box-sizing`, `body`, 商务滚动条）；
- 所有 UI 组件（`src/renderer/components/*`, `src/renderer/views/*`）不再持有 `<style>` 标签，全部通过 UnoCSS Utility Classes 表达视觉与布局。

### 1.2 主题适配机制（CSS 变量 + UnoCSS Theme）

为保证在切换主题（Light / Dark / System）时无需在所有元素上写繁重的 `dark:` 前缀，我们在 `uno.config.ts` 中将颜色映射到现有的 CSS 变量：

```ts
// uno.config.ts
colors: {
  app: {
    bg: {
      page: 'var(--app-bg-page)',
      surface: 'var(--app-bg-surface)',
      subtle: 'var(--app-bg-subtle)',
      muted: 'var(--app-bg-muted)',
      hover: 'var(--app-bg-hover)',
    },
    border: {
      DEFAULT: 'var(--app-border)',
      subtle: 'var(--app-border-subtle)',
      focus: 'var(--app-border-focus)',
    },
    text: {
      primary: 'var(--app-text-primary)',
      regular: 'var(--app-text-regular)',
      secondary: 'var(--app-text-secondary)',
      muted: 'var(--app-text-muted)',
    },
    primary: {
      DEFAULT: 'var(--app-primary)',
      hover: 'var(--app-primary-hover)',
    },
    danger: 'var(--app-danger)',
    success: 'var(--app-success)',
    warning: 'var(--app-warning)',
  }
}
```

这样，使用原子类如 `bg-app-bg-surface`、`text-app-text-primary`、`border-app-border` 时，当用户在前端或系统切换深浅模式（`html.dark` 增删）时，页面色彩瞬间无缝切换，保证 100% 多主题兼容。

### 1.3 桌面端原子类扩展（Rules）

Electron 标题栏和自定义窗口交互需要 `-webkit-app-region`，在 `uno.config.ts` 中注册：

```ts
rules: [
  ["drag", { "-webkit-app-region": "drag" }],
  ["no-drag", { "-webkit-app-region": "no-drag" }],
];
```

## 2. 商务风格多主题滚动条设计

### 2.1 设计标准

- **商务感基调**：极简、低干扰、轻盈精致。轨道平时隐形，仅在需要时凸显内容本身。
- **几何参数**：
  - 宽度（纵向滚动条）：6px
  - 高度（横向滚动条）：6px
  - 滑块圆角：9999px（优雅的胶囊弧度）
  - 内边距与留白：无边缘挤压，悬浮质感
- **亮色模式（Light）**：
  - 轨道（track）：`transparent`
  - 滑块（thumb）：`rgba(15, 23, 42, 0.18)`
  - 滑块悬停（hover）：`rgba(15, 23, 42, 0.35)`
  - 滑块激活（active）：`rgba(15, 23, 42, 0.52)`
- **暗色模式（Dark）**：
  - 轨道（track）：`transparent`
  - 滑块（thumb）：`rgba(248, 250, 252, 0.22)`
  - 滑块悬停（hover）：`rgba(248, 250, 252, 0.42)`
  - 滑块激活（active）：`rgba(248, 250, 252, 0.60)`
- **滚动条 CSS 变量化**：
  在 `:root` 和 `html.dark` 中分别声明 `--scrollbar-thumb`、`--scrollbar-thumb-hover`，确保多主题切换时毫秒级同步变色。

## 3. 组件原子化映射方案

| 原手写类名 / 局部样式                          | UnoCSS 原子类替换方案                                                                                                                   |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `.glass-panel`                                 | `bg-app-bg-surface border border-app-border rounded-xl shadow-sm transition-all duration-200 hover:(border-app-border-focus shadow-md)` |
| `.bento-grid`                                  | `grid grid-cols-12 gap-4 mt-5`                                                                                                          |
| `.col-span-8`                                  | `col-span-12 md:col-span-8`                                                                                                             |
| `.col-span-6`                                  | `col-span-12 md:col-span-6`                                                                                                             |
| `.col-span-4`                                  | `col-span-12 md:col-span-4`                                                                                                             |
| `.app`                                         | `min-h-screen bg-app-bg-page flex flex-col`                                                                                             |
| `.app-main`                                    | `w-full max-w-1200px mx-auto p-6 flex-1`                                                                                                |
| `TitleBar.vue` 样式                            | 转换为 `flex items-center h-44px sticky top-0 z-50 bg-app-bg-surface border-b border-app-border px-2 select-none drag ...`              |
| `ShortcutRecorder.vue`                         | 转换为 `flex items-center gap-2 p-2 rounded-lg border border-app-border ...`                                                            |
| `GlobalDownloadDrawer.vue`                     | 抽屉内各卡片及进度状态全部转换为 flex/grid/rounded/text 原子类                                                                          |
| `Home.vue` / `Settings.vue` / `Playground.vue` | 移除所有 `<style scoped>`，全面采用原子类排版与状态控制                                                                                 |

## 4. 风险与验证策略

1. **样式缺失风险**：转换后可能会遗漏伪类或媒体查询。对策：重构后严格核对组件每个 DOM 节点的样式和视觉表现，确保与原有 CSS 1:1 对齐；
2. **构建与类型风险**：新增 `unocss` 依赖与配置文件需符合 Vite+ 的构建和 Lint 规范。对策：执行 `pnpm check` 与 `pnpm fmt:check`；
3. **功能性验证**：运行 `pnpm test` 确保所有既有 53 个测试套件保持 100% 通过。
