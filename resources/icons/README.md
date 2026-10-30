# 图标资产说明 (Icon Assets)

本项目包含全平台桌面应用、Web 端及系统托盘的完整图标套件。由 `scripts/generate-icons.py` 脚本统一生成：

## 1. 应用程序图标

- `icon.svg`：矢量源文件。
- `icon-1024.png`：1024x1024 像素高清母图。
- `icon.png`：512x512 像素标准应用图标（用于 Linux 及基础展示）。
- `icon.ico`：Windows 应用复合图标（包含 16, 24, 32, 48, 64, 128, 256 多尺寸）。
- `icon.icns`：macOS 原生 Retina 应用图标包。

## 2. 系统托盘图标 (按平台原生规范)

- **macOS**：
  - `trayTemplate.png` (16x16)
  - `trayTemplate@2x.png` (32x32 Retina)
  - _符合 Apple Menu Bar 规范：纯黑 + 透明通道，系统自动处理深色/浅色自适应反色与高亮。_
- **Windows**：
  - `tray.ico` (包含 16x16, 24x24, 32x32 多分辨率)
  - _专为 Windows 任务栏通知区域打造，避免加载大尺寸应用图标造成缩放毛边。_
- **Linux / 跨平台通用**：
  - `tray.png` (16x16)
  - `tray@2x.png` (32x32)
