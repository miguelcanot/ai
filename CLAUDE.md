# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Source for the user's Claude Code customizations: **skills** and **mods** (function-hook plugins), published from GitHub as the plugin marketplace **`devux`** (`claude plugin marketplace add miguelcanot/ai`). Nothing here is an app.

- `.claude-plugin/marketplace.json` (repo root) lists every plugin. The mod is a normal plugin (`source: ./mods/session-info`, its own `plugin.json`). Each skill is its own plugin with `source: ./skills/<name>`, `strict: false` and `skills: ["./"]`, so the skill folder needs no `plugin.json` and only that folder is copied into the cache. A new skill needs a new entry there.
- Claude Code runs a cached copy per version (`~/.claude/plugins/cache/devux/<plugin>/<version>`). Skill plugins have no `version`, so their version is the git commit: changes only reach users once committed and pushed. For the mod, bump `version` in `mods/session-info/.claude-plugin/plugin.json`. Then `claude plugin marketplace update devux` and `claude plugin update <plugin>@devux`, and restart. `claude plugin list` shows the loaded version.
- To test unpublished changes, add the local clone as the marketplace (`claude plugin marketplace add /path/to/clone`). To try an install without touching the real setup, point `CLAUDE_CONFIG_DIR` at a temp dir; `claude plugin details <plugin>@devux` shows which skills a plugin loaded.
- Skills find their own files through `${CLAUDE_SKILL_DIR}` (substituted in `SKILL.md` only, not in `references/*.md`, which are read with Read; there the scripts appear as `<dir-de-la-skill>/scripts/...`). Never hardcode `~/.claude/skills/...` or `.claude/skills/...`: the install path differs between plugin, global and per-project installs.

User-facing text in skills and mods is written in **Spanish**, addressing the reader as *tú* (no voseo); keep it that way.

## No personal data (this repo will be public)

Whenever you create or edit a skill or mod, check before finishing that nothing personal or project-private goes in:

- No emails, phone numbers, account/org IDs, API keys, tokens, real Measurement/AdMob IDs (use placeholders like `G-XXXXXXXXXX`), IPs, or local paths (`C:\Users\...`, `D:\Projects\...`).
- No details from the user's own apps or clients: app/company names, domains, bundle IDs, internal function/route/model names, or domain-specific examples taken from a real codebase. Turn "en esta base, `GET /players`…" into a generic example (`GET /items`, `orders`/`Product`) that keeps the lesson.
- Test fixtures and sample output must use invented data.

Verify with a grep over the changed files, e.g.:

```bash
grep -rnIiE "@[a-z0-9-]+\.(com|net|org)|[A-Z]:\\\\|/Users/|esta base|este proyecto|G-[A-Z0-9]{6,}|ca-app-pub|AIza|sk-" skills/ mods/ --exclude-dir=types
```

and report anything found instead of silently leaving it. The author name in `plugin.json` / `marketplace.json` is intentional.

## Skills

Each skill is a `SKILL.md` with YAML frontmatter (`name`, `description`). The `description` is what triggers the skill, so it lists the user phrases (in Spanish) that should activate it. Supporting files sit beside it and are referenced by relative path from `SKILL.md`.

- `mobile-legal-audit` — code-first legal/store-policy audit of mobile apps. Core principle: inventory from code, then contrast against legal texts and requirements. Detailed guidance lives in `references/*.md` (loaded on demand from SKILL.md); `scripts/sdk_inventory.py` and `scripts/external_media.py` take a project root as their argument and are invoked from SKILL.md via `${CLAUDE_SKILL_DIR}/scripts/...`.
- `legal-pages` — privacy policy, terms/licence and cookie policy for desktop/web/SaaS/extensions/CLIs, written from what the code actually sends and stores. Phases: inventory → owner decisions → drafting → linking from site and app → verification. Guidance in `references/*.md`; `scripts/inventory.py <root> [--exclude ...]` lists external hosts, web third-party resources, storage, cookies, IPs, SDKs; `assets/legal-page.template.html` is the self-contained page template. It is self-contained: `references/privacy-laws.md` is its own adaptation of `mobile-legal-audit`'s (without store/ads specifics); keep both in sync when a law changes.
- `perf-audit` — performance audit of backend queries (Express/MongoDB/Mongoose) and bundle size (Flutter, assets, deps, R8). Method: measure first, every finding carries a number and `file:line`, rank by return on effort, verify after applying. Checklists in `references/backend-queries.md` and `references/bundle-size.md`. Scripts (`asset_inventory.py`, `optimize_images.py` — needs Pillow, `unused_deps.sh`, `aab_breakdown.py`) are invoked via `${CLAUDE_SKILL_DIR}/scripts/...`.
- `web-analytics-consent` — GA4 + Consent Mode v2 banner; `consent.template.js` is the file the skill copies into a site (`GA_ID`, localStorage `KEY`, and banner styles are edited inside it).
- `web-design-guidelines` — third-party (Vercel Labs, MIT) skill, vendored: the rules are a local copy of `command.md` from `vercel-labs/web-interface-guidelines` in `references/guidelines.md` (frontmatter and `$ARGUMENTS` line removed), with Vercel's `LICENSE` beside it. To refresh, re-copy that file; keep the commit noted in `SKILL.md` up to date.

## Mods (`mods/session-info`)

A Claude Code function-hooks plugin providing `/session-info`, a live pane with model, git, tools, running agents, tokens, plan limits, files and activity. It has two layouts, kept in the `view` atom: compact cards (default, `/session-info`) and the detail list (`/session-info detalle`); the header buttons switch between them.

Agents are tracked in `live.agents` from `agent.spawn` (type, description, model), the `agentId` on `tool.call` / `turn.step` / `turn.complete` (current tool, tool count, tokens, end), and reconciled each tick with `$.agent.list()` (statuses, agents spawned without `agent.spawn`, ones the engine dropped). The 1 s ticker keeps running while any agent is active, since background agents outlive the main turn. Plugin-raised `$.tool.call` cannot set `agentId`, so tests drive agents through `$.agent.spawn`, `$.turn.step`/`$.turn.complete` with `agentId`, and a stubbed `agent.list`.

- `.claude-plugin/plugin.json` — plugin manifest (the marketplace entry is in the repo-root `.claude-plugin/marketplace.json`).
- `hooks/hooks.json` → `{ "modules": ["./register.tsx"] }`; `hooks/register.tsx` exports `register: Register` and holds all logic (state atoms `live` / `expanded` / `view`, command registration, event handlers, pane rendering).
- `types/index.d.ts` — the mod's state types, plus module augmentation of `PluginState` in `'claude-code'`.
- `.claude-plugin/types/` — **generated by Claude Code** (API declarations for `claude-code`, `claude-code-tools`, `claude-code-mcp`, and the tsconfig). Gitignored; don't edit. Read `claude-code/index.d.ts` there for the authoritative plugin API.

Runtime constraints (from the generated declarations): the hooks module runs in its own sandbox — no DOM, no Node, no `require`, no dynamic `import()`. External processes go through `$.process.run`; UI elements come from `$.ui.resolve(e)`, not globals. JSX compiles against the global `h`/`Fragment`. Atom `plugin`/`key` and command `name` must be string literals so the validator can read them.

## Mods (`mods/attachments`)

`/adjuntos`: an attachments pane, like the chips in the VS Code chat. State is one atom, `files` (`Attachment[]`, typed in `types/index.d.ts`); all logic in `hooks/register.tsx`:

- `prompt.edit` — a paste (no `e.key`) that is only absolute paths (`pastedPaths`: quoted, backslash-escaped spaces, `file://`) all of which `$.fs.stat` as file or dir is consumed (`{ text: e.text, cursor: e.cursor }` without `next`): the paths go to the pane, which opens. Dragging onto a terminal is such a paste (VS Code's terminal with PowerShell pastes `& 'path'`). Ctrl+V with copied files never reaches the mod (the terminal keeps the key and, with no text on the clipboard, sends nothing), so `/adjuntos pegar` and the pane's **Pegar** button read the clipboard's file list instead (`clipboardPaths` via `$.process.run`, readers tried in order: PowerShell `Clipboard.GetFileDropList()` or a copied image saved as PNG to `%TEMP%`; `osascript`, `wl-paste`, `xclip`). In the PowerShell script `elseif` must not follow a `;` (a test guards it).
- `command.run` `adjuntos` — opens the pane, adds paths, `vaciar`, `cerrar`.
- `prompt.submit` — while any are attached, appends `contextOf(files)` (paths, type, size, hints for video/audio/Office) to `e.context` on every prompt.
- `tool.check` — `allow` for Read (`file_path`) / Glob / Grep (`path`) on an attached file or under an attached folder (`isAttached`: case-insensitive drive, any `..` segment refused); everything else falls through.

`prompt.edit` cannot be raised from `$` in tests, so the parsing helpers are exported and tested directly; the rest goes through `$.command.run`, `$.prompt.submit` and `$.tool.check` with a stubbed `fs.stat`.

Commands (run from repo root; same for `mods/attachments`):

```bash
claude plugin validate .                   # static check of the root marketplace
claude plugin validate mods/session-info   # static check of manifest + hooks module
claude plugin test mods/session-info       # runs hooks/*.test.ts(x) with 'claude-code/testing'
npx tsc -p mods/session-info               # typecheck (needs .claude-plugin/types to exist)
```

Tests use `test(name, async ($, on) => …)` from `claude-code/testing`; engine nouns (`process.run`, `session.model`, `ui.open`, `tool.call`, clock) are stubbed with `on(...)` and `mock.clock(on)`, then exercised via `$.command.run` / `$.tool.call`. The testing kit declares no `test.only`/filter; to run one test, temporarily comment out the others.
