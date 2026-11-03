# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build       # compile TypeScript → dist/ via esbuild (minified)
npm run watch       # same but incremental, unminified
npm run package     # build + vsce package → .vsix
npx tsc --noEmit    # type-check only (no test suite exists)
```

Install locally after packaging:
- `Ctrl+Shift+P` → "Extensions: Install from VSIX" → select `claude-deck-*.vsix`

## Architecture

This is a VS Code extension with **two UI surfaces** that share one rendering engine:

### Two surfaces, one engine
- **`skillsSidebar.ts`** — lightweight Activity Bar sidebar (counts only, click-through to panel). Renders its own minimal HTML inline.
- **`skillsPanel.ts`** — full webview panel (`ViewColumn.One`). Singleton via `SkillsPanel._instance`.
- **`webviewShared.ts`** — thin facade (~57 lines). Exports `buildWebviewHtml()` plus `handleMessage()`, `sendInstalled()` and `sendStack()`; the real code lives in `src/webview/`:
  - `messages.ts` — extension-side message handling and the `InMsg` union
  - `icons.ts`, `styles.ts` — SVG icons and the panel CSS
  - `markup.ts` — HTML body (receives `hasProject`, `projectName`, active model and chip HTML)
  - `script/` — the panel's inline JavaScript, one module per section (`core`, `scope`, `nav`, `stack`, `skills`, `modal`, `mcp`, `hooks`, `permissions`, `memory`, `git`, `sessions`, `chat`, `utils`, `events`, `init`); `script/index.ts` concatenates them in order. Only `core.ts` and `stack.ts` interpolate values from the extension.
  - Each script module is a TypeScript template literal holding raw JS text, so the pitfall below applies to every file in `script/`.

### Data flow
The webview communicates via `postMessage` in both directions. Message types are defined as the `InMsg` union in `webview/messages.ts`. Key outbound messages from the extension:
- `stackData` — full architecture snapshot sent by `sendStack()`
- `installed` — list of installed skills for a scope, sent by `sendInstalled()`

`sendStack()` reads live state from all managers and posts a single payload including MCPs, hooks, memory files, installed skills, and active model.

### File watching
`skillsPanel.ts` watches the `.claude/` **directory** (not the file) for `settings.json` changes using `fs.watch` with a 100ms debounce. This handles atomic writes. The sidebar uses `vscode.workspace.onDidChangeTextDocument` style polling via `setInterval`.

### Scope system
Everything is scoped to `'global'` (`~/.claude/`) or `'project'` (`<workspace>/.claude/`). The active scope is a JS variable in the webview; all messages carry it. Default scope on open: `'project'` if a workspace is open, otherwise `'global'`.

### Backend modules
- **`skillsManager.ts`** — reads/writes `.md` files in `<scope>/.claude/commands/`
- **`settingsManager.ts`** — reads/writes `settings.json`; exports helpers for MCPs, hooks, and `getActiveModel()` which maps raw model IDs to friendly names via regex (`claude-opus-4-7` → `Opus 4.7`)
- **`memoryManager.ts`** — reads `~/.claude/projects/<slug>/memory/*.md`; slug format is path-with-dashes e.g. `-home-ajax-myproject`

### Static data (`src/data/`)
- `curatedSkills.ts` — browseable skill catalog with `content` (the `.md` to install)
- `hookTemplates.ts` — pre-built hook recipes
- `mcpCatalog.ts` — MCP server catalog; entries with `envVars` show an inline config form
- `templates.ts` — Create-tab starting templates

### Template literal pitfall
The webview JS is embedded inside TypeScript template literals (`src/webview/script/*.ts`). **Never use `\'` inside the embedded JS** — it compiles to `'` and breaks string concatenation. Use `&quot;` for quotes inside HTML `onclick` attributes.

### Icon conversion
To regenerate `media/icon*.png` from SVG:
```bash
python3 -m cairosvg media/icon.svg -o media/icon.png -W 128 -H 128
```
Activity bar icon (`media/activitybar.svg`) must use `currentColor` and a tight `viewBox` — VS Code renders it as a mask at ~24px.
