import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import https from 'node:https'
import crypto from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { zipSync } from 'fflate'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-hot-e2e-'))
const appBin = path.resolve('release/linux-unpacked/electron-starter')
const appResources = path.resolve('release/linux-unpacked/resources/resources')
const userData = path.join(tmp, 'user-data')
fs.mkdirSync(userData)
const openssl = spawnSync('openssl', [
  'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
  '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost',
  '-keyout', path.join(tmp, 'tls.key'), '-out', path.join(tmp, 'tls.pem')
], { stdio: 'pipe' })
if (openssl.status !== 0) throw new Error('openssl test setup failed: ' + openssl.stderr.toString())
const signing = crypto.generateKeyPairSync('ed25519')
fs.writeFileSync(path.join(appResources, 'hot-update-public-key.pem'),
  signing.publicKey.export({ type:'spki', format:'pem' }))
const files = {}
function readResources(dir, prefix = '') {
  for (const child of fs.readdirSync(dir)) {
    const full = path.join(dir, child)
    if (fs.statSync(full).isDirectory()) readResources(full, prefix + child + '/')
    else files[prefix + child] = new Uint8Array(fs.readFileSync(full))
  }
}
readResources('dist/renderer')
let currentManifest = null
let currentZip = null
const server = https.createServer({
  key: fs.readFileSync(path.join(tmp, 'tls.key')),
  cert: fs.readFileSync(path.join(tmp, 'tls.pem'))
}, (req,res) => {
  if (req.url === '/manifest.json' && currentManifest) {
    res.writeHead(200, { 'Content-Type':'application/json' })
    res.end(JSON.stringify(currentManifest)); return
  }
  if (req.url === '/renderer.zip' && currentZip) {
    res.writeHead(200, { 'Content-Type':'application/zip' })
    res.end(currentZip); return
  }
  res.writeHead(404); res.end()
})
function runApp(mode, revision) {
  return new Promise((resolve,reject)=>{
    const child=spawn('xvfb-run', ['-a',appBin], {
      stdio:'inherit',
      env:{...process.env,
        ELECTRON_STARTER_HOT_SMOKE:mode,
        ELECTRON_STARTER_EXPECT_REVISION:String(revision),
        ELECTRON_STARTER_TEST_USERDATA:userData,
        NODE_EXTRA_CA_CERTS:path.join(tmp,'tls.pem')
      }
    })
    const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('timed out: '+mode))},30000)
    child.on('error',err=>{clearTimeout(timeout);reject(err)})
    child.on('exit',(code,signal)=>{
      clearTimeout(timeout)
      if(code===0)resolve()
      else reject(new Error('Hot smoke failed at '+mode+' code='+code+' signal='+signal))
    })
  })
}
function publishRevision(revision,port) {
  const content={...files,
    'version-test.txt':new TextEncoder().encode('rev-'+revision)}
  currentZip=zipSync(content,{level:3})
  const body={
    revision,compatibleApp:JSON.parse(fs.readFileSync('package.json','utf8')).version,
    url:'https://localhost:'+port+'/renderer.zip',
    sha256:crypto.createHash('sha256').update(currentZip).digest('hex')
  }
  currentManifest={...body,signature:crypto.sign(
    null,Buffer.from(JSON.stringify(body)),signing.privateKey).toString('base64')}
}
try {
  await new Promise(resolve=>server.listen(0,'localhost',resolve))
  const port=server.address().port
  fs.writeFileSync(path.join(appResources,'app-config.json'),JSON.stringify({
    appUpdateUrl:'',hotUpdateUrl:'https://localhost:'+port+'/manifest.json',
    deepLinkScheme:'electron-starter'
  }))
  publishRevision(1,port)
  await runApp('stage',1)
  await runApp('active',1)
  publishRevision(2,port)
  await runApp('stage',2)
  // Aborts before renderer has confirmed revision 2. Next launch must roll back to 1.
  await runApp('abort',2)
  await runApp('rollback',1)
  console.log('Signed HTTPS ZIP stage, activation, crash rollback tests passed')
} finally {
  await new Promise(resolve=>server.close(resolve))
  fs.rmSync(tmp,{recursive:true,force:true})
}
