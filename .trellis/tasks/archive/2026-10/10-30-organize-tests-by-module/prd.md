# PRD: 按功能模块组织测试目录结构 (Organize Tests Directory by Feature Modules)

## 1. 目标 (Goal)

将平铺在 `tests/` 根目录下的 47 个测试文件按业务与功能模块重构并迁移至清晰的 8 个子目录，提升代码可读性、维护性与单模块测试效率。

---

## 2. 目录规划 (Directory Structure)

- `tests/download/` (7 个测试文件)
- `tests/updater/` (9 个测试文件)
- `tests/system/` (7 个测试文件)
- `tests/deeplink/` (4 个测试文件)
- `tests/window/` (3 个测试文件)
- `tests/ipc/` (5 个测试文件)
- `tests/core/` (9 个测试文件)
- `tests/shared/` (2 个测试文件)

---

## 3. 验收标准 (Acceptance Criteria)

- [x] 创建 8 个模块子目录，使用 `git mv` 将 47 个测试文件迁移至对应目录。
- [x] 批量修正测试文件内部的源码相对引用路径（从 `../src/` 升级为 `../../src/`）。
- [x] `npm run check` 0 错误。
- [x] `npm test` 47 个测试套件、194 个测试用例 100% 通过。
- [x] `npm run build` 正常构建。
