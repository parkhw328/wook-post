import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const repo = 'parkhw328/wook-post'
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Publish a stable release version.')
const tag = `v${version}`
const filename = 'wPost-x64-Setup.exe'
const installer = join(root, 'release', version, `wPost-${version}-x64-Setup.exe`)
const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const checksum = hash(installer)
if (readFileSync(`${installer}.sha256`, 'utf8').split(/\s+/)[0] !== checksum) {
  throw new Error('Local installer checksum mismatch. Rebuild before publishing.')
}
const gh = (...args) =>
  execFileSync('gh', [...args, '--repo', repo], { cwd: root, encoding: 'utf8' }).trim()
const releases = JSON.parse(
  gh('release', 'list', '--limit', '1000', '--json', 'tagName,isDraft,isPrerelease'),
)
const compare = (a, b) => {
  const left = a.replace(/^v/, '').split('.').map(Number)
  const right = b.replace(/^v/, '').split('.').map(Number)
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2]
}
const stable = releases.filter(
  (release) =>
    !release.isDraft && !release.isPrerelease && /^v\d+\.\d+\.\d+$/.test(release.tagName),
)
if (stable.some((release) => compare(release.tagName, tag) > 0)) {
  throw new Error('A newer release exists. Refusing to replace it with an older version.')
}
const current = releases.find((release) => release.tagName === tag)
const previous = stable.filter((release) => release.tagName !== tag)
if (process.argv.includes('--dry-run')) {
  console.log(
    JSON.stringify({ repo, tag, installer, checksum, removeAfterVerification: previous }, null, 2),
  )
  process.exit(0)
}

const tempRoot = resolve(tmpdir())
const staging = mkdtempSync(join(tempRoot, 'wpost-release-'))
if (dirname(resolve(staging)) !== tempRoot) throw new Error('Unexpected release staging path.')
try {
  const upload = join(staging, filename)
  const checksumFile = `${upload}.sha256`
  const notes = join(staging, 'notes.md')
  copyFileSync(installer, upload)
  writeFileSync(checksumFile, `${checksum}  ${filename}\n`)
  writeFileSync(
    notes,
    `# wPost ${version}\n\nWindows x64 설치 파일입니다.\n\n` +
      `- [변경 이력](https://github.com/${repo}/blob/${tag}/CHANGELOG.md)\n` +
      `- SHA-256: \`${checksum}\`\n\n` +
      '설치 파일과 체크섬을 아래 Assets에서 다운로드하세요.\n',
  )
  if (!current) {
    gh(
      'release',
      'create',
      tag,
      '--verify-tag',
      '--draft',
      '--title',
      `wPost ${version}`,
      '--notes-file',
      notes,
    )
  }
  if (!current || current.isDraft) {
    gh('release', 'upload', tag, upload, checksumFile, '--clobber')
  }

  // Verify the uploaded binary before publication or removing any previous release.
  const verification = join(staging, 'verify')
  mkdirSync(verification)
  gh(
    'release',
    'download',
    tag,
    '--pattern',
    filename,
    '--pattern',
    `${filename}.sha256`,
    '--dir',
    verification,
  )
  if (
    hash(join(verification, filename)) !== checksum ||
    readFileSync(join(verification, `${filename}.sha256`), 'utf8') !==
      readFileSync(checksumFile, 'utf8')
  ) {
    throw new Error(
      'Remote assets do not match this build. Keep the existing release and publish a new version.',
    )
  }
  gh('release', 'edit', tag, '--draft=false', '--latest')
  const latest = JSON.parse(
    execFileSync('gh', ['api', `repos/${repo}/releases/latest`], { encoding: 'utf8' }),
  )
  if (latest.tag_name !== tag)
    throw new Error('Latest release verification failed; older releases were preserved.')
  for (const release of previous) {
    gh('release', 'delete', release.tagName, '--yes')
  }
  console.log(`Published https://github.com/${repo}/releases/latest`)
  console.log(`Download: https://github.com/${repo}/releases/latest/download/${filename}`)
} finally {
  rmSync(staging, { recursive: true, force: true })
}
