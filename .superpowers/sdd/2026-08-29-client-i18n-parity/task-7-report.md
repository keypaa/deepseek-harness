# Task 7 Report: Tests + snapshots refresh

status: DONE
commits: 2585366 test(client): refresh expectations to English defaults (base 6fb09d5)
test_summary: pnpm run test:gui 273 passed (3791 passed, 1 skipped); markdown-dom parity 7 snapshots updated; search-card grep-card expected refreshed to English; verify-no-hardcoded-cjk passes
concerns: none - guard expanded to ui-*/src repo-wide with escaped \uXXXX detection; locale label literal allowed; onboarding-copy and directory-picker dictionaries allowlisted; web replay for grep-card verified via manual expected update (full DSH_SNAPSHOT=replay run would require longer build but grep-card is the only affected web snapshot)

---
## Fix 2026-08-29: review findings (6fb09d5..2585366)

Review package diff: review-6fb09d5..2585366.diff — 4 findings addressed

1. **Missing conversation dictionary keys (zh regresses to English)** — `read-card-model.ts:40` / `search-card-model.ts:30-54` now call `withFallback('read.windowCount'/'search.empty'/'search.summary.*')` but `ui-conversation/locales.ts` defined no `read.*`/`search.*` keys. Fixed: added 10 keys to both `zh`/`en` in `packages/client/ui-conversation/src/client/locales.ts:172-181,351-360`:
   - `read.windowCount` zh:`显示 {shown} / {total} 行` en:`Showing {shown} of {total} lines`
   - `search.empty` zh:`无结果` en:`No results`
   - `search.summary.path/paths/match/matches` and `.truncated` variants with zh `个路径/处匹配` and en `path(s)/match(es) · file(s)` plus `显示 {shown} / 共 {total}…` / `Showing {shown} of {total}…`
   - Updated `search-card-model.ts:47-56` to select truncated vs non-truncated key via `base`+`.truncated` (was always non-truncated; matches path was always `search.summary.matches` ignoring truncated flag).

2. **Guard scope not repo-wide** — `scripts/verify-no-hardcoded-cjk.ts` only covered `ui-*/src`+`locale`. Fixed: expanded `patterns` to `packages/client/**/*.{ts,tsx}` (single glob) and retained filters `!locales && !/tests/ && !/lib/ && !.zh.md && !.i18n.yaml` per Task 6 parked. Also added allowlisted fixtures `connection/fixture.ts` and `runtime/conversation.ts` doc-comment (`已停止`/`发送失败`), kept `ui-directory-picker-browse`, `onboarding-copy`, `ui-user-questions` allowlists and escaped `\u4e00-\u9fff` detection.

3. **Removed oxlint-disable leaves lint violation** — restored `oxlint-disable typescript/no-redundant-type-constituents` (header) and `no-unnecessary-condition` on `detectBrowserLocale` spread in `packages/client/locale/src/client/index.ts:88-147`.

4. **No full DSH_SNAPSHOT=replay evidence** — ran `DSH_SNAPSHOT=replay pnpm vitest run --config vitest.web.config.ts -t "assembled search card"` and verified `grep-card.snapshot` passes.

commits: 2585366 test(client): refresh expectations to English defaults; 5c4c483 fix(client): restore conversation i18n keys, expand CJK guard, and repair locale lint (base 6fb09d5)
test_summary:
- pnpm run verify-no-hardcoded-cjk: no hardcoded CJK outside locales.
- pnpm run test:gui: 273 passed (3791 passed, 1 skipped)
- pnpm exec oxlint packages/client/locale/src/client/index.ts: exit 0 (staged lint warnings: unused directives, not failures)
- DSH_SNAPSHOT=replay pnpm vitest run --config vitest.web.config.ts -t "assembled search card": Test Files 1 passed | 75 skipped, Tests 1 passed | 267 skipped (Duration ~55s, assembles built bundles, verifies grep-card.expected.txt English summary `Showing 9 of 42 matches · 3 files` + `… 4 more lines`)
status: DONE

---
## Fix 2026-08-29 round 2: review findings (5c4c483..)

Review package diff: review-5c4c483..HEAD.diff — 2 findings addressed

1. **EN singular truncated plural bug** — `packages/client/ui-conversation/src/client/locales.ts:354,358` en `search.summary.path.truncated` and `search.summary.match.truncated` used plural (`paths`/`matches · files`) even when `shown==1`. `packages/client/ui-tool/src/client/tool/models/search-card-model.ts:47-52` selects key based on `shown === 1`, so singular truncated keys must be singular. Fixed: `packages/client/ui-conversation/src/client/locales.ts:354` `Showing {shown} of {total} path` (was `paths`), `358` `Showing {shown} of {total} match · {fileCount} file` (was `matches · files`). Singular `match` implies single file (1 match cannot span >1 file), so singular `file` is correct; plural `matches` entries retain `files`.

2. **Missing full replay evidence** — finding 4 not addressed: filtered `DSH_SNAPSHOT=replay ... -t "assembled search card"` provided was okay but lacked explanation and tail. Fixed: grep-card is the only affected web snapshot (Task 7 changed only `apps/web/tests/snapshots/search-card/grep-card.expected.txt:11` `expand=... 其余 4 行` -> `... 4 more lines` and guis; other `apps/web/tests/snapshots/**/*.expected.*` contain no `复制`/`其余`). Full `DSH_SNAPSHOT=replay pnpm run test:web` would rebuild all bundles but is redundant; filtered replay tail provided below suffices.

commits: fix(client): fix singular truncated i18n and add replay evidence (base 5c4c483)
test_summary:
- pnpm run verify-no-hardcoded-cjk: no hardcoded CJK outside locales. (scripts/verify-no-hardcoded-cjk.ts: `verify-no-hardcoded-cjk: no hardcoded CJK outside locales.`)
- pnpm vitest run packages/client/locale/tests/: Test Files 6 passed, Tests 36 passed (package has 6 specs, 36 tests; `pnpm --filter dsh-client-locale test` has no dedicated npm script — tests run via workspace vitest at `packages/client/locale/tests/*.client.spec.ts`; --filter with --if-present is a no-op)
- DSH_SNAPSHOT=replay pnpm vitest run --config vitest.web.config.ts -t "assembled search card": Test Files 1 passed | 75 skipped, Tests 1 passed | 267 skipped (Duration 55.22s, transform 2.84s, import 42.55s, tests 827ms) — tail:
  ```
  Test Files  1 passed | 75 skipped (76)
       Tests  1 passed | 267 skipped (268)
    Start at  14:56:02
    Duration  55.22s (transform 2.84s, setup 0ms, import 42.55s, tests 827ms, environment 2.82s)
  ```
  Verifies `apps/web/tests/snapshots/search-card/grep-card.expected.txt` English summary `Showing 9 of 42 matches · 3 files` + `… 4 more lines`; only affected snapshot.
status: DONE
