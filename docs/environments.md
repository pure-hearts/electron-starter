# Vite+ 多环境配置

项目继续使用 Vite+ 的 `vite.config.ts` 和 Vite 标准 mode 机制。

| 环境 | 命令 | 文件 |
| --- | --- | --- |
| 开发 | `pnpm dev` | `.env.development` |
| 测试构建 | `pnpm build:testing` | `.env.testing` |
| 正式构建 | `pnpm build` | `.env.production` |

- `VITE_APP_ENV` 为构建时环境标识；与 `app.isPackaged`（是否打包）是两个不同的概念。
- `VITE_*` 会进入 Renderer 产物，**不能存放密钥或机密凭据**。
- 测试打包不意味着启用 Electron 的 CI 专用 smoke 开关。
- `vp test --run` 属于单元测试，不等于按 testing mode 构建安装包。
- 正式环境发布仍需要代码签名和系统验收。
