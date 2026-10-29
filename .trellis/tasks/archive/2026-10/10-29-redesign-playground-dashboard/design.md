# Technical & Visual Design: Playground Dashboard

## 1. Visual & Information Architecture

```
+-------------------------------------------------------------------------+
| [Header] System Metrics & Status Banner                                |
| App Version: v0.1.1 | Platform: Darwin/Win32 | Mode: Production | IPC: OK |
+-------------------------------------------------------------------------+
| [Navigation Tabs]                                                       |
| [ Window & System ]  |  [ Data & Transfer ]  |  [ Update & Diagnostic ] |
+-------------------------------------------------------------------------+
|                                                                         |
| (Selected Tab Content in 2-Column Responsive Grid)                      |
|                                                                         |
| +-----------------------------+  +------------------------------------+ |
| | Sub-Module Card A           |  | Sub-Module Card B                  | |
| | - Actions                   |  | - Controls                         | |
| +-----------------------------+  +------------------------------------+ |
|                                                                         |
+-------------------------------------------------------------------------+
| [Interactive Output Console]                                            |
| Real-time logs with Timestamp, Action Tag, Status Badge, JSON Tree      |
| [Clear] [Copy]                                                          |
+-------------------------------------------------------------------------+
```

## 2. Component Structure

- `Playground.vue` 单文件组件组织：
  - `<script setup lang="ts">`: 业务逻辑、IPC 监听、日志队列状态、操作函数封装；
  - `<template>`:
    - `.dashboard-hero`: 顶部状态横幅；
    - `el-tabs`: 核心三大功能域切换；
    - `.console-card`: 结构化日志输出终端；
  - `<style scoped>`: 高级卡片阴影、边框微渐变、代码块终端高亮、深色主题自适应样式。

## 3. State Management

- `activeTab`: 记录当前选中的选项卡；
- `consoleLogs`: 数组结构存储操作记录 `{ timestamp, title, type: 'success' | 'error' | 'info', payload }`；
- `loadingStates`: `Record<string, boolean>` 管理各操作按钮的 Loading 状态。
