# PRD: 托盘图标自动化生成与资产同步 (Tray Icon Generation and Asset Sync)

## 1. 目标 (Goal)

完善应用图标自动化生成流程，在 [`scripts/generate-icons.py`](file:///Users/vyron/Mine/electron-starter/scripts/generate-icons.py) 中增加托盘图标自动生成支持，使开发与生产环境中的系统托盘图标与全新设计的现代科技原子核应用图标完全同步。

---

## 2. 现状与痛点 (Current State & Issues)

1. **脚本遗漏托盘资源生成**：之前的 `generate-icons.py` 只生成了主应用图标（1024/512 png、ico、icns、favicon），未生成托盘资源。
2. **macOS 菜单栏规范不匹配**：macOS 菜单栏必须使用带 Alpha 通道的单色模板图（`trayTemplate.png`），若使用普通彩色图标会导致背景突兀、深浅色模式无法自适应。
3. **旧占位图残留**：`resources/icons/` 下残留的 16x16 旧 `trayTemplate.png` 导致 Electron 优先加载了旧图。

---

## 3. 需求范围 (Requirements)

- **macOS 模板图标生成**：
  - 生成 `resources/icons/trayTemplate.png` (16x16)；
  - 生成 `resources/icons/trayTemplate@2x.png` (32x32 Retina)；
  - 提取原子轨道与核心符号的纯黑单色 + Alpha 透明通道剪影，适配 macOS 系统自适应反色。
- **Windows / Linux 彩色托盘图标生成**：
  - 生成 `resources/icons/tray.png` (16x16)；
  - 生成 `resources/icons/tray@2x.png` (32x32)；
  - 呈现高对比度微型科技图标。
- **主进程加载优化**：
  - 确保 [`tray.ts`](file:///Users/vyron/Mine/electron-starter/src/main/modules/system/tray.ts) 能够正确优先加载带 `@2x` 的高清托盘图标。

---

## 4. 验收标准 (Acceptance Criteria)

- [x] 执行 `python3 scripts/generate-icons.py`（或 `npm run icons:generate`）能完整产出 4 个托盘图标文件：
  - `resources/icons/trayTemplate.png`
  - `resources/icons/trayTemplate@2x.png`
  - `resources/icons/tray.png`
  - `resources/icons/tray@2x.png`
- [x] 产出的图标像素尺寸精确符合 16x16 与 32x32 规范。
- [x] `npm run check` 与 `npm test` 100% 保持通过。
