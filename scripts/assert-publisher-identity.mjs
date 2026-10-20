import fs from 'node:fs'
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'))
const config = fs.readFileSync('electron-builder.yml','utf8')
const author = pkg.author
if (!author || typeof author.email !== 'string' ||
    author.email.includes('replace-before-release') ||
    author.email.endsWith('@example.com') ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(author.email)) {
  throw new Error('Production release requires a real maintainer email')
}
if (!/^appId:\s*(?!org\.purehearts\.electronstarter\s*$)[a-z][\w-]*(?:\.[a-z][\w-]*)+\s*$/m.test(config)) {
  throw new Error('Replace provisional appId before signed production release')
}
console.log('Publisher identity preflight passed')
