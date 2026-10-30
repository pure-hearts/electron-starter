# 重新设计功能校验页面使其美观商业化 (Playground Redesign)

## Goal

将当前的 Playground 功能校验页面从简易按钮平铺、底部单行文本告警的调试样式，全面重构为一个现代化、商业级、高质感的“系统功能与开发者诊断控制台（Developer & Diagnostic Dashboard）”。

## 生产级交互状态要求 (Production-Grade State Standards)

1. **精准 Loading 状态**：
   - 每个异步 IPC 调用（获取版本、窗口操作、通知、更新检查、日志导出、打印机扫描等）均绑定独立的 `loading` 状态；
   - 异步操作期间按钮自动呈现加载动画并禁用防重点击。
2. **状态联动与智能禁用 (Contextual Disabled States)**：
   - 检查更新过程中禁用重复检查；
   - 整包安装在未准备好（未处于 ready 状态）时禁用安装按钮；
   - 下载任务不同阶段（已暂停/进行中/队列中/完成/失败）精准禁用不适用的按钮（例如非 paused 状态禁用恢复，非 progress 状态禁用暂停）。
3. **即时交互反馈 (Instant Toast & Message)**：
   - 操作成功与异常均触发全局 `ElMessage` 轻量提示，同时写入下方结构化终端；
4. **完备的空状态 (Empty States)**：
   - 下载任务列表为空时展示 `<el-empty>`；
   - 打印机列表为空时展示明确提示与扫描引导；
   - 调试控制台无日志时展示占位提示。
5. **结构化调试终端 (Interactive Terminal Console)**：
   - 每条日志带时间戳、通道徽章、耗时以及高亮格式化的 JSON 结果，支持一键清空与复制。
6. **深色/浅色自适应 (Theme Integration)**：
   - 全面使用 Element Plus 规范 CSS 变量与设计规范，完美兼容已接入的深色主题与浅色主题。

## Acceptance Criteria

- [ ] 所有异步操作具备明确的 Loading 状态与防重复点击机制。
- [ ] 按钮与操作根据上下文动态禁用（状态机联动）。
- [ ] 空列表有清晰的 Empty State 占位，避免页面突兀留白。
- [ ] 页面布局现代典雅、卡片栅格对齐、信息层级清晰，具备商业桌面软件水准。
- [ ] 完美兼容深色模式（Dark Mode）与浅色模式（Light Mode），无文字或背景反色对比度缺陷。
- [ ] 原有 22 项系统功能全部无缝可用。
- [ ] 全量通过类型检查 `npx vp check` 与单元测试 `npx vp test run`。
