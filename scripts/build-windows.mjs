import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

if (process.platform !== 'win32' || process.arch !== 'x64') {
  console.error('Windows x64의 로컬 터미널에서 npm run dist:win을 실행하세요.')
  process.exit(1)
}
for (const args of [
  ['run', 'check'],
  ['run', 'build'],
  ['exec', 'electron-builder', '--', '--win', 'nsis', '--x64', '--publish', 'never'],
]) {
  const result = spawnSync('npm.cmd', args, { cwd: root, stdio: 'inherit', shell: true })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const filename = `wPost-${version}-x64-Setup.exe`
const installer = new URL(`../release/${version}/${filename}`, import.meta.url)
const checksum = createHash('sha256').update(readFileSync(installer)).digest('hex')
writeFileSync(new URL(`${installer.href}.sha256`), `${checksum}  ${filename}\n`)
console.log(`Release saved: release/${version}/${filename} (+ SHA-256)`)
