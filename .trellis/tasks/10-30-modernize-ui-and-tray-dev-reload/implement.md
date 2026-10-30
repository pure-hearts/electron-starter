# Implementation Record: Modernize UI & Auto-reload Tray Icon in Development

## 1. 任务进度概览

- [x] Subtask 1: 创建 Trellis 任务规范与验收标准文档
- [x] Subtask 2: 开发态托盘图标热重载 (tray.ts fs.watch + reloadTrayIcon) 与 macOS Dock 同步
- [x] Subtask 3: 融合一体化现代 WindowBar (重构 TitleBar.vue，消除 App.vue 二级 Header 冲突)
- [x] Subtask 4: 重构首页 Home.vue 为现代科技感 Bento Grid 仪表盘并升级全局视觉样式
- [x] Subtask 5: 区分 Mac/Win/Linux 平台红绿灯与窗口控制规范 (Mac 原生交通灯、Win Fluent贴边、Linux GNOME 圆形徽章，Web 纯净模式免红绿灯)
- [x] Subtask 6: 重构设置中心 Settings.vue 为现代桌面两栏式卡片架构 (Sidebar 6大分类导航 + Grouped Bento 卡片)
- [x] Subtask 7: 设计 Electron + Vue 现代融合创意图标 (Vue 翡翠晶核 + 倾斜量子流光轨道) 并全规格生成
- [x] Subtask 8: 全页面 100% 接入 vue-i18n 深度多语言国际化覆盖 (Header, Home, Settings, Download)
- [x] Subtask 9: 通过 MCP (vitest 与 DevTools) 进行全流程交互与控制台验证，达到验收标准
- [x] Subtask 10: 修复“诊断与关于”由于 SystemDiagnostics 属性映射不一致导致运行时 TypeError 无法进入的问题，并通过 MCP 真机交互验证

## 2. 修改文件清单

- `src/renderer/views/Settings.vue`: 修复诊断与关于页面数据模型绑定（`osPlatform`、`electronVersion`、`nodeVersion`、`chromeVersion`、`totalMemoryMb`、`uptimeSeconds`），增加空状态保护与 Web 降级外链支持；
- `src/renderer/i18n/locales/zh-CN.ts` & `en-US.ts`: 深度拓展覆盖 Header、Home、Settings、DownloadDrawer 的完整中英文词条字典树；
- `src/renderer/components/TitleBar.vue`: 全面接入 `t(...)` 国际化，并在 Web 模式下彻底隐藏红绿灯；
- `src/renderer/views/Home.vue`: 首页 Hero、运行环境规格面板、4 大 Bento 卡片文本 100% 接入 `t(...)`；
- `src/renderer/views/Settings.vue`: 设置中心侧边栏、分组卡片、所有设置项、硬件诊断指标与关于信息 100% 接入 `t(...)`；
- `src/renderer/components/GlobalDownloadDrawer.vue`: 下载中心抽屉标题、Tab、空状态与任务状态机 100% 接入 `t(...)`；
- `scripts/generate-icons.py`: 重新设计并生成 Electron + Vue 现代融合创意图标产物；
- `src/main/modules/system/tray.ts`: 托盘开发态热重载与 Dock 同步；
- `tests/system/tray-management.test.ts`: 托盘单元测试。

## 3. 验证证据

- **静态检查与代码规范**: `vp check` 0 errors，所有文件格式化完成；
- **单元测试套件**: `pnpm test` 48 个测试文件、196 项测试用例全部 100% PASS；
- **MCP Chrome DevTools 双语比对验证**:
  - 中文状态下：首页、设置中心、顶栏全部规范呈现地道中文；
  - 一键切换至英文后：首页、设置中心（侧边栏 6 大分类、下载并发、存储路径、自启规则等）、顶栏提示与无障碍说明**100% 毫秒级无损切换为地道英文，毫无中文硬编码残留**；
  - 控制台 0 异常。
