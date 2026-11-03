# 系统通知优化实施计划 (Implementation Plan)

## Ordered Implementation Checklist

- [x] **Step 1: 类型与校验扩展 (Shared Layer)**
  - 在 `src/shared/notification.ts` 中为 `NotificationOptions` 增加 `tag?: string` 和 `icon?: string`。
  - 在 `src/shared/validation.ts` 中将 `tag`、`icon` 加入 `allowedKeys`，并添加对应格式校验函数。
- [x] **Step 2: 通知中心 Tag 覆盖与频控旁路实现 (NotificationCenter)**
  - 在 `src/main/modules/notification/center.ts` 中维护 `tagged` 映射。
  - 支持相同 `tag` 的通知就地关闭上一条并绕过频控限制。
  - 编写与更新 `tests/notification-center.test.ts`，覆盖 tag 覆盖与绕过限流的单元测试。
- [x] **Step 3: 原生适配器增强 (Main Notification Adapter)**
  - 在 `src/main/modules/notification/index.ts` 中：
    - 读取 `getSetting("notificationSound")`。
    - 判断主窗口聚焦状态 `isFocused && !isMinimized`。
    - 将计算出的 `silent` 以及 `icon` 路径传入 `new Notification(...)`。
- [x] **Step 4: 前端路由联动 (Renderer App)**
  - 在 `src/renderer/App.vue` 中挂载 `desktop.on("notification:activated")` 监听器。
  - 当 `action` 以 `/` 开头且与当前路由不一致时，执行 `router.push(action)`。
- [x] **Step 5: 验证与回归测试**
  - 运行单元测试：`vp test tests/notification-center.test.ts`
  - 运行全量类型检查：`vp check`
  - 运行全量测试套件：`vp test`
- [x] **Step 6: 统一通知点击响应架构 (Unified Event-Driven Architecture)**
  - 从 `src/main/modules/notification/index.ts` 中移除主进程直接调用 `showItemInFolder` 的副作用代码。
  - 在 `src/renderer/App.vue` 中统一处理 `notification:activated`：匹配前端路由则执行 `router.push(action)`，若是文件路径则通过 IPC `window.$ipcBridge.invoke("shell:showItemInFolder", action)` 处理。
  - 运行测试与类型检查回归验证。

## Validation Commands

```bash
# 1. 运行通知中心专项单测
pnpm exec vp test tests/notification-center.test.ts

# 2. 运行完整测试套件
pnpm test

# 3. 运行类型检查
pnpm check
```

## Risky Files & Rollback Points

- `src/main/modules/notification/center.ts`: 核心状态机逻辑，需保证在 `settle` 时清理 `tagged` 映射，避免内存泄露。
- `src/shared/validation.ts`: IPC 校验白名单，若规则过严可能误拦截合法通知；若过宽可能破坏参数安全沙箱。
- 回滚命令：`git checkout src/shared/ src/main/modules/notification/ src/renderer/App.vue tests/notification-center.test.ts`
