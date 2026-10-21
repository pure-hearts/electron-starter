# 系统通知模块重构方案

## 目标与当前问题

当前 `src/main/modules/notification.ts` 只提供 `notify(title, body)`，调用 `Notification.show()` 后在点击时向全部窗口广播标题。现有 API 可用于简单提示，但缺少唯一通知 ID、类型、来源窗口、点击动作、安全校验、通知节流以及可独立测试的状态逻辑。由于标题不唯一，Renderer 无法准确关联点击的业务通知。

**设计原则**：主进程统一管理原生通知；Renderer 仅通过白名单 `window.$ipcBridge` 提交受限请求；每个通知有唯一 ID；默认兼容已有调用；不将操作系统实际显示通知视为 guaranteed delivery。

## 模块划分

```text
src/shared/notification.ts           # 通知类型与事件负载
src/main/modules/notification.ts     # Electron Notification 适配器（薄层）
src/main/modules/notification-center.ts # ID、状态、生命周期、节流
src/main/modules/notification-policy.ts # 权限、内容长度、去重规则
src/main/ipc.ts                      # 参数校验后路由至通知中心
tests/notification-*.test.ts         # 纯逻辑单元测试
docs/notification.md                 # 页面调用与系统验收说明
```

## IPC 设计

保留当前 `notification:show(title, body)`，以免现有页面失效；新增版本化 API：

- `notification:capabilities`：查询 OS 基础支持情况（不等于保证系统允许展示）。
- `notification:send(options)`：创建带 ID 的通知，返回 `{ id, accepted }`；选项包含 `title`、`body`、可选 `kind`、`dedupeKey`、`action`。
- `notification:close(id)`：关闭仍由应用持有的通知对象。
- `notification:clicked`：旧事件维持原有字符串负载；新增 `notification:activated` 提供 `{id, kind, action, sourceWindowId?}`。
- `notification:closed`：带 ID 反馈关闭事件；可能因用户或操作系统关闭，不能保证全部平台可靠发出。

动作只允许应用内部路由白名单（例如 `/downloads`），严禁 Renderer 直接传入任意 shell 命令、文件路径或外部 URL。点击后由主进程验证目标，再聚焦对应窗口或主窗口，并发送受控导航事件。**通知点击与下载、更新等敏感状态变更分离**：单击通知不可自动执行安装、删除或支付操作。

## 默认策略

| 项目 | 方案 |
| --- | --- |
| 唯一 ID | UUID，避免标题冲突 |
| 支持平台 | Windows、macOS、Linux；按系统权限和桌面环境降级 |
| 通知内容 | 标题 1～128 字符、正文 1～1000 字符；拒绝非文本 |
| 限频 | 每窗口短时间窗口内限制次数；相同 dedupeKey 适度合并 |
| 生命周期 | `show/click/close/failed`，清理事件监听器及已结束对象 |
| 隐私 | 默认不通知正文中的凭证、令牌和个人敏感数据 |
| 失败处理 | 不支持/被拒绝时返回结构化状态；保留应用内反馈而非假定系统展示成功 |
| 多窗口 | 保留发起者窗口 ID，优先向原窗口定向通知，必要时主窗口兜底 |
| 测试 | 使用模拟通知适配器验证创建、点击、关闭、重复、速率和异常 |

## 实施顺序与验收

1. **P0 类型与兼容**：抽取共享类型，新增 `notification:send` / capabilities / activated，原 `notification:show` 和 clicked 不破坏。
2. **P0 生命周期**：通知中心按 ID 持有对象，监听 `click/close/failed`，处理重复关闭、通知对象回收。
3. **P1 安全与多窗口**：来源窗口、内部路由白名单、限频与去重、日志脱敏。
4. **P1 场景接入**：下载完成/失败、更新就绪等事件通过通知中心发送，提供通知偏好开关；防止更新进度刷屏。
5. **验收**：单元测试、CI 打包、真实 Windows/macOS/Linux 的显示/点击/权限拒绝/勿扰/多屏/托盘场景逐项记录。CI 成功不等于系统通知验收完成。

所有新增 Main/Preload 代码添加中文解释注释；涉及 Vue 交互仅按功能需要修改，遵循项目现有代码风格。
