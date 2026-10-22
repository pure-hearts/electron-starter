import { describe, expect, it } from 'vite-plus/test'
import { safeWindowBounds } from '../src/main/modules/window-bounds-policy'
describe('跨平台窗口边界规则', () => {
  const displays = [{ x: 0, y: 0, width: 1920, height: 1080 }]
  it('可恢复合法窗口', () => {
    expect(safeWindowBounds({ x: 20, y: 20, width: 900, height: 650 }, displays)).toEqual({ x: 20, y: 20, width: 900, height: 650 })
  })
  it('拒绝离屏、NaN 和极端尺寸', () => {
    for (const r of [{ x: 9000, y: 9000, width: 900, height: 650 }, { x: NaN, y: 0, width: 900, height: 650 }, { x: 0, y: 0, width: 10, height: 10 }])
      expect(safeWindowBounds(r, displays)).toBeNull()
  })
})

it('纠正部分离屏窗口，使标题栏和操作区域可见', () => {
  expect(safeWindowBounds({ x: -850, y: -600, width: 900, height: 650 }, [{ x: 0, y: 0, width: 1920, height: 1080 }]))
    .toEqual({ x: 0, y: 0, width: 900, height: 650 })
})
