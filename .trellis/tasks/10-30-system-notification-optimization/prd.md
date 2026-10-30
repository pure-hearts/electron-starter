# 系统通知体验与能力优化 (System Notification Optimization)

## Goal

优化桌面端系统通知机制，修复现有通知静音设置未生效的问题，增强视觉与声音反馈，引入窗口焦点感知的静音智能降噪（前台静默系统横幅 / 后台有声横幅），支持通知 `tag` 覆盖更新机制，并在前端实现点击通知后的页面路由联动跳转。

## Scope Decisions

- **本期范围（In Scope）**：
  1. 修复通知静音设置：读取 `notificationSound` 设置，正确透传给 Electron 原生通知的 `silent` 选项。
  2. 默认应用图标与自定义图标：默认统一使用应用图标（`resources/icons/icon.png`），并允许在 `options.icon` 中传入自定义图标路径。
  3. 窗口焦点感知的智能降噪：保持原生系统横幅弹出，当主窗口处于前台激活聚焦状态时，自动静默（`silent: true`），避免打扰；离焦/最小化/后台时按用户设置播放提示音。
  4. 通知覆盖更新机制：引入 `tag` 字段，同 `tag` 的连续通知静默关闭上一条未完成通知并展示最新通知，且更新操作不受全局 10 秒频控限制。
  5. 点击通知后的路由跳转：在 Renderer 端监听 `notification:activated` 事件，当 `action` 为前端路由（如 `/settings`）时，自动跳转到对应页面。
- **延后范围（Out of Scope）**：
  - 应用内完整的“通知中心抽屉（Notification Drawer）”与持久化历史记录库，保持系统轻量。

## Confirmed Facts & Evidence

1. **现有架构**：
   - 主进程已有 `NotificationCenter`（[center.ts](file:///Users/vyron/Mine/electron-starter/src/main/modules/notification/center.ts)），具有 3 秒 `dedupeKey` 防抖、10 秒 10 次频控以及 `settle` 终态防泄漏机制。
   - 适配器由 `src/main/modules/notification/index.ts` 注入，`new Notification` 目前只传了 `title` 和 `body`，缺少 `silent` 和 `icon`。
   - `Settings.vue` 已有 `notificationsEnabled` 和 `notificationSound` 的设置项。
   - 图标资源已存在于 `resources/icons/icon.png`。
   - IPC 验证 `src/shared/validation.ts` 对 `notification:send` 的入参有严格的属性白名单检查，新增字段必须同步加入白名单。
   - Renderer 的 `src/renderer/App.vue` 或全局监听点尚未监听 `notification:activated` 进行路由导航。

## Requirements

- **REQ-1（声音与静音设置闭环）**：
  - 检查 `notificationSound` 设置，若为 `false`，则所有原生通知 `silent: true`。
- **REQ-2（前台焦点智能降噪）**：
  - 统一调用操作系统原生通知。
  - 若 `mainWindow.isFocused()` 为 `true`，无论声音设置如何，自动强制 `silent: true`。
  - 若窗口未聚焦/最小化，则当 `notificationSound: true` 时发出提示音，为 `false` 时静音。
- **REQ-3（图标支持）**：
  - 原生通知默认携带应用图标（`resources/icons/icon.png`）。
  - 支持 `options.icon` 显式覆盖。
  - 针对 Windows/macOS/Linux 做路径适配（确保绝对路径有效性）。
- **REQ-4（Tag 覆盖与频控旁路）**：
  - `NotificationOptions` 新增可选字段 `tag?: string`。
  - 在 `NotificationCenter` 中，若存在相同 `tag` 的处于活跃状态的通知，立即静默关闭（`close`）旧通知，并允许新通知展示（不计入 10s 频控）。
- **REQ-5（统一 IPC 广播与 Renderer 响应调度）**：
  - 主进程保持职责单一：点击通知时仅负责窗口激活与聚焦，并统一向渲染进程广播 `notification:activated` 事件，移除主进程端私自执行的系统文件定位副作用。
  - Renderer 端统一作为业务动作的唯一决策方：在 `App.vue`（或对应业务 Store）中统一监听 `notification:activated`，依据参数做出反应：
    - 若 `action` 为应用路由（如 `/settings`），执行 `router.push(action)`；
    - 若 `action` 为本地文件路径，通过现有的 typed IPC `shell:showItemInFolder` 调用系统文件定位。
- **REQ-6（IPC 校验安全性）**：
  - 在 `src/shared/validation.ts` 中为 `NotificationOptions` 白名单补充 `tag` 与 `icon`，并添加类型与安全校验。

## Acceptance Criteria

- [x] 在设置中关闭“通知声音”后，新触发的原生通知均为静音（`silent: true`）。
- [x] 窗口聚焦（`mainWindow.isFocused()`）时触发通知，横幅正常弹出且自动静音；窗口离焦/最小化时，根据设置播放提示音。
- [x] 系统通知展示时带有应用图标。
- [x] 传入相同 `tag` 的通知时，先前的活跃通知被就地关闭并展示新通知，且不受 10 秒 10 次的全局限流拦截。
- [x] 点击带有路由形式 `action`（如 `/settings`）的通知时，应用窗口被激活并成功跳转至目标路由。
- [x] 现有测试（`tests/notification-center.test.ts`）与新增单元测试全绿，类型检查与构建通过。
