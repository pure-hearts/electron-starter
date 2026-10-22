# 类型安全的 IPC 通信

所有提供给页面的系统能力集中声明在 `src/shared/ipc.ts`。主进程会在 `src/shared/validation.ts` 检查运行时参数，并在 `src/main/ipc.ts` 验证消息发送者的来源。

## 调用和事件订阅示例

```ts
// 请求主进程保存深色主题配置。
await window.$ipcBridge.invoke("store:set", "theme", "dark");
// 读取当前主题。
const current = await window.$ipcBridge.invoke("store:get", "theme");

// 订阅主进程推送的下载状态。
const stop = window.$ipcBridge.on("download:state", (state) => {
  console.log(state.percent);
});
// 不再需要监听时，调用返回的取消订阅函数。
stop();
```

## 如何新增 IPC 功能？

1. 在 `DesktopInvoke` 中声明新通道、参数及返回值类型。
2. 将通道添加到 `allowedChannels` 白名单。
3. 在 `validate()` 中校验传入参数的数量、类型和允许值。
4. 在 `src/main/ipc.ts` 中注册对应的主进程处理函数。
5. 验证页面调用是否正常，并为参数不合法等情况补充测试。

项目不会向页面暴露“任意 IPC 通道发送”、任意文件读写或执行操作系统命令的通用能力。
