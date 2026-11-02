# 配置存储与排障诊断 (Store & Diagnostics)

## 1. 概述与核心能力

商业级应用必须具备稳健的**偏好设置持久化**与完善的**问题排障与诊断体系**：

- **Schema 版本化存储**：使用 `electron-store` 持久化，支持配置结构的声明式升级与版本平滑迁移（Migration），升级不丢配置；
- **多窗口状态广播**：当任意页面修改配置时，主进程自动向所有打开的窗口广播 `settings:changed`，保持全应用响应式同步；
- **分级脱敏日志**：集成 `electron-log`，内置敏感信息（Token、密钥、密码、本地私有绝对路径）自动脱敏规则；
- **一键打包诊断包**：支持在“设置中心 - 系统诊断”中一键将脱敏日志与系统环境硬件参数打包压缩为 `.zip` 文件导出，方便用户报障与研发定位。

---

## 2. 配置中心与 Schema 自动迁移 (`store/schema.ts`)

### 2.1 当前 Schema 状态结构 (Version = 2)

```typescript
export interface UserSettings {
  theme: "light" | "dark" | "system";
  locale: "zh-CN" | "en-US";
  closeToTray: boolean;
  windowBounds: string;
  autoStart: boolean;
  defaultDownloadDir: string;
  downloadConcurrency: number;
  autoResumeDownloads: boolean;
  notificationsEnabled: boolean;
  notificationSound: boolean;
  notifyOnDownload: boolean;
  notifyOnUpdate: boolean;
  globalShortcutToggle: string;
}
```

### 2.2 自动迁移机制 (Migration Pipeline)

当检测到用户本地文件的 `schemaVersion` 小于当前常量（`CURRENT_SETTINGS_VERSION`）时：

1. 自动执行 `migrateSettings(oldData)`；
2. 提取并保留老版本中的有效字段（如用户历史设置的语言和主题）；
3. 补齐新版本新增的默认值；
4. 更新本地文件的版本号并原子写盘，杜绝版本升级导致的配置丢失或程序闪退。

---

## 3. 日志分级与敏感信息脱敏 (`core/logger.ts`)

为了防止用户隐私信息（如登录凭证、认证 Token 或系统私密文件绝对路径）外泄至日志或控制台：

- **脱敏正则流水线**：日志模块内置敏感字段过滤器，对形如 `token=***`、`password=***`、`Bearer ***` 以及私有磁盘路径进行就地替换掩码（Redaction）；
- **日志文件位置**：存储于系统标准数据目录（`app.getPath('userData')/logs/`），按日期自动滚动切分与过期归档。

---

## 4. 系统诊断与一键导出 (`diagnostics.ts`)

在客户端排查线上疑难缺陷时，用户可在“设置中心”一键导出排障包：

1. **收集系统指纹**：
   - 操作系统版本、内核架构（x64 / arm64）；
   - Electron、Chromium、Node.js 运行版本；
   - 系统可用物理内存与当前应用进程内存占用。
2. **打包压缩**：
   - 提取最近 7 天的脱敏应用日志；
   - 将系统指纹与日志通过安全的压缩算法生成 `diagnostic-logs-<timestamp>.zip`；
   - 弹出系统原生“另存为”对话框，由用户选择保存目录。

---

## 5. 相关 IPC 契约接口

前端通过 `window.$ipcBridge` 与配置及诊断模块交互：

```typescript
// 1. 批量读取与更新用户配置
const settings = await window.$ipcBridge.invoke("settings:all:get");
await window.$ipcBridge.invoke("settings:all:set", {
  theme: "dark",
  locale: "zh-CN",
  downloadConcurrency: 5,
});

// 2. 监听全局配置变更广播
const unsubscribe = window.$ipcBridge.on("settings:changed", (newSettings) => {
  console.log("其他窗口或系统修改了配置:", newSettings);
});

// 3. 单项配置读取与写入
const theme = await window.$ipcBridge.invoke("store:get", "theme");
await window.$ipcBridge.invoke("store:set", "theme", "light");
await window.$ipcBridge.invoke("store:delete", "theme"); // 恢复预设默认值

// 4. 写入业务日志
await window.$ipcBridge.invoke("log:write", "info", "用户进入了设置中心");

// 5. 获取系统硬件诊断指标与导出排障包
const sysInfo = await window.$ipcBridge.invoke("diagnostics:system:get");
const exportedPath = await window.$ipcBridge.invoke("diagnostics:exportLogs");
```

---

## 6. 源码导读

- **配置存储与迁移**：`src/main/modules/store/index.ts` 与 `schema.ts`
- **日志脱敏与分级记录**：`src/main/modules/core/logger.ts`
- **系统诊断与压缩归档**：`src/main/modules/system/diagnostics.ts`
