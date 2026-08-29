# Agent Note: Client i18n parity — tool card primitives locale-aware with English fallback and CJK guard

Status: implemented

English | [中文](2026-08-29-client-i18n-parity.zh.md)

## Problem

`packages/client/ui-primitives` rendered four tool cards — `TerminalBlock`, `DiffBlock`, `ReadBlock`, and `SearchBlock` — with hardcoded Chinese copy (`复制`, `收起`, `… 其余 N 行`, `显示 X / 共 N …`, `无结果`, `└ +A -R · N file(s)` remained English but the surrounding chrome was Chinese). Only `TerminalBlock` exposed a `labels` prop for localization; the other three kept literal strings inside the primitive, so a caller could not supply locale-driven copy and the block could not follow the application's language. The locale service (`packages/client/locale`) defaulted to `FALLBACK_LOCALE='zh'` and its lookup fell back to the `zh` dictionary after the active locale missed, so a fresh `en` install still resolved missing keys to Chinese. No automated check prevented new hardcoded CJK from entering `packages/client` outside `locales/` dictionaries, so the stranded strings had no regression barrier.

## Decision

- **All four cards mirror the `TerminalBlockLabels` pattern.** `DiffBlock`, `SearchBlock`, and `ReadBlock` each expose a `*BlockLabels` interface (`copy`/`copied`/`collapse`/`collapseAria`/`expand`/`expandAria` plus `footer` for diffs, `summary`/`empty` for search, `windowCount` for reads), a `DEFAULT_*_LABELS` constant defaulting to English (`Copy`/`Copied`/`Collapse`/`... N more lines`/`Showing N of M lines`/`+A -R · N file(s)`), and an optional `labels?: Partial<*BlockLabels>` prop merged as `{...DEFAULT, ...labels}`. Every hardcoded literal (`复制`/`复制成功`/`收起`/`… 其余 N 行`/`显示 …`/`无结果`) is replaced by the resolved label. The primitives stay cordis-free — they take labels via props, not `ctx.locale` — exactly like `TerminalBlock` before them, whose defaults are also flipped from Chinese to English (`signal`/`exit code`/`Running`/`Failed`/`Done`/`Copy`/`No output`/`Collapse`/`... N more lines`). Snapshots (`apps/web/tests/snapshots/search-card/grep-card.expected.txt` and markdown/terminal/web fixtures) and component specs now assert English copy.

- **Fallback is `en`, not `zh`.** `packages/client/locale/src/client/index.ts` sets `FALLBACK_LOCALE='en'` and `lookup()` tries `active` then `en`. `detectBrowserLocale()` still recognizes `zh-*` but defaults to `en` when the browser asks for no shipped language; `resolveInitialLocale()` returns `en` outside the browser. The `en` dictionary is therefore the second chance for every namespace, and an `en`-active lookup that misses both dictionaries returns the key itself — it never resolves to Chinese. `packages/client/ui-conversation/src/client/locales.ts` and `packages/client/locale/src/locales/` carry the English strings for the new keys (`terminal.expandRest`, `terminal.expandAria`, `read.windowCount`, `search.empty`, `search.summary.*`).

- **Owners thread dictionaries at the render sites.** `packages/client/ui-tool/src/client/tool/models/{diff,read,search}-card-model.ts` each export a helper (`diffBlockLabels(t)`, `readBlockLabels(t)`, `searchBlockLabels(t)`) that builds the full label set from the `conversation` (and `common` fallback) locale seat `t: TranslateNS<'conversation'>`. `TerminalBlock` already had `terminalBlockLabels(t)`. `ToolRow` and `ToolDetails` call the helper at render time (`<DiffBlock labels={diffBlockLabels(t)}>` etc.), so both the chat row and the details panel follow locale switches without the primitive ever importing a locale service. Helpers use a `withFallback` shim for keys that may be absent in an older `en` dictionary and fall back to an English literal rather than surfacing the key.

- **A hygiene guard prevents regression.** `scripts/verify-no-hardcoded-cjk.ts` scans `packages/client/**/*.{ts,tsx}` outside `locales/`, `*.zh.md`, `*.i18n.yaml`, `tests/`, and `lib/`, checking both literal CJK (`[\u4e00-\u9fff]`) and escaped `\uXXXX` in the CJK range. Allowlisted fixtures (`connection/fixture.ts`, `runtime/sessions/conversation.ts` doc-comment, the locale selector's `label: '中文'`, a `(recommended)` regex, and the co-located `ui-directory-picker-browse`/`ui-settings-models/onboarding-copy` dictionaries) are the only exceptions. The script is enrolled in `scripts/run-gates.ts` under both `hygieneLeafGates` (`pnpm run verify-no-hardcoded-cjk`) and the `doc-sync` tree through `hygiene`, so a new hardcoded Chinese string fails CI.

## Alternatives considered

- **Make `ui-primitives` read `ctx.locale` directly.** Rejected: the package is intentionally zero-cordis so it can be used outside a cordis fiber and stays bundle-pure. Adding a locale dependency would couple the atom to the application runtime, require a provider in every test, and duplicate the framework's `t` seat that already exists at the owning `ui-tool`/`ui-conversation` render sites. Props keep the primitive testable with plain English literals and let the owner drive the language.

- **Keep `FALLBACK_LOCALE='zh'` and rely on complete `en` dictionaries.** Rejected: any new key added to `zh` before its `en` counterpart ships would still resolve to Chinese for `en` users during the gap, and the fallback would silently hide the missing translation. Flipping the fallback to `en` makes a missing translation visible as English or as the key itself, which matches the English-default card copy and surfaces the gap rather than masking it with another language.

- **Guard only `packages/client/src` literal strings via `rg` without allowlists or escaped-unicode checks.** Rejected: the `rg` one-liner missed escaped `\u4e2d` literals, counted `locales/` dictionaries as violations, and flagged fixture data that is intentionally Chinese user content. The script-level allowlist enumerates the proven exceptions so the gate is strict on product copy yet does not flag owned dictionaries and fixtures.

## Consequences

- Every card kind that appears in the conversation (`terminal`, `diff`, `read`, `search`) is now locale-aware through a uniform `*BlockLabels` prop, with English defaults that match the flipped global fallback. `WebBlock` now defaults to English literals (`No results found` / `Source list truncated` / `Content truncated`) and remains the only card not yet locale-aware via `*BlockLabels`; it is listed in `ui-primitives/README.md` under Known Limitations pending the same label-prop treatment.

- Locale lookups now resolve `active -> en -> key`, never `active -> zh`. Browsers asking for `zh-*` still land in `zh`; all others land in `en`. No on-disk migration is needed — `FALLBACK_LOCALE` is consumed only at lookup time.

- The `verify-no-hardcoded-cjk` gate pins the invariant in CI; new hardcoded Chinese outside dictionaries fails the `no hardcoded CJK` leaf. The three fixture/dictionary allowlist entries are the only places where CJK may remain outside `locales/`.

- Tests and snapshots pin the contract: `packages/client/ui-primitives/tests/*.client.spec.tsx` assert English defaults, `packages/client/ui-tool/tests/*card*.client.spec.tsx` assert the label helpers, `packages/client/locale/tests/locale.client.spec.ts` asserts `en` fallback, and the `grep-card` web snapshot asserts `... N more lines` instead of `… 其余 N 行`.
