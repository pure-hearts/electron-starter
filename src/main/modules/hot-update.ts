/** 热更新协调器：下载仅包含 Renderer 的签名 ZIP，校验后切换资源目录；Main/Preload 不参与热更新。 */
/**
 * Signed renderer-only resource updates.
 * Private signing key NEVER ships with the application.
 * A hot update cannot modify Main, Preload or installed Electron resources.
 */
import { app } from 'electron'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { HotUpdateResult } from '../../shared/ipc'
import { runtimeConfig } from './config'
import { broadcast } from '../window'
import { log } from './logger'
import { verifyHotManifest } from './hot-manifest'
import { extractSafe } from './hot-archive'
import { singleFlight } from './single-flight'
import { parseHotPointer, type HotPointer as Pointer } from './hot-pointer'
import { validateUpdateFeedUrl } from './update-feed-url'
import { notifyBusiness } from './notification'
const here = path.dirname(fileURLToPath(import.meta.url))
// 一个生命周期对应一个取消信号；退出后中止网络请求，避免继续写入更新指针。
let lifetime = new AbortController()
export function disposeHotUpdate(): void { lifetime.abort() }
export function initHotUpdate(): void { if (lifetime.signal.aborted) lifetime = new AbortController() }
const MAX_ZIP = 32 * 1024 * 1024
function workspace() { return path.join(app.getPath('userData'), 'renderer-updates') }
function pointerPath() { return path.join(workspace(), 'current.json') }
function installedRoot() { return path.resolve(here, '../dist/renderer') }
function readPointer(): Pointer | null {
  try {
    return parseHotPointer(JSON.parse(fs.readFileSync(pointerPath(), 'utf8')) as unknown, app.getVersion())
  } catch { return null }
}
function writePointer(pointer: Pointer) {
  fs.mkdirSync(workspace(), { recursive: true })
  const temp = pointerPath() + '.tmp'
  fs.writeFileSync(temp, JSON.stringify(pointer))
  fs.renameSync(temp, pointerPath())
}
function candidate(name: string) {
  const root = path.resolve(workspace(), name)
  return name && /^[a-z0-9-]+$/i.test(name) && fs.existsSync(path.join(root, 'index.html')) ? root : null
}
/** Pending update from previous launch is reverted before any application UI loads. */
/** 启动时检查上次更新是否未完成，必要时回退至上一份可用资源。 */
export function recoverPendingUpdate() {
  const pointer = readPointer()
  if (pointer?.phase === 'staged') {
    writePointer({ ...pointer, phase: 'trying' })
  } else if (pointer?.phase === 'trying') {
    log.warn('Rolling back unconfirmed renderer update', pointer.revision)
    if (pointer.previous) writePointer({ revision: Number(pointer.previous.replace(/^rev-/, '')) || 0, directory: pointer.previous, previous: null, compatibleApp: app.getVersion(), phase: 'active' })
    else fs.rmSync(pointerPath(), { force: true })
  }
}
/** 由主窗口确认新资源正常运行，完成从待验证到稳定版本的状态迁移。 */
export function markRendererHealthy() {
  const p = readPointer()
  if (p?.phase === 'trying') writePointer({ ...p, phase: 'active' })
}
/** 根据当前持久化指针返回实际生效的 Renderer 资源目录。 */
export function activeRendererRoot(): string {
  const pointer = readPointer()
  if (pointer?.phase === 'staged') return (pointer.previous && candidate(pointer.previous)) || installedRoot()
  if (pointer) return candidate(pointer.directory) ?? installedRoot()
  return installedRoot()
}
function signingKey(): string | null {
  const location = app.isPackaged
    ? path.join(process.resourcesPath, 'resources', 'hot-update-public-key.pem')
    : path.join(process.cwd(), 'resources', 'hot-update-public-key.pem')
  try { return fs.readFileSync(location, 'utf8') } catch { return null }
}
async function readLimited(url: string, max: number, signal: AbortSignal): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]), redirect: 'error' })
  if (!response.ok || !response.body) throw new Error('Download failed: HTTP ' + response.status)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > max) throw new Error('Update size limit exceeded')
      chunks.push(value)
    }
  } finally { await reader.cancel().catch(() => undefined) }
  return Buffer.concat(chunks)
}
// singleFlight 合并同时发生的热更新请求，避免重复安装/覆盖相同资源。
export const checkHotUpdate = singleFlight(async (): Promise<HotUpdateResult> => {
  const config = runtimeConfig()
  const key = signingKey()
  if (!app.isPackaged || !key || !config.hotUpdateUrl) return { status: 'disabled', message: 'Configure HTTPS update URL and release public key first' }
  const signal = lifetime.signal
  try {
    signal.throwIfAborted()
    validateUpdateFeedUrl(config.hotUpdateUrl)
    const url = new URL(config.hotUpdateUrl)
    broadcast('update:state', {kind:'hot',status:'checking'})
    const raw = await readLimited(url.toString(), 16_384, signal)
    const m = verifyHotManifest(JSON.parse(raw.toString('utf8')) as unknown, app.getVersion(), key)
    const current = readPointer()
    if (current?.phase === 'staged' || current?.phase === 'trying') return { status: 'ready', message: 'Restart app before checking another hot update' }
    if (m.revision <= (current?.revision ?? 0)) return { status: 'up-to-date' }
    broadcast('update:state', {kind:'hot',status:'downloading'})
    const bytes = await readLimited(m.url, MAX_ZIP, signal)
    signal.throwIfAborted()
    if (createHash('sha256').update(bytes).digest('hex') !== m.sha256) throw new Error('SHA-256 mismatch')
    const name = 'rev-' + m.revision
    const temp = path.join(workspace(), name + '-tmp')
    const target = path.join(workspace(), name)
    fs.mkdirSync(workspace(), { recursive: true })
    fs.rmSync(temp, { recursive: true, force: true })
    fs.mkdirSync(temp)
    try {
      extractSafe(bytes, temp)
      if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true })
      fs.renameSync(temp, target)
    } catch(err) { fs.rmSync(temp, { recursive: true, force: true }); throw err }
    writePointer({ revision: m.revision, directory: name, previous: current?.directory ?? null, compatibleApp: app.getVersion(), phase: 'staged' })
    broadcast('update:state', {kind:'hot',status:'ready'})
    notifyBusiness({ title: '资源更新已就绪', body: '重启应用后将启用新资源。', kind: 'success', dedupeKey: 'hot-update-ready' })
    return { status: 'ready', message: 'Resource update is staged; restart app to activate' }
  } catch (error) {
    log.error('Hot update failed', error)
    broadcast('update:state', {kind:'hot',status:'error',error:'资源更新失败，请稍后重试。'})
    return { status: 'error', message: '资源更新失败，请稍后重试。' }
  }
})
