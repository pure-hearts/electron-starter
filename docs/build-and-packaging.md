# 跨平台打包构建与 CI/CD 规范 (Build & Packaging)

## 1. 概述与构建体系

本项目采用 **Vite+ (`vp`)** 作为统一的现代工程化工具链，搭配 **electron-builder** 进行跨平台客户端安装包分发：

- **高效编译**：基于 Vite 原生极速构建主进程、预加载脚本与 Vue 3 渲染层；
- **最小产物打包**：精准配置 `files` 白名单过滤规则，杜绝无用源码、测试文件或开发依赖打包进最终发布安装包；
- **多平台安装器全覆盖**：支持 Windows (NSIS / Portable)、macOS (DMG / ZIP) 与 Linux (AppImage / DEB)；
- **自动化 CI/CD**：内置 GitHub Actions 检查、多平台编译与自动发布流水线。

---

## 2. 环境变量体系规范

为了杜绝业务逻辑中的硬编码，项目建立了标准化的环境变量分层：

| 变量名                 | 作用范围 | 说明与示例                                                      |
| :--------------------- | :------- | :-------------------------------------------------------------- |
| `VITE_APP_ENV`         | 渲染层   | 运行环境标识（`development` / `production` / `testing`）        |
| `VITE_APP_TITLE`       | 渲染层   | 窗口与页面标题（如 `Electron Starter`）                         |
| `VITE_API_BASE_URL`    | 渲染层   | 后端业务 API 基地址（如 `https://api.example.com`）             |
| `APP_NAME`             | 主进程   | 原生应用名称                                                    |
| `APP_USER_MODEL_ID`    | 主进程   | Windows 通知与任务栏分组 ID（如 `com.example.electronstarter`） |
| `APP_DEEP_LINK_SCHEME` | 主进程   | 自定义协议 Scheme（如 `electronstarter`）                       |
| `APP_LOG_LEVEL`        | 主进程   | 日志输出等级（`info` / `warn` / `error` / `debug`）             |
| `APP_UPDATE_URL`       | 主进程   | 全量更新服务器清单根地址                                        |
| `HOT_UPDATE_URL`       | 主进程   | 资源热更新服务器清单根地址                                      |

环境模板文件参考：`.env.example`、`.env.development`、`.env.production`、`.env.testing`。

---

## 3. 常用构建与打包命令

```bash
# 1. 运行本地开发调试环境（热重载）
pnpm dev

# 2. 执行静态语法、类型与格式检查
pnpm check          # 等同于 vp check

# 3. 运行全量单元测试与集成测试
pnpm test           # 等同于 vp test --run

# 4. 编译三端生产产物（生成 dist/ 目录）
pnpm build

# 5. 生成未打包的本地目录（用于极速验证打包后主进程与产物）
pnpm pack:dir

# 6. 生成各平台正式分发安装包
pnpm build:win      # Windows NSIS 安装包 (x64)
pnpm build:mac      # macOS DMG / ZIP (x64 / arm64 Universal)
pnpm build:linux    # Linux AppImage 与 deb (x64)
```

---

## 4. 产物过滤规则 (`electron-builder.yml`)

为确保最终安装包体积轻巧，`electron-builder.yml` 严格限制打包文件：

```yaml
files:
  - dist/main/**/*
  - dist/preload/**/*
  - dist/renderer/**/*
  - package.json
  - "!**/*.map"
  - "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}"
```

未经编译的 `src/` 源码、`.trellis/` 任务目录、`tests/` 测试套件以及开发时临时文件均被排斥在外。

---

## 5. 代码签名策略

1. **Windows 平台**：
   - 当前采用**内部官网分发无证书模式**，用户首次安装受 SmartScreen 保护，信任后后续由应用内部热更新或静默覆盖更新；
   - 如需商业发布，在 CI/CD 中配置 `CSC_LINK` 与 `CSC_KEY_PASSWORD` 注入 EV 代码签名证书。
2. **macOS 平台**：
   - 本地构建与无公证分发默认关闭 Hardened Runtime；
   - 如需发布至公网且规避“应用已损坏”弹窗，需配置 Apple 开发者证书并在 CI 流水线集成 `notarize` 公证步骤。

---

## 6. GitHub Actions CI/CD 流水线

项目在 `.github/workflows/` 中内置了 4 套自动化流水线：

- **`check.yml`**：提交 PR 与推送主分支时自动运行 `vp check`、`vp test` 与 Web 端编译；
- **`package.yml`**：跨 Windows、macOS 与 Linux 矩阵式构建安装包，并将产物上传至 Artifacts 供下载测试；
- **`release.yml`**：推送版本 Tag（如 `v1.0.0`）时，自动编译并将产物发布到 GitHub Releases；
- **`hot-release.yml`**：单独打包渲染层热更新资源包，自动生成 Ed25519 签名与 SHA-256 清单文件并发布。
