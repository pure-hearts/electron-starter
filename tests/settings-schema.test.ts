import { describe, it, expect } from 'vite-plus/test'
import { migrateSettings, settingsNeedMigration, normalizeWindowBounds } from '../src/main/modules/settings-schema'

describe('persistent settings migration', () => {
  it('fills defaults for outdated, incomplete settings', () => {
    expect(migrateSettings({ theme:'dark', locale:'en-US' })).toEqual({
      schemaVersion: 1, theme:'dark', locale:'en-US', closeToTray:true, windowBounds:''
    })
  })
  it('replaces invalid and corrupted legacy settings', () => {
    expect(migrateSettings({ theme:'neon', locale:99, closeToTray:'true', windowBounds:'{bad' }))
      .toEqual({ schemaVersion:1, theme:'light', locale:'zh-CN', closeToTray:true, windowBounds:'' })
    expect(migrateSettings(null).schemaVersion).toBe(1)
  })
  it('accepts only finite, visible-size window bounds', () => {
    const bounds=JSON.stringify({x:20,y:30,width:1000,height:750})
    expect(normalizeWindowBounds(bounds)).toBe(bounds)
    expect(normalizeWindowBounds(JSON.stringify({x:0,y:0,width:-20,height:600}))).toBe('')
    expect(normalizeWindowBounds(JSON.stringify({x:0,y:0,width:Infinity,height:800}))).toBe('')
  })
  it('does not rewrite normalized settings on each startup', () => {
    const current=migrateSettings({ theme:'system', locale:'en-US', closeToTray:false })
    expect(settingsNeedMigration(current)).toBe(false)
    expect(settingsNeedMigration({ ...current, schemaVersion:0 })).toBe(true)
  })
})
