/**
 * @file init-app.ts
 * @description 模板一键定制脚手架脚本：交互式/命令行批量更新应用标识、名称、AppID、协议及更新源。
 *
 * 运行方式:
 * - 交互式模式: pnpm init:app
 * - 自动化/静默模式: pnpm init:app --yes
 * - 自定义参数模式: pnpm init:app --name "My App" --app-id "com.mycompany.myapp" --repo "myorg/my-app"
 * - 预览模式: pnpm init:app --dry-run
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export interface InitAppOptions {
  productName: string;
  slug: string;
  appId: string;
  scheme: string;
  authorName: string;
  authorEmail: string;
  githubOwner: string;
  githubRepo: string;
  description?: string;
  resetHotKeys?: boolean;
  dryRun?: boolean;
}

export interface FileChange {
  path: string;
  relativePath: string;
  original: string;
  updated: string;
  changed: boolean;
}

/**
 * 将任意应用名称转换为规范的 kebab-case 包名 slug
 */
export function toKebabCase(name: string): string {
  return (
    name
      .trim()
      .replace(/([a-z\d])([A-Z])/g, "$1-$2")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .toLowerCase()
      .replace(/^-+|-+$/g, "") || "my-desktop-app"
  );
}

/**
 * 校验 slug 包名格式是否合法
 */
export function validateSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 2 && slug.length <= 50;
}

/**
 * 校验 AppId 格式是否合法（反向域名，至少两段）
 */
export function validateAppId(appId: string): boolean {
  return /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(appId);
}

/**
 * 校验自定义协议格式（小写字母、数字、连字符）
 */
export function validateScheme(scheme: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(scheme);
}

/**
 * 获取系统当前 Git 用户信息
 */
export function getGitUser(): { name: string; email: string } {
  let name = "";
  let email = "";
  try {
    name = execSync("git config user.name", { stdio: ["ignore", "pipe", "ignore"] })
      .toString("utf8")
      .trim();
  } catch {
    // 忽略错误
  }
  try {
    email = execSync("git config user.email", { stdio: ["ignore", "pipe", "ignore"] })
      .toString("utf8")
      .trim();
  } catch {
    // 忽略错误
  }
  return {
    name: name || "Developer",
    email: email || "developer@example.com",
  };
}

/**
 * 更新 package.json 内容
 */
export function updatePackageJson(content: string, options: InitAppOptions): string {
  const pkg = JSON.parse(content);
  pkg.name = options.slug;
  pkg.desktopName = options.slug;
  if (options.description) {
    pkg.description = options.description;
  }
  pkg.author = {
    name: options.authorName,
    email: options.authorEmail,
  };
  return JSON.stringify(pkg, null, 2) + "\n";
}

/**
 * 更新 electron-builder.yml 内容，严格保留原有注释与缩进
 */
export function updateElectronBuilderYml(content: string, options: InitAppOptions): string {
  let result = content;
  result = result.replace(/^appId:.*$/m, `appId: ${options.appId}`);
  result = result.replace(/^productName:.*$/m, `productName: ${options.productName}`);
  result = result.replace(/- name:.*Links$/m, `- name: ${options.productName} Links`);
  result = result.replace(/(schemes:\s*\n\s*-\s*)[a-zA-Z0-9_-]+/m, `$1${options.scheme}`);
  result = result.replace(/(publish:\s*[\s\S]*?owner:\s*)[^\n]+/m, `$1${options.githubOwner}`);
  result = result.replace(/(publish:\s*[\s\S]*?repo:\s*)[^\n]+/m, `$1${options.githubRepo}`);
  return result;
}

/**
 * 更新 .env.* 环境变量文件内容，严格保留注释
 */
export function updateEnvFile(content: string, options: InitAppOptions): string {
  let result = content;
  result = result.replace(/^VITE_APP_TITLE=.*$/m, `VITE_APP_TITLE=${options.productName}`);
  result = result.replace(
    /^VITE_APP_DEEP_LINK_SCHEME=.*$/m,
    `VITE_APP_DEEP_LINK_SCHEME=${options.scheme}`,
  );
  result = result.replace(/^APP_NAME=.*$/m, `APP_NAME=${options.slug}`);
  result = result.replace(/^APP_USER_MODEL_ID=.*$/m, `APP_USER_MODEL_ID=${options.appId}`);
  result = result.replace(/^APP_DEEP_LINK_SCHEME=.*$/m, `APP_DEEP_LINK_SCHEME=${options.scheme}`);

  const hotUpdateUrl = `https://github.com/${options.githubOwner}/${options.githubRepo}/releases/latest/download/manifest.json`;
  result = result.replace(/^HOT_UPDATE_URL=.*$/m, `HOT_UPDATE_URL=${hotUpdateUrl}`);

  // 替换示例下载 URL 中的仓库路径
  result = result.replace(
    /(VITE_APP_DOWNLOAD_TEST_URL=https:\/\/github\.com\/)[^/]+\/[^/]+(\/.*)/m,
    `$1${options.githubOwner}/${options.githubRepo}$2`,
  );

  return result;
}

/**
 * 更新 resources/app-config.json
 */
export function updateAppConfigJson(content: string, options: InitAppOptions): string {
  const config = JSON.parse(content);
  config.deepLinkScheme = options.scheme;
  config.hotUpdateUrl = `https://github.com/${options.githubOwner}/${options.githubRepo}/releases/latest/download/manifest.json`;
  return JSON.stringify(config, null, 2) + "\n";
}

/**
 * 更新 resources/app-update.yml
 */
export function updateAppUpdateYml(content: string, options: InitAppOptions): string {
  let result = content;
  result = result.replace(/^owner:.*$/m, `owner: ${options.githubOwner}`);
  result = result.replace(/^repo:.*$/m, `repo: ${options.githubRepo}`);
  result = result.replace(
    /^updaterCacheDirName:.*$/m,
    `updaterCacheDirName: ${options.slug}-updater`,
  );
  return result;
}

/**
 * 更新 HTML 文件中的 <title> 标签
 */
export function updateHtmlTitle(content: string, title: string): string {
  return content.replace(/<title>.*?<\/title>/g, `<title>${title}</title>`);
}

/**
 * 汇总执行所有配置文件的生成与写入
 */
export function planInitChanges(
  options: InitAppOptions,
  projectRoot = process.cwd(),
): FileChange[] {
  const targets: { relPath: string; updater: (raw: string) => string }[] = [
    {
      relPath: "package.json",
      updater: (raw) => updatePackageJson(raw, options),
    },
    {
      relPath: "electron-builder.yml",
      updater: (raw) => updateElectronBuilderYml(raw, options),
    },
    {
      relPath: ".env.example",
      updater: (raw) => updateEnvFile(raw, options),
    },
    {
      relPath: ".env.development",
      updater: (raw) => updateEnvFile(raw, options),
    },
    {
      relPath: ".env.production",
      updater: (raw) => updateEnvFile(raw, options),
    },
    {
      relPath: ".env.testing",
      updater: (raw) => updateEnvFile(raw, options),
    },
    {
      relPath: "resources/app-config.json",
      updater: (raw) => updateAppConfigJson(raw, options),
    },
    {
      relPath: "resources/app-update.yml",
      updater: (raw) => updateAppUpdateYml(raw, options),
    },
    {
      relPath: "index.html",
      updater: (raw) => updateHtmlTitle(raw, options.productName),
    },
    {
      relPath: "src/renderer/index.html",
      updater: (raw) => updateHtmlTitle(raw, options.productName),
    },
  ];

  const changes: FileChange[] = [];

  for (const { relPath, updater } of targets) {
    const fullPath = join(projectRoot, relPath);
    if (!existsSync(fullPath)) continue;

    const original = readFileSync(fullPath, "utf8");
    const updated = updater(original);
    changes.push({
      path: fullPath,
      relativePath: relPath,
      original,
      updated,
      changed: original !== updated,
    });
  }

  return changes;
}

/**
 * 将变更实际写入磁盘
 */
export function applyInitChanges(changes: FileChange[]): void {
  for (const change of changes) {
    if (change.changed) {
      writeFileSync(change.path, change.updated, "utf8");
    }
  }
}

/**
 * 命令行参数解析辅助函数
 */
export function parseCliArgs(args: string[]): Partial<InitAppOptions> & {
  help?: boolean;
  yes?: boolean;
  dryRun?: boolean;
} {
  const result: Partial<InitAppOptions> & { help?: boolean; yes?: boolean; dryRun?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--yes" || arg === "-y") {
      result.yes = true;
    } else if (arg === "--dry-run") {
      result.dryRun = true;
    } else if (arg === "--name" || arg === "-n") {
      result.productName = args[++i];
    } else if (arg === "--slug" || arg === "-s") {
      result.slug = args[++i];
    } else if (arg === "--app-id") {
      result.appId = args[++i];
    } else if (arg === "--scheme") {
      result.scheme = args[++i];
    } else if (arg === "--author-name") {
      result.authorName = args[++i];
    } else if (arg === "--author-email") {
      result.authorEmail = args[++i];
    } else if (arg === "--owner") {
      result.githubOwner = args[++i];
    } else if (arg === "--repo") {
      const repoArg = args[++i];
      if (repoArg?.includes("/")) {
        const [owner, name] = repoArg.split("/");
        result.githubOwner = owner;
        result.githubRepo = name;
      } else {
        result.githubRepo = repoArg;
      }
    } else if (arg === "--desc" || arg === "--description") {
      result.description = args[++i];
    } else if (arg === "--reset-keys") {
      result.resetHotKeys = true;
    } else if (arg === "--no-reset-keys") {
      result.resetHotKeys = false;
    }
  }

  return result;
}

/**
 * 交互式问答流程
 */
async function promptUserOptions(cliOpts: Partial<InitAppOptions>): Promise<InitAppOptions> {
  const rl = createInterface({ input, output });

  try {
    const gitUser = getGitUser();

    console.log("\n🚀 \x1b[1m\x1b[36m欢迎使用 Electron + Vue 项目一键定制脚手架\x1b[0m\n");
    console.log("此脚本将协助您批量更新应用名称、AppID、协议名以及更新仓库配置。\n");

    // 1. 应用显示名称
    const defaultName = cliOpts.productName || "My Desktop App";
    const nameAnswer = await rl.question(
      `? \x1b[1m应用显示名称 (Product Name)\x1b[0m (\x1b[33m${defaultName}\x1b[0m): `,
    );
    const productName = nameAnswer.trim() || defaultName;

    // 2. 包名 slug
    const derivedSlug = toKebabCase(productName);
    const defaultSlug = cliOpts.slug || derivedSlug;
    let slug = "";
    while (!slug) {
      const slugAnswer = await rl.question(
        `? \x1b[1m应用英文包名标识 (Package Slug)\x1b[0m (\x1b[33m${defaultSlug}\x1b[0m): `,
      );
      const val = slugAnswer.trim() || defaultSlug;
      if (validateSlug(val)) {
        slug = val;
      } else {
        console.log(
          "  \x1b[31m❌ 包名格式不合法，仅支持小写字母、数字及中划线（2-50个字符）\x1b[0m",
        );
      }
    }

    // 3. App ID
    const defaultAppId = cliOpts.appId || `com.example.${slug.replace(/-/g, "")}`;
    let appId = "";
    while (!appId) {
      const appIdAnswer = await rl.question(
        `? \x1b[1m应用唯一包 ID (App ID)\x1b[0m (\x1b[33m${defaultAppId}\x1b[0m): `,
      );
      const val = appIdAnswer.trim() || defaultAppId;
      if (validateAppId(val)) {
        appId = val;
      } else {
        console.log(
          "  \x1b[31m❌ App ID 格式不合法，请使用形如 com.company.app 的反向域名格式\x1b[0m",
        );
      }
    }

    // 4. 自定义协议 Scheme
    const defaultScheme = cliOpts.scheme || slug;
    let scheme = "";
    while (!scheme) {
      const schemeAnswer = await rl.question(
        `? \x1b[1m自定义 Deep Link 协议 (Scheme)\x1b[0m (\x1b[33m${defaultScheme}\x1b[0m): `,
      );
      const val = schemeAnswer.trim() || defaultScheme;
      if (validateScheme(val)) {
        scheme = val;
      } else {
        console.log("  \x1b[31m❌ 协议格式不合法，仅支持小写字母、数字及中划线\x1b[0m");
      }
    }

    // 5. 作者名称与邮箱
    const defaultAuthorName = cliOpts.authorName || gitUser.name;
    const authorNameAnswer = await rl.question(
      `? \x1b[1m作者名称 (Author Name)\x1b[0m (\x1b[33m${defaultAuthorName}\x1b[0m): `,
    );
    const authorName = authorNameAnswer.trim() || defaultAuthorName;

    const defaultAuthorEmail = cliOpts.authorEmail || gitUser.email;
    const authorEmailAnswer = await rl.question(
      `? \x1b[1m作者邮箱 (Author Email)\x1b[0m (\x1b[33m${defaultAuthorEmail}\x1b[0m): `,
    );
    const authorEmail = authorEmailAnswer.trim() || defaultAuthorEmail;

    // 6. GitHub 仓库
    const defaultOwner = cliOpts.githubOwner || "my-org";
    const ownerAnswer = await rl.question(
      `? \x1b[1mGitHub 组织/用户名 (Owner)\x1b[0m (\x1b[33m${defaultOwner}\x1b[0m): `,
    );
    const githubOwner = ownerAnswer.trim() || defaultOwner;

    const defaultRepo = cliOpts.githubRepo || slug;
    const repoAnswer = await rl.question(
      `? \x1b[1mGitHub 仓库名 (Repository)\x1b[0m (\x1b[33m${defaultRepo}\x1b[0m): `,
    );
    const githubRepo = repoAnswer.trim() || defaultRepo;

    // 7. 是否重置热更新密钥对
    let resetHotKeys = cliOpts.resetHotKeys;
    if (resetHotKeys === undefined) {
      const resetAnswer = await rl.question(
        `? \x1b[1m是否重新生成专属的 Ed25519 热更新公私钥对？\x1b[0m (Y/n): `,
      );
      resetHotKeys = resetAnswer.trim().toLowerCase() !== "n";
    }

    return {
      productName,
      slug,
      appId,
      scheme,
      authorName,
      authorEmail,
      githubOwner,
      githubRepo,
      resetHotKeys,
      dryRun: cliOpts.dryRun,
    };
  } finally {
    rl.close();
  }
}

/**
 * 命令行帮助说明
 */
function printHelp(): void {
  console.log(`
\x1b[1m使用说明:\x1b[0m
  pnpm init:app [选项]

\x1b[1m选项:\x1b[0m
  -y, --yes              使用默认值快速初始化，无需交互式确认
  --dry-run              预览将要修改的文件，不实际写入磁盘
  -n, --name <name>      应用显示名称 (例如: "My Desktop App")
  -s, --slug <slug>      应用英文标识/包名 (例如: "my-desktop-app")
  --app-id <appId>       应用唯一包 ID (例如: "com.mycompany.myapp")
  --scheme <scheme>      Deep Link 唤起协议 (例如: "my-app")
  --author-name <name>   作者姓名
  --author-email <email> 作者邮箱
  --repo <owner/repo>    GitHub 仓库完整路径 (例如: "myorg/my-app")
  --reset-keys           强制重新生成 Ed25519 热更新密钥对
  --no-reset-keys        跳过密钥对生成
  -h, --help             查看帮助说明
`);
}

/**
 * CLI 入口主函数
 */
async function main() {
  const cliArgs = parseCliArgs(process.argv.slice(2));

  if (cliArgs.help) {
    printHelp();
    return;
  }

  let finalOptions: InitAppOptions;

  if (cliArgs.yes) {
    // 静默模式使用推导默认值
    const gitUser = getGitUser();
    const productName = cliArgs.productName || "My Desktop App";
    const slug = cliArgs.slug || toKebabCase(productName);
    finalOptions = {
      productName,
      slug,
      appId: cliArgs.appId || `com.example.${slug.replace(/-/g, "")}`,
      scheme: cliArgs.scheme || slug,
      authorName: cliArgs.authorName || gitUser.name,
      authorEmail: cliArgs.authorEmail || gitUser.email,
      githubOwner: cliArgs.githubOwner || "my-org",
      githubRepo: cliArgs.githubRepo || slug,
      resetHotKeys: cliArgs.resetHotKeys ?? true,
      dryRun: cliArgs.dryRun,
    };
  } else {
    finalOptions = await promptUserOptions(cliArgs);
  }

  console.log("\n📋 \x1b[1m即将应用的配置参数:\x1b[0m");
  console.log(`  - 显示名称:   \x1b[32m${finalOptions.productName}\x1b[0m`);
  console.log(`  - 英文包名:   \x1b[32m${finalOptions.slug}\x1b[0m`);
  console.log(`  - 应用包 ID:  \x1b[32m${finalOptions.appId}\x1b[0m`);
  console.log(`  - 唤起协议:   \x1b[32m${finalOptions.scheme}://\x1b[0m`);
  console.log(
    `  - 作者信息:   \x1b[32m${finalOptions.authorName} <${finalOptions.authorEmail}>\x1b[0m`,
  );
  console.log(
    `  - GitHub 仓库: \x1b[32m${finalOptions.githubOwner}/${finalOptions.githubRepo}\x1b[0m`,
  );
  console.log(`  - 重置密钥对: \x1b[32m${finalOptions.resetHotKeys ? "是" : "否"}\x1b[0m`);

  const changes = planInitChanges(finalOptions);

  console.log(`\n📝 \x1b[1m检测到 ${changes.length} 个配置文件:\x1b[0m`);
  for (const change of changes) {
    const status = change.changed ? "\x1b[33m[修改]\x1b[0m" : "\x1b[90m[无变化]\x1b[0m";
    console.log(`  ${status} ${change.relativePath}`);
  }

  if (finalOptions.dryRun) {
    console.log("\n🔍 \x1b[35m[Dry Run] 处于预览模式，未写入任何文件。\x1b[0m");
    return;
  }

  applyInitChanges(changes);
  console.log("\n✅ \x1b[32m所有配置文件更新完成！\x1b[0m");

  if (finalOptions.resetHotKeys) {
    try {
      console.log("\n🔑 正在生成专属的 Ed25519 热更新密钥对...");
      execSync("node scripts/generate-hot-keys.mjs", { stdio: "inherit" });
    } catch (err) {
      console.error("\x1b[31m❌ 生成热更新密钥对失败:\x1b[0m", err);
    }
  }

  console.log("\n🎉 \x1b[1m\x1b[32m项目初始化完成！您可以立即开始开发:\x1b[0m");
  console.log("  1. 启动本地开发: \x1b[36mpnpm dev\x1b[0m");
  console.log("  2. 执行自动化检查: \x1b[36mpnpm check\x1b[0m");
  console.log("  3. 构建全平台安装包: \x1b[36mpnpm dist:dir\x1b[0m\n");
}

// 仅在直接执行本文件时启动 CLI（被 import 测试时跳过）
if (process.argv[1]?.includes("init-app")) {
  main().catch((err) => {
    console.error("\n❌ 执行失败:", err);
    process.exit(1);
  });
}
