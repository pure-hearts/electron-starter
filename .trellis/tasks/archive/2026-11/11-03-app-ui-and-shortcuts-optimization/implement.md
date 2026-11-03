# Implementation Plan: 执行清单与验证步骤

## 1. 准备与梳理 (Preparation)

- [x] 1.1 解释 `latest-windows.yml` 的原理并在回复与相关文档中体现。
- [x] 1.2 确认当前工作区状态与待修改文件范围。

## 2. GitHub Actions 优化 (Actions Optimization)

- [x] 2.1 删除无用且包含硬编码的 `.github/workflows/publish-manual-test.yml`。
- [x] 2.2 整合 `release.yml` 与 `build-and-release.yml`，统一发布流，清理重复配置。
- [x] 2.3 验证所有 workflow YAML 格式合法性。

## 3. 应用更名 (Rename to electron-vue-template)

- [x] 3.1 更新 `package.json` 中的 `name` 和 `desktopName` 为 `electron-vue-template`。
- [x] 3.2 更新 `electron-builder.yml` 中的 `productName`、`appId` 及协议为 `electron-vue-template`。
- [x] 3.3 更新 `.env.*` 文件中的 `APP_NAME`、`APP_DEEP_LINK_SCHEME` 等环境变量。
- [x] 3.4 更新 `resources/` 目录下的配置文件与默认 URL。
- [x] 3.5 同步更新测试用例中对应用名称的断言。

## 4. 顶部标题栏改造 (TitleBar & Navigation)

- [x] 4.1 在 `src/renderer/components/TitleBar.vue` 中添加统一应用标题 `electron-vue-template`，适配 macOS（交通灯右侧）和 Windows/Linux。
- [x] 4.2 将顶栏中的“功能校验中心”替换为三个子功能入口（窗口与系统控制、数据持久化与传输、应用升级与诊断）。
- [x] 4.3 在 `Playground.vue` 中增加路由 Query 监听与响应式联动。
- [x] 4.4 同步更新 `zh-CN.ts` 与 `en-US.ts` 的国际化词条。

## 5. VS Code 风格快捷键管理中心改造 (Shortcuts Overhaul)

- [x] 5.1 创建/扩展快捷键管理 Store 或配置列表，支持命令列表（如：打开偏好设置 `Ctrl+,`、显示主窗口 `Ctrl+Shift+X`、打开下载中心 `Ctrl+J` 等）。
- [x] 5.2 重构 `GlobalShortcutManager.vue` 为 VS Code 风格的快捷键表格：
  - 显示命令、键绑定、生效条件（当）；
  - 行内点击修改快捷键（支持输入框录制）；
  - 支持【保存修改】、【重置为默认】、【取消编辑】；
  - 集成冲突检测提示。
- [x] 5.3 在渲染进程增加全局快捷键事件分发机制，支持应用内按键响应（如按 `Ctrl+,` 跳转到 `/settings`）。

## 6. 全面测试与验证 (Verification)

- [x] 6.1 运行代码风格与类型检查：`pnpm exec vp check` 与 `pnpm exec vue-tsc --noEmit`。
- [x] 6.2 运行自动化单元测试：`pnpm exec vp test --run`。
- [x] 6.3 运行构建验证：`pnpm exec vp build`。
