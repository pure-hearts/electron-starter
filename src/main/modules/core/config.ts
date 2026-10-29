/** 运行时配置：区分开发/打包资源目录，读取应用更新源等非敏感配置。 */
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";

// 配置接口明确允许加载的字段，避免意外把未知字段传给业务模块。
export interface RuntimeConfig {
  appUpdateUrl: string;
  hotUpdateUrl: string;
  deepLinkScheme: string;
}

// 缺失或损坏配置文件时采用安全默认值，保证应用仍能启动。
const empty: RuntimeConfig = {
  appUpdateUrl: process.env.APP_UPDATE_URL || "",
  hotUpdateUrl: process.env.HOT_UPDATE_URL || "",
  deepLinkScheme: process.env.APP_DEEP_LINK_SCHEME || "electron-starter",
};

/** 读取 resources/app-config.json，并结合环境变量进行覆盖后返回规范结构。 */
export function runtimeConfig(): RuntimeConfig {
  try {
    // 打包版的 process.resourcesPath 和开发版 cwd 路径不同。
    const location = app.isPackaged
      ? path.join(process.resourcesPath, "resources", "app-config.json")
      : path.join(process.cwd(), "resources", "app-config.json");

    let fileConfig: Partial<RuntimeConfig> = {};
    if (fs.existsSync(location)) {
      const values: unknown = JSON.parse(fs.readFileSync(location, "utf8"));
      if (values && typeof values === "object") {
        fileConfig = values as Partial<RuntimeConfig>;
      }
    }

    // 环境变量优先级高于本地配置文件
    const appUpdateUrl =
      process.env.APP_UPDATE_URL ||
      (typeof fileConfig.appUpdateUrl === "string" ? fileConfig.appUpdateUrl : "");

    const hotUpdateUrl =
      process.env.HOT_UPDATE_URL ||
      (typeof fileConfig.hotUpdateUrl === "string" ? fileConfig.hotUpdateUrl : "");

    const deepLinkScheme =
      process.env.APP_DEEP_LINK_SCHEME ||
      (typeof fileConfig.deepLinkScheme === "string" && fileConfig.deepLinkScheme.trim() !== ""
        ? fileConfig.deepLinkScheme
        : "electron-starter");

    return {
      appUpdateUrl,
      hotUpdateUrl,
      deepLinkScheme,
    };
  } catch {
    return empty;
  }
}
