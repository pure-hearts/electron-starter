import { describe, expect, it } from 'vite-plus/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

describe('release checksum verification', () => {
  it('accepts correct digest and rejects a modified installer', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'installer-digest-'))
    try {
      const installer = path.join(dir, 'installer.exe')
      fs.writeFileSync(installer, 'original')
      const digest = createHash('sha256').update('original').digest('hex')
      fs.writeFileSync(path.join(dir, 'SHA256SUMS.txt'), digest + '  installer.exe\n')
      const run = () => spawnSync(process.execPath, ['scripts/verify-release-checksums.mjs', dir], { encoding: 'utf8' })
      expect(run().status).toBe(0)
      fs.writeFileSync(installer, 'changed')
      expect(run().status).not.toBe(0)
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
  })
})
