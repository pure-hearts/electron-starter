# 多任务文件下载中心 (Download Manager)

## 1. 概述与核心能力

`electron-starter` 内置了生产级的高性能多任务文件下载中心，支持大文件稳定传输与桌面特有交互体验：

- **并发调度队列**：支持自定义全局最大并发下载任务数（1~50）；
- **断点续传**：基于 HTTP `Range` 头与 `.part` 临时分片，支持网络波动自动重试与跨会话手动续传；
- **动态速度计算**：提供瞬时下载速度与滑动窗口平滑速度估算；
- **历史记录持久化**：已完成与已取消任务元数据持久化存储，支持检索、清空与单项删除；
- **系统通知与文件定位**：下载完成或失败时自动弹出系统通知，点击通知直接在系统文件管理器高亮定位目标文件。

---

## 2. 架构设计与状态机

下载管理器由以下核心子模块协同工作：

```mermaid
stateDiagram-v2
    [*] --> Queued: download:start
    Queued --> Downloading: 获得并发槽位
    Downloading --> Paused: download:pause
    Paused --> Queued: download:resume
    Downloading --> Completed: 传输完成并原子重命名
    Downloading --> Failed: 网络中断或服务异常
    Failed --> Queued: download:retry
    Downloading --> Cancelled: download:cancel
    Completed --> [*]
    Cancelled --> [*]
```

### 核心组成模块

1. **DownloadQueue** (`queue.ts`)：管理并发令牌池与等待队列，防止网络请求过载。
2. **SpeedTracker** (`speed-tracker.ts`)：基于时间窗口统计已传输字节数，平滑计算当前下载速度（KB/s 或 MB/s）与剩余预计时间（ETA）。
3. **DownloadDatabase** (`database.ts`)：持久化历史任务记录，提供内存缓存与异步落盘。
4. **FilePolicy** (`file-policy.ts`)：目标文件名去重与冲突重命名策略（如 `file (1).zip`）。

---

## 3. 安全防护与 URL 约束

在开启下载前，系统通过 `safeUrl()` 工具函数进行深度安全检查：

1. **协议限制**：仅放行 HTTPS 协议，防止明文 HTTP 劫持或证书剥离攻击；
2. **凭据防外泄**：严格禁止 URL 中嵌入账号密码（如 `https://user:pass@example.com`）；
3. **SSRF 私网穿透防御**：全面拒绝本地回环（`127.0.0.1`、`localhost`、`::1`）、局域网私网段（`10.0.0.0/8`、`172.16.0.0/12`、`192.168.0.0/16`）及链路本地地址。

---

## 4. 相关 IPC 契约接口

前端通过 `window.$ipcBridge` 进行下载交互：

```typescript
// 1. 创建下载任务
const taskId = await window.$ipcBridge.invoke(
  "download:start",
  "https://releases.example.com/package.zip",
);

// 2. 监听任务进度与状态广播
const unsubscribe = window.$ipcBridge.on("download:state", (task) => {
  console.log(`任务 ${task.id}: ${task.percent}%, 速度: ${task.speedFormatted}`);
});

// 3. 暂停、恢复、重试与取消
await window.$ipcBridge.invoke("download:pause", taskId);
await window.$ipcBridge.invoke("download:resume", taskId);
await window.$ipcBridge.invoke("download:retry", taskId);
await window.$ipcBridge.invoke("download:cancel", taskId);

// 4. 查询与管理下载历史
const history = await window.$ipcBridge.invoke("download:history:get", 50); // 读取前50条
await window.$ipcBridge.invoke("download:history:remove", taskId); // 删除单条记录
await window.$ipcBridge.invoke("download:history:clear"); // 清空历史

// 5. 检查本地下载文件是否依然存在
const exists = await window.$ipcBridge.invoke("download:file:exists", "/path/to/package.zip");
```

---

## 5. 源码导读

- **下载核心管理器**：`src/main/modules/download/manager.ts`
- **并发调度队列**：`src/main/modules/download/queue.ts`
- **下载速度追踪器**：`src/main/modules/download/speed-tracker.ts`
- **历史记录存储**：`src/main/modules/download/database.ts`
- **安全检查函数**：`src/shared/validation.ts`
