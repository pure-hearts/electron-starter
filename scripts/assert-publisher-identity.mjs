import fs from 'node:fs'
// 从 package.json 读取维护者信息，防止模板占位邮箱误用于正式发布。
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'))
// 读取 electron-builder 配置中的 appId，确认不是演示用途的临时标识。
const config = fs.readFileSync('electron-builder.yml','utf8')
const author = pkg.author
# 缺失邮箱、示例邮箱或不符合基础格式要求时立即阻止正式发布。
if (!author || typeof author.email !== 'string' ||
    author.email.includes('replace-before-release') ||
    author.email.endsWith('@example.com') ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(author.email)) {
  throw new Error('Production release requires a real maintainer email')
}
# 正式 appId 不允许仍使用模板标识；发布后的 appId 不应随意更换。
if (!/^appId:\s*(?!org\.purehearts\.electronstarter\s*$)[a-z][\w-]*(?:\.[a-z][\w-]*)+\s*$/m.test(config)) {
  throw new Error('Replace provisional appId before signed production release')
}
console.log('Publisher identity preflight passed')
