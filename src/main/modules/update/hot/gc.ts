/**
 * @file gc.ts
 * @description 增量热更新版本垃圾回收纯函数策略。
 * 不依赖任何 Electron 原生 API，可在任意运行环境中进行无副作用的快速单元测试。
 */

/**
 * 纯函数：根据当前活跃目录和保留目录，过滤出需要被清理的过期历史版本目录名列表。
 *
 * @param allEntries 当前 workspace 下扫描出的所有条目名称（文件或目录名）
 * @param activeDir 当前正处于 active/trying 的生效版本目录名 (如 "rev-3")
 * @param previousDir 供故障回滚备用的上一版本目录名 (如 "rev-2")
 * @returns 判定为过期、应当被安全清理的目录名称列表
 */
export function filterStaleRevisions(
  allEntries: string[],
  activeDir?: string | null,
  previousDir?: string | null,
): string[] {
  const protectedNames = new Set<string>();
  if (activeDir) protectedNames.add(activeDir);
  if (previousDir) protectedNames.add(previousDir);
  // current.json 与临时写入指针文件必须无条件受保护
  protectedNames.add("current.json");
  protectedNames.add("current.json.tmp");

  return allEntries.filter((name) => {
    // 仅针对格式为 rev-* 的版本目录进行识别与清理
    if (!name.startsWith("rev-")) return false;
    return !protectedNames.has(name);
  });
}
