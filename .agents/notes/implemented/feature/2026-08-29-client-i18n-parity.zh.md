# Agent Note: 客户端 i18n 对齐——工具卡片本地化、默认英文与 CJK 防护

Status: implemented

[English](2026-08-29-client-i18n-parity.md) | 中文

## 问题

`packages/client/ui-primitives` 中的四张工具卡片——`TerminalBlock`、`DiffBlock`、`ReadBlock` 与 `SearchBlock`——都硬编码了中文文案（`复制`、`收起`、`… 其余 N 行`、`显示 X / 共 N …`、`无结果`，`└ +A -R · N file(s)` 虽然是英文但周围 chrome 仍是中文）。只有 `TerminalBlock` 暴露了 `labels` prop 供本地化，其余三张卡片把字面量写在原语内部，调用方无法传入 locale 驱动的文案，卡片也无法跟随应用语言。locale 服务（`packages/client/locale`）默认 `FALLBACK_LOCALE='zh'`，且在 active locale  miss 后回退到 `zh` 字典，因此全新 `en` 安装在缺键时仍会解析到中文。`packages/client` 在 `locales/` 字典之外没有自动化检查来阻止新的硬编码 CJK 进入，遗留的字符串因而没有回归屏障。

## 决策

- **四张卡片都复用 `TerminalBlockLabels` 模式。** `DiffBlock`、`SearchBlock` 与 `ReadBlock` 各自暴露 `*BlockLabels` 接口（`copy`/`copied`/`collapse`/`collapseAria`/`expand`/`expandAria`，plus diff 的 `footer`、search 的 `summary`/`empty`、read 的 `windowCount`）、默认值 `DEFAULT_*_LABELS` 默认为英文（`Copy`/`Copied`/`Collapse`/`... N more lines`/`Showing N of M lines`/`+A -R · N file(s)`），以及可选 `labels?: Partial<*BlockLabels>` prop，以 `{...DEFAULT, ...labels}` 合并。所有硬编码字面量（`复制`/`复制成功`/`收起`/`… 其余 N 行`/`显示 …`/`无结果`）都改为解析后的 label。原语保持 zero-cordis——通过 props 接收 labels，而非 `ctx.locale`——与此前的 `TerminalBlock` 完全一致，其默认值也一并从中文翻为英文（`signal`/`exit code`/`Running`/`Failed`/`Done`/`Copy`/`No output`/`Collapse`/`... N more lines`）。快照（`apps/web/tests/snapshots/search-card/grep-card.expected.txt` 与 markdown/terminal/web fixtures）与组件单测现在断言英文文案。

- **回退改为 `en`，不再是 `zh`。** `packages/client/locale/src/client/index.ts` 将 `FALLBACK_LOCALE='en'`，`lookup()` 按 `active` 再 `en` 的顺序尝试。`detectBrowserLocale()` 仍识别 `zh-*`，但在浏览器未请求任何已发布语言时默认 `en`；浏览器外 `resolveInitialLocale()` 返回 `en`。因此 `en` 字典成为每个 namespace 的第二顺位，`en` 激活且双字典都 miss 时直接返回 key——永不回退到中文。`packages/client/ui-conversation/src/client/locales.ts` 与 `packages/client/locale/src/locales/` 为新增键补齐英文（`terminal.expandRest`、`terminal.expandAria`、`read.windowCount`、`search.empty`、`search.summary.*`）。

- **持有方在渲染点拼接字典。** `packages/client/ui-tool/src/client/tool/models/{diff,read,search}-card-model.ts` 各导出一个 helper（`diffBlockLabels(t)`、`readBlockLabels(t)`、`searchBlockLabels(t)`），从 `conversation`（及 `common` 回退）locale 席位 `t: TranslateNS<'conversation'>` 构造完整 label 集。`TerminalBlock` 早已有 `terminalBlockLabels(t)`。`ToolRow` 与 `ToolDetails` 在渲染时调用 helper（`<DiffBlock labels={diffBlockLabels(t)}>` 等），因此聊天行与详情面板都会跟随 locale 切换，而原语本身从不导入 locale 服务。Helper 对旧版 `en` 字典中可能缺失的键使用 `withFallback`，回退到英文字面量而不是把 key 暴露出来。

- **卫生门禁防止回归。** `scripts/verify-no-hardcoded-cjk.ts` 扫描 `packages/client/**/*.{ts,tsx}`，排除 `locales/`、`*.zh.md`、`*.i18n.yaml`、`tests/` 与 `lib/`，同时检查字面 CJK（`[\u4e00-\u9fff]`）与转义 `\uXXXX` 在 CJK 范围的情形。白名单 fixture（`connection/fixture.ts`、`runtime/sessions/conversation.ts` 文档注释、locale 选择器的 `label: '中文'`、`(recommended)` 正则、以及同址的 `ui-directory-picker-browse`/`ui-settings-models/onboarding-copy` 字典）是仅有的例外。该脚本通过 `scripts/run-gates.ts` 在 `hygieneLeafGates`（`pnpm run verify-no-hardcoded-cjk`）与 `doc-sync` 树中注册，新的硬编码中文会让 CI 的 `no hardcoded CJK` 子门禁失败。

## 考虑过的替代方案

- **让 `ui-primitives` 直接读取 `ctx.locale`。** 已否决：该包刻意 zero-cordis，以便在 cordis fiber 之外也能使用并保持 bundle 纯净。加入 locale 依赖会把原子组件与应用运行时耦合，每个测试都要提供 provider，并重复已在 `ui-tool`/`ui-conversation` 渲染点存在的框架 `t` 席位。通过 props 保持原语可用纯英文 literals 测试，并由持有方驱动语言。

- **保留 `FALLBACK_LOCALE='zh'` 且依赖完整的 `en` 字典。** 已否决：任何先在 `zh` 字典新增、后补 `en` 的 key，在补齐前的窗口期内仍会让 `en` 用户解析到中文，且回退会静默掩盖缺翻译。将回退翻为 `en` 使得缺翻译以英文或 key 本身形式显现，与英文默认卡片文案一致，也让缺口显性化而非被另一种语言掩盖。

- **仅对 `packages/client/src` 的字面量用 `rg` 做门禁，不加白名单与转义 unicode 检查。** 已否决：单行 `rg` 会漏掉转义的 `\u4e2d` 字面量，把 `locales/` 字典判为违规，并把刻意为中文用户内容的 fixture 数据误报为违规。脚本级白名单枚举已验证的例外，使门禁对产品文案严格、对已拥有的字典与 fixture 不误报。

## 影响

- 会话中出现的所有卡片类型（`terminal`、`diff`、`read`、`search`）现在通过统一的 `*BlockLabels` prop 实现本地化，英文默认值与全局回退翻转一致。`WebBlock` 是唯一仍保留内联中文的空状态与截断提示的卡片，已在 `ui-primitives/README.md` 的 Known Limitations 中列出。

- locale 查找现在按 `active -> en -> key` 解析，永不走 `active -> zh`。请求 `zh-*` 的浏览器仍落在 `zh`，其余落在 `en`。磁盘上无需迁移——`FALLBACK_LOCALE` 仅在查找时消费。

- `verify-no-hardcoded-cjk` 门禁在 CI 中钉住不变量；字典之外新增硬编码中文会让 `no hardcoded CJK` 子门禁失败。三处 fixture/字典白名单是 `locales/` 之外允许保留 CJK 的仅有位置。

- 测试与快照钉住约定：`packages/client/ui-primitives/tests/*.client.spec.tsx` 断言英文默认，`packages/client/ui-tool/tests/*card*.client.spec.tsx` 断言 label helper，`packages/client/locale/tests/locale.client.spec.ts` 断言 `en` 回退，`grep-card` web 快照断言 `... N more lines` 而非 `… 其余 N 行`。
