# IPC 网关 — 编码 Agent 工作说明

## 分支

`parallel/stage-04-ipc`；此分支与另外五个阶段并行开发，**不得自行合并 main**。

## 任务

改进 registry、安全发送者验证、错误归一化、处理器类型签名及测试；对外通道命名和参数保持兼容。

## 优先修改范围

src/main/ipc.ts、src/main/handlers/_.ts、src/shared/ipc.ts、src/shared/validation.ts、tests/ipc_.test.ts。

## 实施要求

1. 阅读实际源码、测试和相关中文文档，先确定缺陷和回归基线。
2. 做实际代码优化，不做无意义的目录搬迁或空接口。
3. 新增或修改的 Electron Main、Preload 和业务逻辑需要中文解释注释，Vue 不要求逐行注释。
4. 保留现有 Vite+、Vue 3、Electron IPC、发布安全和用户配置兼容性。
5. 提交独立 PR 到集成分支（由协调者创建）或保持本分支待集成；不得先合并 main。
6. 运行 Check、Vue 类型检查、全部单测、Linux Electron Smoke、Windows/macOS/Linux 打包；把具体运行记录与缺陷写入 PR。

## 本阶段验收

没有任意通道访问，拒绝不可信 frame，错误不泄漏内部路径或凭据。

## 并行冲突规则

不允许直接修改别的阶段拥有的核心代码；必须变更共享接口时在 PR 中标记协调需求。最终集成顺序为 01→02→03→04→05→06，按最新集成分支逐个 rebase/cherry-pick 并解决冲突。全部集成检查成功后，才能整体进入 main。

## 当前状态

此文件是任务交接说明，不代表独立 Agent 已启动或功能已实现。
