import { describe, expect, it } from 'vite-plus/test'
import { parseHotPointer } from '../src/main/modules/update/hot/pointer'
const valid = { revision: 2, directory: 'rev-2', previous: 'rev-1', compatibleApp: '1.0.0', phase: 'staged' }
describe('热更新恢复指针', () => {
  it('只接受匹配应用版本及合法阶段的指针', () => {
    expect(parseHotPointer(valid, '1.0.0')).toEqual(valid)
    for (const input of [null, {}, { ...valid, phase: 'unknown' }, { ...valid, previous: '../private' },
      { ...valid, directory: 'rev-3' }, { ...valid, revision: -1 }, { ...valid, previous: 123 },
      { ...valid, compatibleApp: '2.0.0' }]) expect(parseHotPointer(input, '1.0.0')).toBeNull()
  })
})
