# 系统通知优化技术方案 (Technical Design)

## Architecture & Boundaries

本方案在保持原有分层架构（`main` / `preload` / `renderer` / `shared`）与单包隔离原则的前提下进行增强：

```
Renderer Process
  │  (Vue 3 + Vue Router)
  ├─ 监听 "notification:activated" (统一事件响应中心)
  │    ├─ 若 action 匹配应用前端路由 ──> router.push(action)
  │    └─ 若 action 为本地文件路径 ──> invoke("shell:showItemInFolder", action)
  │
  ▼ IPC (notification:send / notification:show)
Main Process
  ├─ IPC Validator (`src/shared/validation.ts`)
  │    └─ 校验 title, body, kind, dedupeKey, action, tag, icon 白名单
  │
  ├─ NotificationCenter (`src/main/modules/notification/center.ts`)
  │    ├─ Tag 状态映射：tag -> notificationId
  │    ├─ 频控旁路策略：同 tag 覆盖更新直接关闭旧通知并绕过 10s 限流
  │    └─ 去重与生命周期 settled 防重保证
  │
  └─ Native Adapter (`src/main/modules/notification/index.ts`)
       ├─ 读取 settings: notificationSound
       ├─ 读取 window 状态: mainWindow.isFocused()
       │    └─ silent = !soundEnabled || isFocused
       ├─ 图标解析: options.icon ?? resolveAppIconPath()
       └─ 点击激活: 聚焦窗口 + 纯粹派发广播 notification:activated (无主进程私自副作用)
```

## Data Flow & Contracts

### 1. 契约更新 (`src/shared/notification.ts`)

```typescript
export interface NotificationOptions {
  title: string;
  body: string;
  kind?: NotificationKind;
  dedupeKey?: string;
  tag?: string; // 新增：标识同一业务流的通知标签，用于就地覆盖
  icon?: string; // 新增：自定义图标绝对路径（受控验证）
  action?: string; // 路由路径 (以 "/" 开头) 或本地文件路径
}
```

### 2. IPC 校验规则 (`src/shared/validation.ts`)

在 `validate("notification:send", [options])` 中：

- `tag`：必须为 string，长度限制 1~64 字符，只能包含字母、数字、下划线、破折号和冒号。
- `icon`：必须为 string，限制 1~500 字符，且不能包含回车换行或恶意伪协议。
- 允许的键名集合同步添加 `"tag"` 和 `"icon"`。

### 3. 主进程适配逻辑 (`src/main/modules/notification/index.ts`)

- 引入应用主图标解析：
  ```typescript
  import { app } from "electron";
  import path from "node:path";

  function getNotificationIcon(customIcon?: string): string | undefined {
    if (customIcon && typeof customIcon === "string") return customIcon;
    const iconPath = path.join(app.getAppPath(), "resources", "icons", "icon.png");
    return iconPath;
  }
  ```
- 计算 `silent` 策略：
  ```typescript
  const soundEnabled = getSetting("notificationSound") ?? true;
  const mainWindow = getMainWindow();
  const isFocused = mainWindow ? mainWindow.isFocused() && !mainWindow.isMinimized() : false;
  const silent = !soundEnabled || isFocused;
  ```
- 构建 `new Notification({ title, body, icon, silent })`。

### 4. Tag 覆盖机制 (`src/main/modules/notification/center.ts`)

- `NotificationCenter` 内部维护 `private tagged = new Map<string, string>();`（tag -> id）。
- 当发送带有 `tag` 的通知时：
  1. 检查 `this.tagged.get(options.tag)`；
  2. 若该 ID 仍在 `this.active` 中，调用 `this.close(oldId)` 关闭上一条通知；
  3. 判定该请求为同类更新，**不计入** `this.history` 频控检查，避免被 10 秒上限拦截；
  4. 新通知进入 `active` 后，更新 `this.tagged.set(options.tag, id)`；
  5. 通知在 `settle` 时清理 `this.tagged` 中对应的记录。

### 5. 渲染进程统一事件响应中心 (`src/renderer/App.vue`)

- 主进程在 `activated` 中只负责激活聚焦窗口，并广播 `notification:activated`，不直接执行任何业务动作。
- 在渲染进程统一调度：
  ```typescript
  window.$ipcBridge.on("notification:activated", (payload) => {
    if (!payload.action || typeof payload.action !== "string") return;
    const knownRoutes = router
      .getRoutes()
      .map((r) => r.path)
      .filter((p) => p !== "/:pathMatch(.*)*");
    if (knownRoutes.includes(payload.action)) {
      if (router.currentRoute.value.path !== payload.action) {
        void router.push(payload.action);
      }
      return;
    }
    // 若不是前端已知路由，作为文件路径请求主进程定位
    if (payload.action.startsWith("/") || /^[a-zA-Z]:\\/.test(payload.action)) {
      void window.$ipcBridge
        .invoke("shell:showItemInFolder", payload.action)
        .catch(() => undefined);
    }
  });
  ```

## Compatibility & Migration Notes

- 向后兼容：所有新增字段（`tag`、`icon`）均为可选字段，原先的 `notify(title, body)` 和 `notifyBusiness(options)` 调用完全无须修改。
- 针对跨平台：
  - Windows：使用绝对路径作为 `icon`，配合已配置的 `AppUserModelId` 可以正常在 Action Center 显示。
  - macOS：macOS 会自动适配应用 Bundle 图标；若显式指定 icon 会优先显示自定义图标。

## Trade-offs & Rollback

- **降噪策略权衡**：前台聚焦时完全静音可能让个别期望每次都听到提示音的用户感觉“没响”，但符合主流现代桌面应用（如 Slack、Telegram、VS Code）的防打扰规范，能大幅降低高频打字/操作时的视听污染。
- **回滚方案**：核心改动位于 `center.ts` 和 `notification/index.ts`，如需回滚可直接检出这两个文件，不破坏其他业务逻辑。
