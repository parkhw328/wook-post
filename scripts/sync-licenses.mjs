import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
// These packages are shipped as renderer code, a main-process dependency,
// or the Electron runtime. Build-only tools retain their own package notices.
const packages = ['react', 'react-dom', 'scheduler', 'lucide-react', 'zod', 'electron']
const notices = packages.map((name) => {
  const directory = join(root, 'node_modules', name)
  const pkg = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
  const license = readFileSync(join(directory, 'LICENSE'), 'utf8')
  return `${name} ${pkg.version}\nPackage: https://www.npmjs.com/package/${name}/v/${pkg.version}\n\n${license}`
})
mkdirSync(join(root, 'licenses'), { recursive: true })
writeFileSync(
  join(root, 'licenses', 'Software-LICENSES.txt'),
  'Third-party software licenses\nGenerated from installed packages by npm run licenses:sync.\n' +
    'Electron/Chromium component notices are also shipped as LICENSES.chromium.html beside the executable.\n\n' +
    notices.join('\n\n' + '='.repeat(80) + '\n\n'),
)
console.log(`Preserved original license texts for ${packages.join(', ')}.`)
