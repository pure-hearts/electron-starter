# Electron 新手阅读指南：P0 核心架构

## 先理解三个角色

- **Main 主进程**：管理应用生命周期、窗口、操作系统功能。
- **Preload 预加载脚本**：使用 contextBridge 将有限的 IPC 接口暴露给页面。
- **Renderer 渲染进程**：运行 Vue 界面，不直接获取 Node.js 权限。

## 推荐源码阅读顺序

1. `src/main/index.ts`：单实例、初始化、退出生命周期。
2. `src/main/window.ts`：BrowserWindow、安全选项、页面导航。
3. `src/shared/ipc.ts`：统一定义消息通道、参数和返回值。
4. `src/preload/index.ts`：contextBridge、invoke 和 on。
5. `src/main/ipc.ts`：ipcMain.handle、调用来源验证和功能路由。
6. `src/shared/validation.ts`：运行时参数校验及下载 URL 限制。

## 双向 IPC：请求和响应

```text
Vue 页面：window.desktop.invoke('app:version')
    ↓
Preload：检查通道白名单，ipcRenderer.invoke(...)
    ↓
Main：ipcMain.handle(...) 校验发送者和参数
    ↓
调用 app.getVersion()，Promise 将结果返回给页面
```

## 主动推送：主进程到页面

主进程调用 `webContents.send('download:state', payload)`，页面使用
`window.desktop.on('download:state', callback)` 接收。
`on` 返回取消订阅函数；页面不再需要监听时应执行它。

## 常见疑问

**为什么有 TypeScript 还需要校验参数？**
TS 编译后不会自动检查运行时数据，因此主进程仍须验证来源、长度、类型和允许值。

**为什么不用页面直接访问 Node.js？**
页面可能加载不可信内容。开启 `contextIsolation` 和 `sandbox`、关闭
`nodeIntegration`，可缩小网页被攻击后能够使用的系统权限。

**为什么初始化要等待 app.whenReady？**
Electron 的底层系统资源需要先初始化，然后再创建 BrowserWindow、Tray 等对象。

> 本阶段只修改注释与本指南，不改变业务逻辑，不修改 Vue 文件。
