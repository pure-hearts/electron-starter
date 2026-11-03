# Code Review 审查报告

- **审查对象**：本次增量功能（一键定制脚手架 `init:app`、原生右键上下文菜单 `Context Menu`、崩溃兜底恢复体系 `Crash Fallback`）
- **审查角色**：Code Review Engineer
- **审查原则**：生产事故导向，重点关注正确性、并发、安全、性能与数据一致性。

---

## 1. 发现的问题与现场修复证据

### 问题 1 (中危)：离线崩溃兜底页在点击「重新加载」时存在无限自重载死循环风险

- **风险位置**：`public/crash-fallback.html` 中的 `handleReload()`。
- **问题分析**：当应用崩溃且主进程加载离线兜底页 `crash-fallback.html` 后，若预加载桥接未注入（或 IPC 失败），原逻辑调用 `window.location.reload()` 会直接重新加载 `crash-fallback.html` 自身，导致用户点击后无限停留在崩溃提示页，无法回到应用主界面。
- **修复方案**：将回退重载机制修改为导航回应用根路径 `window.location.origin + '/'`。
- **修复证据**：
  ```javascript
  function handleReload() {
    if (window.$ipcBridge && typeof window.$ipcBridge.invoke === "function") {
      window.$ipcBridge.invoke("app:restart").catch(() => {
        window.location.href = window.location.origin + "/";
      });
    } else {
      window.location.href = window.location.origin + "/";
    }
  }
  ```

---

### 问题 2 (低危)：多窗口环境下右键自定义动作广播可能穿透到非活跃窗口

- **风险位置**：`src/main/modules/system/context-menu.ts`。
- **问题分析**：点击上下文菜单中的自定义项时，原实现使用全局 `broadcast("context-menu:action", ...)` 向所有窗口广播，若存在多个独立窗口可能触发跨窗口误调度。
- **修复方案**：利用弹出菜单所属的目标窗口 `win.webContents.send("context-menu:action", { id: item.id })` 进行精准定向派发，同时加入 `isDestroyed()` 安全防御。
- **修复证据**：
  ```typescript
  click: () => {
    if (item.id && !win.isDestroyed() && !win.webContents.isDestroyed()) {
      win.webContents.send("context-menu:action", { id: item.id });
    }
  };
  ```

---

## 2. 核心架构与生产安全性审查

1. **IPC 安全隔离与白名单准入**：
   - 通道 `context-menu:show` 已注册在 `allowedChannels` 白名单中；
   - 事件 `context-menu:action` 已注册在 `allowedEvents` 事件白名单中；
   - 参数 `ContextMenuOptions` 经过 TypeScript 接口强约束与主进程结构解构，杜绝远程任意原型污染或非法角色注入。
2. **生命周期与内存泄漏防护**：
   - 渲染层指令 `v-contextmenu` 采用 `WeakMap<HTMLElement, ...>` 绑定 DOM 节点，并在 `unmounted` 钩子中完整注销回调与事件监听器；
   - Vue 错误边界 `ErrorFallback.vue` 拦截致命错误并提供局部恢复，防止整页白屏。
3. **脚手架 `init:app` 的幂等与安全性**：
   - 具备完整参数校验与 `--dry-run` 预览能力；
   - 正则替换严格保留 YAML 与 ENV 的原有排版与注释，更新结果符合规范。

---

## 3. 自动化验证结果

- **代码规范检查**：`pnpm exec vp check`（326 个文件，0 warnings, 0 lint errors, 0 type errors）。
- **Vue 类型检查**：`pnpm run typecheck:vue`（0 TS 错误）。
- **单元测试验证**：`pnpm exec vp test --run`（全量 53 个测试套件，229 项测试 100% 全部通过）。
- **生产构建验证**：`pnpm exec vp build`（双端 3 进程构建成功，无破损依赖）。
