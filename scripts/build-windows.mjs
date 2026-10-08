import { spawnSync } from 'node:child_process'

if (process.platform !== 'win32' || process.arch !== 'x64') {
  console.error('Windows x64의 로컬 터미널에서 npm run dist:win을 실행하세요.')
  process.exit(1)
}
for (const args of [
  ['run', 'check'],
  ['run', 'build'],
  ['exec', 'electron-builder', '--', '--win', 'nsis', '--x64', '--publish', 'never'],
]) {
  const result = spawnSync('npm.cmd', args, { stdio: 'inherit', shell: true })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
