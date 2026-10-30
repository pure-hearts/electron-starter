# PRD: 跨进程统一运行环境与操作系统细分版本检测 (Platform Environment & OS Version Detection)

## 1. 目标 (Goal)

构建跨进程统一、类型安全、语义清晰的平台探测模块（`platform`）：

1. 统一区分容器环境：`isElectron` 与 `isWeb`；
2. 统一基础操作系统：`isWindows`、`isMac`、`isLinux`、`current`；
3. 支持操作系统细分版本判断：
   - Windows：`isWin7OrLower`、`isWin10`、`isWin11OrGreater`、`build`；
   - macOS：`isBigSurOrGreater` (macOS 11+)、`isVenturaOrGreater` (macOS 13+)；
4. 保证在主进程（Node.js `os`）与渲染进程（跨端 Bridge / Web UA）均可无缝使用且 API 一致。

---

## 2. 方案设计 (Architecture & API)

### 2.1 共享类型定义 (`src/shared/platform.ts`)

```ts
export interface WindowsVersionInfo {
  readonly isWin7OrLower: boolean;
  readonly isWin8: boolean;
  readonly isWin10: boolean;
  readonly isWin11OrGreater: boolean;
  readonly build: number;
  readonly major: number;
}

export interface MacVersionInfo {
  readonly isBigSurOrGreater: boolean; // macOS 11+
  readonly isVenturaOrGreater: boolean; // macOS 13+
  readonly isSonomaOrGreater: boolean; // macOS 14+
  readonly major: number;
}

export interface PlatformInfo {
  readonly isElectron: boolean;
  readonly isWeb: boolean;
  readonly current: string; // 'win32' | 'darwin' | 'linux' | 'web'
  readonly isWindows: boolean;
  readonly isMac: boolean;
  readonly isLinux: boolean;
  readonly windows: WindowsVersionInfo | null;
  readonly mac: MacVersionInfo | null;
}
```

### 2.2 主进程解析 (`src/main/platform.ts`)

- 基于 Node.js 原生 `os.release()` 与 `process.platform` 解析真实 OS 版本与 build 号。
- 解析函数设计为纯函数 `parsePlatform(rawPlatform, osRelease)`，方便 100% 覆盖单元测试。

### 2.3 渲染进程感知 (`src/renderer/bridge/platform.ts`)

- 纯 Web 模式下通过 `navigator.userAgent` 解析（或降级）；
- Electron 桌面模式下优先从 preload 或 `$ipcBridge` 同步主进程精准传递的平台元数据，并向后兼容原有导出（`isElectron`, `isWeb`, `usePlatform`）。

---

## 3. 验收标准 (Acceptance Criteria)

- [x] 在 `src/shared/platform.ts` 中建立跨端统一的平台解析纯函数与数据模型。
- [x] 主进程 `src/main/platform.ts` 导出增强后的 `platform` 对象（包含 `isElectron: true`, `isWeb: false`, `windows`, `mac` 等）。
- [x] 渲染进程 `src/renderer/bridge/platform.ts` 导出统一且向后兼容的 `platform` / `usePlatform()`，同时暴露版本感知。
- [x] 编写全面的单元测试，针对 Windows 7、Windows 10、Windows 11（build 22000+）以及 macOS 各版本进行穷尽模拟测试。
- [x] `npm run check` 与 `npm test` 100% 通过。
