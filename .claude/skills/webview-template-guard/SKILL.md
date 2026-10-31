---
name: webview-template-guard
description: Catch broken embedded JavaScript in the webview panel before it ships. Builds the HTML from src/webviewShared.ts, extracts the inline script, and runs node --check on it. Use after editing webviewShared.ts, when the panel is blank or its buttons do nothing, or when a TypeScript build passes but the webview misbehaves.
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Grep
---

# Webview template guard

The panel's whole JS lives inside a TypeScript template literal in `src/webviewShared.ts`. `tsc` cannot see errors in it, so a bad escape ships silently (see commit 50e5948).

```bash
node .claude/skills/webview-template-guard/check.mjs
```

It renders `buildWebviewHtml()` with `vscode` stubbed, takes the contents of each inline `<script>`, and runs `node --check`. A syntax error prints the failing line.

Known pitfalls it targets:
- `\'` in the embedded JS compiles to `'` and breaks string concatenation. Use `&quot;` in HTML `onclick` attributes.
- `\s`, `\d` and similar in regex literals lose their backslash. Write `\\s`.

It checks syntax only, not behavior. Click through the panel in the Extension Development Host for that (see vscode-extension-debug).
