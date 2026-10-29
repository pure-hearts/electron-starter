/**
 * @file pointer.ts
 * @description 热更新运行时指针：记录当前生效版本、备份目录、兼容大版本与状态机阶段。
 *
 * 状态机阶段 (phase):
 * - staged: 新资源已下载并解压完毕，待应用重启后生效；
 * - trying: 重启后主窗口正在加载试跑，尚未收到健康确认；
 * - active: 主窗口完成健康确认 (hot:confirm)，版本正式生效稳定。
 */

export interface HotPointer {
  /** 时间戳数字版本号主序 */
  revision: number;
  /** 完整版本标签，格式：时间戳_GitHash (如 20261029173000_be18d80) */
  versionTag?: string;
  /** Git 提交短 Hash */
  commit?: string;
  /** 磁盘目录名，格式：rev-[revision] */
  directory: string;
  /** 上一个稳定版本目录名，用于启动失败时自动回滚 */
  previous: string | null;
  /** 兼容的 Electron 基础主程序大版本 */
  compatibleApp: string;
  /** 当前状态机阶段 */
  phase: "staged" | "trying" | "active";
}

/**
 * 解析并校验从磁盘 current.json 读取的指针数据。
 * 若主程序版本不匹配 (compatibleApp !== appVersion) 或结构损坏，返回 null 触发重置。
 */
export function parseHotPointer(value: unknown, appVersion: string): HotPointer | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;

  // 1. 基础字段类型与数值安全校验
  if (
    !Number.isSafeInteger(p.revision) ||
    (p.revision as number) < 0 ||
    p.directory !== `rev-${String(p.revision)}` ||
    p.compatibleApp !== appVersion ||
    !["staged", "trying", "active"].includes(String(p.phase)) ||
    (p.previous !== null && (typeof p.previous !== "string" || !/^rev-\d+$/.test(p.previous)))
  ) {
    return null;
  }

  // 2. 提取可选的版本标签与 Git Hash
  const versionTag = typeof p.versionTag === "string" ? p.versionTag : undefined;
  const commit = typeof p.commit === "string" ? p.commit : undefined;

  return {
    revision: p.revision as number,
    versionTag,
    commit,
    directory: p.directory as string,
    previous: p.previous as string | null,
    compatibleApp: appVersion,
    phase: p.phase as HotPointer["phase"],
  };
}
