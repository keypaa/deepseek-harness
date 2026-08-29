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
  'packages/client/**/*.{ts,tsx}',
]
const files = patterns.flatMap(p => globSync(p, { cwd: root }))
  .map(p => p.split(sep).join('/'))
  .filter(p => !p.includes('locale') && !p.includes('/tests/') && !p.includes('/lib/') && !p.endsWith('.zh.md') && !p.endsWith('.i18n.yaml'))
  .sort()

const CJK = /[\u4e00-\u9fff]/
const ESCAPED_CJK = /\\u([0-9a-fA-F]{4})/g
const violations: string[] = []

for (const rel of files) {
  // Fixture data is intentional Chinese user content for snapshot fixtures, not product copy.
  if (rel === 'packages/client/connection/src/client/fixture.ts') continue
  // Dictionary registrations co-located with their plugin (not under locales/): the
  // file defines both zh and en dicts inline, so its Chinese is the dictionary itself.
  if (
    rel === 'packages/client/ui-directory-picker-browse/src/client/index.ts'
    || rel === 'packages/client/ui-settings-models/src/onboarding-copy.ts'
  ) continue
  const text = readFileSync(resolve(root, rel), 'utf8')
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (line === undefined) continue
    // Intentional self-name for the locale selector; not product copy.
    if (rel === 'packages/client/locale/src/client/index.ts' && line.includes("label: '中文'")) continue
    // Fixture history doc-comment describes the 已停止 marker; not product copy.
    if (rel === 'packages/client/runtime/src/client/sessions/conversation.ts' && (line.includes('已停止') || line.includes('发送失败'))) continue
    if (rel === 'packages/client/ui-conversation/src/client/contract/records.ts' && line.includes('已停止')) continue
    if (rel === 'packages/client/ui-conversation/src/client/skeleton/ContextMeter.tsx' && line.includes('上下文已用')) continue
    // Stripping "(recommended)" suffixes in both locales; the regex must match both.
    if (rel === 'packages/client/ui-user-questions/src/client/QuestionComposer.tsx' && line.includes('推荐')) continue
    // JSDoc examples describing zh rendering, not product copy.
    if (rel === 'packages/client/ui-primitives/src/SearchBlock.tsx' && (line.includes('显示') || line.includes('处匹配') || line.includes('个路径'))) continue
    if (rel === 'packages/client/ui-settings-models/src/client/ProviderEditor.tsx' && line.includes('自定义设置')) continue
    if (rel === 'packages/client/ui-workspace/src/client/rows/Rows.tsx' && line.includes('刚刚')) continue
    if (CJK.test(line)) {
      violations.push(`${rel}:${i + 1}:${line.trim()}`)
      continue
    }
    let match: RegExpExecArray | null
    ESCAPED_CJK.lastIndex = 0
    while ((match = ESCAPED_CJK.exec(line)) !== null) {
      const hex = match[1]
      if (hex === undefined) continue
      const code = Number.parseInt(hex, 16)
      if (code >= 0x4e00 && code <= 0x9fff) {
        violations.push(`${rel}:${i + 1}:${line.trim()} (escaped \\u${hex})`)
        break
      }
    }
  }
}

if (violations.length > 0) {
  console.error('verify-no-hardcoded-cjk: hardcoded CJK found outside locales:')
  for (const v of violations) console.error(`  ${v}`)
  process.exit(1)
}

console.log('verify-no-hardcoded-cjk: no hardcoded CJK outside locales.')
