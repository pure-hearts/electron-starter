/** 磁盘恢复记录同样是不可信输入；纯策略可在无 Electron 环境验证。 */
export type HotPointer = {
  revision: number; directory: string; previous: string | null
  compatibleApp: string; phase: 'staged' | 'trying' | 'active'
}
export function parseHotPointer(value: unknown, appVersion: string): HotPointer | null {
  if (!value || typeof value !== 'object') return null
  const p = value as Record<string, unknown>
  if (!Number.isSafeInteger(p.revision) || (p.revision as number) < 0 ||
      p.directory !== `rev-${String(p.revision)}` || p.compatibleApp !== appVersion ||
      !['staged', 'trying', 'active'].includes(String(p.phase)) ||
      (p.previous !== null && (typeof p.previous !== 'string' || !/^rev-\d+$/.test(p.previous)))) return null
  return { revision: p.revision as number, directory: p.directory as string, previous: p.previous as string | null,
    compatibleApp: appVersion, phase: p.phase as HotPointer['phase'] }
}
