/** 运行时配置：区分开发/打包资源目录，读取应用更新源等非敏感配置。 */
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
// 配置接口明确允许加载的字段，避免意外把未知字段传给业务模块。
interface RuntimeConfig {
  appUpdateUrl: string;
  hotUpdateUrl: string;
  deepLinkScheme: string;
}
// 缺失或损坏配置文件时采用安全默认值，保证应用仍能启动。
const empty: RuntimeConfig = {
  appUpdateUrl: "",
  hotUpdateUrl: "",
  deepLinkScheme: "electron-starter",
};
/** 读取 resources/app-config.json，校验字段类型后返回规范结构。 */
export function runtimeConfig(): RuntimeConfig {
  try {
    // 打包版的 process.resourcesPath 和开发版 cwd 路径不同。
    const location = app.isPackaged
      ? path.join(process.resourcesPath, "resources", "app-config.json")
      : path.join(process.cwd(), "resources", "app-config.json");
    // 文件内容是外部输入，解析成 unknown 以强制后续类型检查。
    const values: unknown = JSON.parse(fs.readFileSync(location, "utf8"));
    if (!values || typeof values !== "object") return empty;
    // Partial 表示部分字段可能不存在，必须逐一提供默认值。
    const data = values as Partial<RuntimeConfig>;
    return {
      appUpdateUrl: typeof data.appUpdateUrl === "string" ? data.appUpdateUrl : "",
      hotUpdateUrl: typeof data.hotUpdateUrl === "string" ? data.hotUpdateUrl : "",
      deepLinkScheme: "electron-starter",
    };
    // 配置文件不存在、格式错误时不让异常阻断主进程启动。
  } catch {
    return empty;
  }
}
