# PRD: 配置项目级 MCP 服务 (electron-stagewright, chrome-devtools, vitest)

## 1. 目标 (Goal)

为当前项目配置项目级 Model Context Protocol (MCP) 服务，支持 AI 助手（包括 Claude Code、Cursor、VS Code MCP 插件等）在当前工作区内开箱即用调用以下三项关键工具体系：

1. **`electron-stagewright`**：用于 Electron 桌面主进程、多窗口、IPC、原生菜单与打包规范的无障碍/快照驱动测试；
2. **`chrome-devtools`**：用于渲染进程 Web 视图、DOM/CSS 结构、网络通信与前端性能调试；
3. **`vitest`**：用于执行工程单元测试套件、查看结构化测试结果与代码覆盖率分析。

**严格约束**：仅配置在当前项目内，不修改用户全局 `~/.gemini/config/mcp_config.json`。

---

## 2. 需求范围 (Requirements)

1. **项目级 MCP 标准配置 (`.mcp.json`)**：
   - 在项目根目录提供标准的 `.mcp.json`，配置 `electron-stagewright`、`chrome-devtools`、`vitest`。
   - `electron-stagewright` 配置 `NODE_PATH="./node_modules"` 并传入 `--app-root .`，适配 pnpm 模块依赖解析。
   - `chrome-devtools` 使用官方 `chrome-devtools-mcp`。
   - `vitest` 使用 `@djankies/vitest-mcp`。
2. **VS Code 工作区配置 (`.vscode/mcp.json`)**：
   - 为 VS Code 及 MCP 客户端扩展提供同步配置。
3. **项目文档与忽略规则更新**：
   - 验证各服务的 CLI 预检（doctor/version）。

---

## 3. 验收标准 (Acceptance Criteria)

- [x] 根目录生成 [`.mcp.json`](file:///Users/vyron/Mine/electron-starter/.mcp.json)，包含 `electron-stagewright`、`chrome-devtools`、`vitest` 且语法合法。
- [x] 根目录生成 [`.vscode/mcp.json`](file:///Users/vyron/Mine/electron-starter/.vscode/mcp.json)，与 `.mcp.json` 保持配置一致。
- [x] 确认未修改全局 `~/.gemini/config/mcp_config.json`，全局配置保持原样。
- [x] 验证 `electron-stagewright doctor --app-root .` 在本环境各项检查全绿通过。
- [x] 项目现有构建、格式检查（`pnpm check`）与单测（`pnpm test`）均 100% 保持通过。
