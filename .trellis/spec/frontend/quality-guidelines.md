# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

- **导入与声明隔离（Newline After Import）**：
  - 模块顶部的 `import` 导入块结束与后续的常量、变量声明、函数定义、类型接口或注释之间，必须保留单空行隔开。
  - 项目通过 `vite.config.ts` 中的 `lint.rules["import/newline-after-import"]: "error"` 开启强制校验与自动修复。
- **变量与函数隔离（Statement Padding）**：
  - 顶层模块级变量/常量声明与函数定义之间、独立函数与函数之间必须保留单空行隔开，保持结构清晰。
- **代码校验门禁**：
  - 提交或合并前必须运行 `npm run check`（`vp check`）与 `npm test`（`vp test`），保证 0 报错。

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)
