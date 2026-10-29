# Technical Design: Enhance Desktop Capabilities (Phase 1)

## 1. 架构目标与职责边界

Phase 1 聚焦三大能力升级，坚持单一职责、遵循 `AGENTS.md` 规范：

1. **跨平台无边框自绘标题栏**：
   - Windows/Linux/macOS 窗口外观无缝统一，去除传统白灰边框。
   - macOS 继承 `titleBarStyle: "hiddenInset"` 并为红绿灯留出安全边距。
   - Windows/Linux 采用 `titleBarStyle: "hidden"`（或 `frame: false`）并自绘最小化、最大化/还原、关闭控制按钮。
   - 标题栏支持窗口拖拽（`-webkit-app-region: drag` / `no-drag`）与双击切换最大化。
2. **系统外观与原生强调色深度联动**：
   - 主进程监听 `nativeTheme.on('updated')`，并通过 IPC 广播主题和强调色（`systemPreferences.getAccentColor()`）。
   - 渲染进程统一由 `useAppStore` 消费，动态配置 Naive UI 的 `themeOverrides`，实现强调色（Primary Color）自动适配系统原生偏好。
   - 启动期注入预设背景色，杜绝深色模式下的白色闪烁。
3. **原生 Shell 安全调用与文件交互**：
   - 暴露 `shell:showItemInFolder`、`shell:openPath`、`shell:trashItem`、`shell:openExternal` 类型化 IPC。
   - 主进程增加严格的路径规范化与协议白名单防注入校验。

---

## 2. 详细接口设计与数据契约

### 2.1 IPC 通信协议 (`src/shared/ipc.ts`)

```typescript
export interface DesktopInvoke {
  // ... 已有通道 ...

  // 窗口状态查询
  "window:isMaximized": { args: []; result: boolean };

  // 系统外观与强调色
  "theme:system:get": {
    args: [];
    result: {
      shouldUseDarkColors: boolean;
      accentColor: string | null;
    };
  };

  // 原生 Shell 操作
  "shell:showItemInFolder": { args: [path: string]; result: boolean };
  "shell:openPath": { args: [path: string]; result: string };
  "shell:openExternal": { args: [url: string]; result: boolean };
  "shell:trashItem": { args: [path: string]; result: boolean };
}

export interface DesktopEvents {
  // ... 已有事件 ...
  "window:maximize-change": boolean;
  "theme:system:changed": {
    shouldUseDarkColors: boolean;
    accentColor: string | null;
  };
}
```

### 2.2 主进程模块设计

1. **`src/main/window/options.ts`**:
   - macOS: `titleBarStyle: "hiddenInset"`, `trafficLightPosition: { x: 14, y: 12 }`
   - Windows/Linux: `titleBarStyle: "hidden"`（配合自绘标题栏按钮）
2. **`src/main/window/main-window.ts`**:
   - 监听窗口 `maximize` 与 `unmaximize` 事件，向渲染进程广播 `"window:maximize-change"`。
3. **`src/main/modules/system/theme-module.ts`**:
   - 封装系统主题获取逻辑，通过 `nativeTheme.shouldUseDarkColors` 与 `systemPreferences.getAccentColor()` 提取色值。
   - 监听 `nativeTheme.on('updated')`，向全部窗口广播 `"theme:system:changed"`。
4. **`src/main/modules/system/shell-module.ts`**:
   - 封装 `shell.showItemInFolder`、`shell.trashItem`、`shell.openPath`、`shell.openExternal`。
   - 校验：必须是受信任协议（`http:` / `https:` / `mailto:`），禁止打开未知命令与二进制执行。

### 2.3 渲染进程模块设计

1. **`src/renderer/components/TitleBar.vue`**:
   - 跨平台布局：
     - macOS：左侧留出 `76px` 安全宽度供原生红绿灯展示；中间放置应用标题与路由导航；右侧放置主题/语言切换。
     - Windows/Linux：左侧放置 Logo 与导航；中间放置标题（可拖拽）；右侧集成最小化、最大化/还原、关闭自绘按钮。
   - 拖拽控制：根容器声明 `-webkit-app-region: drag`，内部按钮、导航链接、选择器声明 `-webkit-app-region: no-drag`。
2. **`src/renderer/stores/app.ts`**:
   - 增加 `accentColor` 响应式变量。
   - 初始化时调用 `"theme:system:get"`，并订阅 `"theme:system:changed"` 广播。
   - 动态计算并向 Naive UI `<n-config-provider :theme-overrides="themeOverrides">` 注入主色。
3. **Playground 页面增加集成体验区**:
   - 新增“桌面原生 Shell 与文件”测试卡片（在文件管理器中定位、移至回收站、外部安全链接打开测试）。

---

## 3. Vitest 集成测试设计 (`tests/*-integration.test.ts`)

1. **`tests/shell-integration.test.ts`**:
   - 聚焦系统 Shell 与路径安全策略：
     - 测试 `validateSafeExternalUrl`：放行安全协议（`http:` / `https:` / `mailto:`），坚决拦截 `javascript:`、`data:`、`file:`、`vbscript:` 等危险输入。
     - 测试安全路径解析 `resolveSafePath`：拦截 `../` 目录穿越、空路径、无效特殊字符。
     - 测试模拟 Shell 操作（showItemInFolder, openPath, trashItem）与异常防御。
2. **`tests/theme-system-integration.test.ts`**:
   - 验证系统外观模式计算逻辑（`system` 模式结合 `shouldUseDarkColors` 与 `prefers-color-scheme`）。
   - 验证系统强调色（`accentColor`）十六进制转换、对比度检测与 Naive UI 调色板映射逻辑。
