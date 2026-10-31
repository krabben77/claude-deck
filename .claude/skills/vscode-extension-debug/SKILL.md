---
name: vscode-extension-debug
description: Debug the Claude Deck VS Code extension and its webview panel. Covers building, launching an Extension Development Host, opening webview devtools, and the usual failure causes (stale dist, activation, postMessage timing, template-literal escapes). Use when the panel is blank, a button does nothing, a tab does not load, or the extension fails to activate.
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# Debug Claude Deck

1. **Static checks first:** `npx tsc --noEmit`, then the webview-template-guard and hook-template-verify skills. These catch the most common regressions without launching VS Code.
2. **Rebuild:** `npm run build` (or `npm run watch`). The extension runs `dist/extension.js`; a stale `dist/` means your change is not running.
3. **Launch:** F5 in VS Code starts an Extension Development Host (check `.vscode/launch.json`). `.claude/skills/run-claude-deck/driver.mjs` drives the app for a scripted run.
4. **Webview devtools:** in the host, Command Palette -> "Developer: Open Webview Developer Tools". Console errors show embedded-JS problems; "Developer: Toggle Developer Tools" shows extension-host errors.

## Usual causes
- **Blank panel / dead buttons:** syntax error in the embedded JS (`\'`, `\s`; see webview-template-guard).
- **Tab does nothing from the sidebar:** `claude-deck.openTab` posts `navigateTab` 250 ms after `createOrShow`; a slow webview misses it. Check the listener is attached first.
- **Command not found on startup:** `claude-deck.openTab` is not in `contributes.commands`, so it needs the explicit `onCommand:claude-deck.openTab` entry in `activationEvents`.
- **Settings change not reflected:** `skillsPanel.ts` watches the `.claude/` directory with a 100 ms debounce; the sidebar polls every 5 s.
- **Hook does nothing:** exit code must be 2, input is JSON on stdin (see hook-template-verify).
