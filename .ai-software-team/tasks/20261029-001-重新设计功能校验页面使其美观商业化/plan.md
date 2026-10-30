# Plan: 功能校验页面 (Playground) 商业化重构

## Goal

将当前简易平铺、缺乏层级与交互反馈的原始功能校验页面（`Playground.vue`），重构为现代化、高商业质感、模块化清晰的“开发者系统控制台（System Playground & Diagnostic Console）”。

## Non-goals

- 不修改底层 IPC 契约通道（`src/shared/ipc.ts` 保持不变）。
- 不破坏现有的 22 项系统能力的功能调用逻辑。
- 不引入外部重型第三方 UI 框架（完全基于现有的 Element Plus + 自定义 CSS 变量与微动画）。

## Architecture / Layout

1. **Header 仪表信息栏 (Hero Status Bar)**
   - 展示系统环境（平台架构、Electron/App 版本号、当前运行模式、深色/浅色自适应状态）。
2. **分类选项卡 (Tabbed Categorized Modules)**
   - **Tab 1: 窗口与系统 (Window & System)**：窗口动作（最小化/最大化/托盘）、开机自启、原生通知测试、协议 Deep Link 监听。
   - **Tab 2: 数据与传输 (Data & Transfer)**：下载任务管理（进度条/状态标签/暂停恢复/并发控制）、持久化配置键值对编辑器、系统打印机面板。
   - **Tab 3: 更新与日志 (Update & Logs)**：整包更新检查与进度 Timeline、ZIP 热更新测试、日志写入与导出。
3. **结构化实时控制台 (Interactive Terminal Drawer / Card)**
   - 替代原先单行简陋的 `el-alert`，提供带时间戳、操作通道标签、状态颜色标识与格式化 JSON 结果的现代日志控制台，支持“清空”与“复制”。

## Acceptance Criteria

- [ ] 页面布局现代典雅、卡片栅格对齐、信息层级清晰，具备商业桌面软件水准。
- [ ] 完美兼容深色模式（Dark Mode）与浅色模式（Light Mode），无文字或背景反色对比度缺陷。
- [ ] 原有功能全部无缝可用（窗口控制、系统通知、1-50 并发下载管理、持久化读取、打印机查询、整包与热更新测试）。
- [ ] 按钮具备 Loading 与防重复提交状态，操作结果通过 Toast + 结构化控制台面板呈现。
- [ ] 全量通过类型检查 `npx vp check` 与单元测试 `npx vp test run`。

## Implementation Steps

1. **UI/UX 方案落地**：设计各模块卡片栅格与终端面板视觉规范。
2. **前端组件实现**：重构 `src/renderer/views/Playground.vue`，抽取合理的视觉分区与状态映射。
3. **样式与深色模式适配**：完善 `src/renderer/styles/index.css` 或组件 Scoped 样式，使用 Element Plus 规范 CSS 变量。
4. **功能与质量验证**：运行 `npx vp check` 和 `npx vp test run` 确保无报错、无类型告警。

## Security Risks & Defense

- 所有的动态内容渲染禁止使用 `v-html`，避免潜在 XSS。
- 维持既有的输入校验与白名单机制，严格复用已有类型定义的 IPC 方法。

## Rollback

- 若需回滚，直接 `git restore src/renderer/views/Playground.vue` 即可恢复原有版本。
