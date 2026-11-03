# 原生系统集成 (System Integration)

## 1. 概述与核心能力

桌面应用深植于操作系统生态中，需要调动系统的原生外围能力。`electron-starter` 集中提供了经过安全硬化的 6 大原生桌面能力：

1. **自定义协议与 Deep Link**：支持网页外部链接或第三方应用直接唤起客户端并传递参数；
2. **全局快捷键 (Global Shortcuts)**：支持在后台随时通过自定义按键组呼出或隐藏主窗口；
3. **安全 Shell 桌面交互**：提供在文件管理器高亮定位、调用系统默认程序打开文件、移至回收站与安全外部浏览器打开；
4. **系统主题与原生强调色同步**：跟随系统暗黑/明亮模式切换，自动提取 macOS/Windows 系统强调色并实时广播；
5. **跨平台开机自启动**：跨 Windows、macOS 与 Linux XDG 标准的开机自启管理；
6. **原生打印机与静默打印**：查询可用打印设备列表与触发打印任务。

---

## 2. 自定义协议与 Deep Link (协议唤起)

### 2.1 协议注册

主进程在冷启动时注册协议（默认为 `electronstarter://`）：

```typescript
app.setAsDefaultProtocolClient(scheme);
```

### 2.2 冷热启动收拢与排队收件箱 (`protocol/inbox.ts`)

- **冷启动（Cold Start）**：用户通过点击外部链接直接启动程序，链接参数被收集暂存在收件箱；当渲染层完成挂载后，调用 `protocol:pending` 一次性拉取消费；
- **热唤醒（Hot Wakeup）**：程序已在运行中，外部点击触发 macOS `open-url` 或 Windows `second-instance` 事件，主进程直接通过 IPC 事件 `protocol:open` 向渲染层实时广播。

---

## 3. 安全 Shell 桌面交互

直接将文件路径传给 Electron `shell` API 存在极大的路径穿越与命令注入风险。项目通过 `safeLocalPath()` 与 `safeExternalUrl()` 提供双重防御：

1. **`shell:showItemInFolder`**：在资源管理器/访达中定位高亮指定文件（如下载完成时自动定位）；
2. **`shell:openPath`**：以操作系统关联程序打开指定文件或目录；
3. **`shell:trashItem`**：将指定文件移入系统回收站/废纸篓，绝不执行危险的直接静默硬删除；
4. **`shell:openExternal`**：仅允许 `https:`、`http:`、`mailto:` 等安全协议，严格拦截 `javascript:`、`file:`、`data:` 等危险伪协议。

---

## 4. 系统主题自适应与强调色提取

为实现无缝的原生外观体验：

1. **暗黑/明亮模式监听**：主进程监听 `nativeTheme.on('updated')`，实时向所有窗口广播 `theme:system:changed`；
2. **系统强调色（Accent Color）**：
   - Windows / macOS：调用 `systemPreferences.getAccentColor()` 提取系统主题色（如 macOS 的多彩重点色、Windows 的个性化强调色）；
   - 自动生成与 Naive UI 主题变量匹配的 Primary/Hover/Pressed 配色，实现原生调色板同步。

---

## 5. 开机自启动管理 (`startup.ts`)

支持在设置中心由用户自主开关开机自启：

- **Windows**：写入注册表 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`；
- **macOS**：配置 Electron `app.setLoginItemSettings({ openAtLogin: true })`；
- **Linux**：标准 `~/.config/autostart/*.desktop` 规范自动生成与移除。

---

## 6. 原生右键上下文菜单 (Context Menu)

桌面应用区别于 Web 的核心原生交互体验之一是右键菜单：

1. **自动接管文本编辑区**：光标在 `input`、`textarea` 或富文本编辑区时，自动注入原生「撤销、重做、剪切、复制、粘贴、全选」；
2. **自动探测文本选区**：用户选中任意文字右键，自动提供「复制、全选」；
3. **开发调试选项**：在开发环境下自动注入「重新加载页面」和「检查元素 (Inspect Element)」；
4. **自定义业务菜单声明式绑定**：通过 Vue 指令 `v-contextmenu="items"` 轻松为特定组件绑定业务操作。

---

## 7. 渲染崩溃与致命异常兜底恢复 (Crash Fallback)

针对桌面应用可能出现的 OOM 或进程意外终止，构建了双重防御：

1. **主进程硬件/进程级崩溃监听 (`src/main/modules/system/crash.ts`)**：
   - 监听 `webContents` 的 `render-process-gone` 事件；
   - 支持代次与阈值恢复限制；在恢复失败或用户取消时，自动切换加载离线独立兜底页 `public/crash-fallback.html`，展示崩溃原因、代码与重启引导，彻底杜绝白屏卡死；
2. **Vue 渲染层组件级错误边界 (`src/renderer/components/ErrorFallback.vue`)**：
   - 捕获未处理的组件渲染死循环或致命 JS 错误，局部呈现科技风友好恢复卡片并支持堆栈排查与一键重试。

---

## 8. 相关 IPC 契约接口

前端通过 `window.$ipcBridge` 与原生集成模块交互：

```typescript
// 1. Deep Link 协议与冷启动排队参数拉取
const pendingLinks = await window.$ipcBridge.invoke("protocol:pending");
window.$ipcBridge.on("protocol:open", (url) => {
  console.log("外部协议唤起:", url);
});

// 2. 全局快捷键注册与查询
await window.$ipcBridge.invoke("shortcut:register", "CommandOrControl+Shift+X");
const shortcut = await window.$ipcBridge.invoke("shortcut:get");

// 3. 安全 Shell 操作
await window.$ipcBridge.invoke("shell:showItemInFolder", "/path/to/download.zip");
await window.$ipcBridge.invoke("shell:openPath", "/path/to/doc.pdf");
await window.$ipcBridge.invoke("shell:openExternal", "https://electronjs.org");
await window.$ipcBridge.invoke("shell:trashItem", "/path/to/obsolete.log");

// 4. 主题状态与原生强调色查询
const themeState = await window.$ipcBridge.invoke("theme:system:get");

// 5. 开机自启动开关
const isAutoStart = await window.$ipcBridge.invoke("startup:get");
await window.$ipcBridge.invoke("startup:set", true);

// 6. 打印机列表与打印
const printers = await window.$ipcBridge.invoke("print:printers");
await window.$ipcBridge.invoke("print:execute");
```

---

## 7. 源码导读

- **Deep Link 协议处理**：`src/main/modules/protocol/`
- **Shell 原生封装**：`src/main/modules/system/shell-module.ts`
- **系统主题同步**：`src/main/modules/system/theme-system.ts`
- **全局快捷键**：`src/main/modules/system/shortcut-module.ts`
- **自启动管理**：`src/main/modules/system/startup.ts`
- **打印集成**：`src/main/modules/system/printer.ts`
