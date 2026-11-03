# PRD: 应用名称修改、Actions 优化、顶栏结构重构与快捷键管理体系优化

## 1. 目标与背景 (Goal & Background)

本项目正在从基础 starter 演进为成熟的 Electron + Vue 桌面开发模板。
本次任务需要针对用户提出的 6 项核心诉求，进行全面的构建配置、CI/CD 流水线、UI 交互体验与快捷键管理系统的升级：

1. 解答并说明 `latest-windows.yml` 文件的命名机制与生成原理；
2. 清理废弃与冗余的 GitHub Actions 工作流，优化发布流水线；
3. 将项目名称与应用标识统一重构为 `electron-vue-template`；
4. 在 Electron 应用顶部（无论操作系统）显著呈现应用标题 `electron-vue-template`；
5. 将原“功能校验中心”拆解，将其三个子功能（窗口与系统控制、数据持久化与传输、应用升级与诊断）直接迁移到顶部导航，替换原来的单一入口；
6. 参照 VS Code 风格重构快捷键管理功能：以表格形式清晰展示当前应用的所有快捷键（含打开偏好设置等常见命令），支持行内修改、录制、重置和取消。

---

## 2. 确认事实与调研依据 (Confirmed Facts & Codebase Evidence)

1. **更新元数据命名机制**：
   - `electron-builder` 和 `electron-updater` 的官方标准中，Windows 平台的更新描述文件固定命名为 **`latest.yml`**（macOS 对应 `latest-mac.yml`，Linux 对应 `latest-linux.yml`），官方不存在 `latest-windows.yml`。
   - `package.json` 中的 `dist:win` 命令包含 `--publish never`，本地打包默认不会产出更新描述文件；发布至 GitHub Releases 时才会由 Actions 生成 `latest.yml`。
2. **GitHub Actions 现状**：
   - 存在 6 个工作流文件：`build-and-release.yml`、`check.yml`、`hot-release.yml`、`package-check.yml`、`publish-manual-test.yml`、`release.yml`。
   - `publish-manual-test.yml` 硬编码了远古 run ID `39442467032` 与固定 commit sha，属于遗留冗余工作流，可直接移除。
   - `release.yml` 与 `build-and-release.yml` 存在触发冲突（均响应 `push: tags: ["v*"]`），且 `release.yml` 强依赖生产证书 Secrets，模板项目中容易报错。
3. **顶栏结构现状**：
   - `TitleBar.vue` 当前导航项为写死的三个：`首页 (/)`、`功能校验中心 (/playground)`、`设置 (/settings)`。
   - macOS 桌面端因预留交通灯空白，隐藏了应用的品牌标题 `brand-text`；Windows/Linux 则在最左侧显示。
4. **功能校验中心（Playground）子功能**：
   - Tab 1: `🖥️ 窗口与系统控制` (`activeTab = 'window'`)
   - Tab 2: `📦 数据持久化与传输` (`activeTab = 'transfer'`)
   - Tab 3: `🔄 应用升级与诊断` (`activeTab = 'update'`)
5. **快捷键系统现状**：
   - 目前仅维护了一个全局快捷键 `globalShortcutToggle`，配置入口简单，缺乏多快捷键展示和应用内全局调度（例如打开设置 `Ctrl+,`）。

---

## 3. 详细需求拆解 (Requirements)

### 需求 1：明确解释 Windows 自动更新描述文件

- 在文档和交流中准确向用户说明：electron-builder 生成的 Windows 更新配置文件规范名称即为 `latest.yml`，并指出生成条件（需要带有 publish 配置且非 `--publish never`）。

### 需求 2：优化 GitHub Actions 流水线

- 删除废弃工作流 `.github/workflows/publish-manual-test.yml`。
- 整合并优化发布工作流：合并 `build-and-release.yml` 与 `release.yml` 为清晰高效的生产/预发布流，确保跨平台构建（Windows / macOS / Linux）与草稿发布稳定可靠。
- 保留并维护日常 CI `check.yml`、跨平台打包校验 `package-check.yml` 与热更新发布 `hot-release.yml`。

### 需求 3：将应用名称统一更名为 `electron-vue-template`

- 修改范围：
  - `package.json`: `name` -> `electron-vue-template`, `desktopName` -> `electron-vue-template`
  - `electron-builder.yml`: `productName: Electron Vue Template`, `appId: org.purehearts.electronvuetemplate`, 协议 `schemes: [electron-vue-template]`
  - 环境变量 `.env.development`, `.env.production`, `.env.example`, `.env.testing`: `APP_NAME=electron-vue-template`, `APP_DEEP_LINK_SCHEME=electron-vue-template`
  - `resources/app-config.json` 与 `app-update.yml` 更新默认仓库和配置名。
  - 相关测试用例与引用同步调整。

### 需求 4：在 Electron 应用顶部显著呈现应用标题

- 在 `TitleBar.vue` 中，确保在所有平台（macOS、Windows、Linux、Web）的合适位置展示标题 `electron-vue-template`。
- 在 macOS 交通灯右侧留出优雅呼吸区并展示标题与徽标，或者在顶部中心区域协调展示，保持拖拽和窗口控制功能完整。

### 需求 5：迁移功能校验中心的三个子功能到顶部

- 顶部导航栏替换原单一的“功能校验中心”，变更为 3 个直接入口：
  1. `窗口控制` (Window & System) -> 对应 Playground `tab=window`
  2. `数据传输` (Data & Storage) -> 对应 Playground `tab=transfer`
  3. `应用升级` (Update & Diag) -> 对应 Playground `tab=update`
- 路由与页面状态保持深度联动：URL 查询参数 `?tab=xxx` 与顶部激活高亮双向同步，页面内切换也能同步反馈给顶栏。

### 需求 6：VS Code 风格多快捷键管理面板与编辑重置

- 参考用户提供的截图设计快捷键设置界面：
  - 表格列：`命令`、`键绑定`、`作用域/当`、`操作`。
  - 预设快捷键清单：
    1. **打开设置中心**：`CommandOrControl+,`（应用内）
    2. **显示/隐藏主窗口**：`CommandOrControl+Shift+X`（全局生效）
    3. **切换下载抽屉**：`CommandOrControl+J`（应用内）
    4. **切换外观主题**：`CommandOrControl+Shift+T`（应用内）
    5. **聚焦开发者控制台/刷新**：`CommandOrControl+R`（应用内）
  - 每行提供编辑入口，点击进入编辑态，展示按键输入录制框，以及【保存修改】、【重置为默认】、【取消】操作按钮。
  - 支持快捷键防冲突检测、本地 `electron-store` 持久化，以及全局快捷键的主进程动态重新注册。
  - 渲染进程通过全局键盘事件监听（Keydown hook）支持应用内快捷键。

---

## 4. 验收标准 (Acceptance Criteria)

- [ ] 完整准确解答 `latest-windows.yml` 的命名原因及本地缺少的原因。
- [ ] 冗余的 `publish-manual-test.yml` 已被删除，GitHub Actions 结构清晰整洁，无语法错误。
- [ ] 应用名称和包名已成功更新为 `electron-vue-template`，全局搜索无破损配置，测试全部通过。
- [ ] 桌面应用启动后，顶部顶栏（TitleBar）在 macOS / Windows / Linux 各端均能正确显示 `electron-vue-template`。
- [ ] 顶栏中的导航项已将“功能校验中心”拆分为三个独立子导航，点击能无缝跳转并激活 Playground 对应的功能视图。
- [ ] 偏好设置中的快捷键页面呈现为美观的 VS Code 风格表格，支持查看、点击修改录制、重置为默认、取消编辑，并在修改后即时生效。
