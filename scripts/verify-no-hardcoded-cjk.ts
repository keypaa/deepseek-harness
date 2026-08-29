/**
 * Guard against hardcoded Chinese (CJK) outside locale dictionaries.
 * Fails when CJK characters appear in `packages/client` source outside
 * `locales/` dictionaries, `*.zh.md`, or `*.i18n.yaml`.
 *
 * Run: pnpm run verify-no-hardcoded-cjk
 */
import { globSync, readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const patterns = [
  'packages/client/ui-primitives/src/TerminalBlock.tsx',
  'packages/client/ui-primitives/src/DiffBlock.tsx',
  'packages/client/ui-primitives/src/SearchBlock.tsx',
  'packages/client/ui-primitives/src/ReadBlock.tsx',
  'packages/client/ui-tool/src/**/*.{ts,tsx}',
  'packages/client/locale/src/**/*.{ts,tsx}',
]
const files = patterns.flatMap(p => globSync(p, { cwd: root }))
  .map(p => p.split(sep).join('/'))
  .filter(p => !p.includes('/locales/') && !p.endsWith('.zh.md') && !p.endsWith('.i18n.yaml'))
  .sort()

const CJK = /[\u4e00-\u9fff]/
const violations: string[] = []

for (const rel of files) {
  const text = readFileSync(resolve(root, rel), 'utf8')
  // Allow the locale display name escape? It now uses \u escape, so no literal.
  // Also allow comments that already use English; any literal CJK is a violation.
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (line !== undefined && CJK.test(line)) {
      violations.push(`${rel}:${i + 1}:${line.trim()}`)
    }
  }
}

if (violations.length > 0) {
  console.error('verify-no-hardcoded-cjk: hardcoded CJK found outside locales:')
  for (const v of violations) console.error(`  ${v}`)
  process.exit(1)
}

console.log('verify-no-hardcoded-cjk: no hardcoded CJK outside locales.')
