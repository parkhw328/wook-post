import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Requires librsvg's rsvg-convert. Normal app builds use the checked-in PNG/ICO.
const root = fileURLToPath(new URL('../', import.meta.url))
const render = (size) =>
  execFileSync('rsvg-convert', [
    '--width',
    String(size),
    '--height',
    String(size),
    `${root}build/icon.svg`,
  ])
writeFileSync(`${root}build/icon.png`, render(512))
const sizes = [16, 24, 32, 48, 64, 128, 256]
const frames = sizes.map(render)
const header = Buffer.alloc(6 + sizes.length * 16)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(sizes.length, 4)
let offset = header.length
frames.forEach((frame, index) => {
  const entry = 6 + index * 16
  header[entry] = header[entry + 1] = sizes[index] === 256 ? 0 : sizes[index]
  header.writeUInt16LE(1, entry + 4)
  header.writeUInt16LE(32, entry + 6)
  header.writeUInt32LE(frame.length, entry + 8)
  header.writeUInt32LE(offset, entry + 12)
  offset += frame.length
})
writeFileSync(`${root}build/icon.ico`, Buffer.concat([header, ...frames]))
console.log('Generated wPost PNG and seven ICO sizes from build/icon.svg')
