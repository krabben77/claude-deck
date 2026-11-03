# Changelog

## [Unreleased]

### Added
- Undo: every change the panel makes to `settings.json` is backed up first, with a one-level "undo last change" button
- Permissions tab: view and edit `allow`, `ask` and `deny` rules and `defaultMode` per scope
- Health check card in the Stack tab
- MCP servers can be edited in the panel (args, env), with a diff preview before saving
- Path allowlist for external lock-hook integration
- Hooks: pause/enable a hook without deleting it (disabled hooks are held in a sidecar file, `.claude-deck-disabled-hooks.json`)
- Skills → Installed: edit an existing command file directly from the panel, including renaming
- Git tab: view changed files and commit with a message, without leaving the panel
- Sessions tab: browse past Claude Code sessions per project (date, message count) — read-only
- Chat tab: converse with Claude directly in the panel via headless `claude -p --output-format stream-json`, with streaming responses and multi-turn context (`--continue`/`--resume`); "Continue" button on Sessions rows resumes an old session in Chat

### Fixed
- Safety hook templates now read the tool call as JSON on stdin and block with exit code 2
- Quality and workflow hook templates read stdin; notification templates are marked Linux/Mac only
- Escaped `\s` in the custom MCP args split inside the webview template literal
- Skills Manager no longer reinstalls skills the user has removed

### Changed
- Repository metadata (repository, bugs, homepage) points to `krabben77/claude-deck`; package description updated
- README rewritten; build log added in `docs/BYGGLOGG.md`

## [1.1.0]

### Fixed
- Activity bar icon now opens the full panel immediately on click

## [1.0.0]

### Added
- Skills browser with category filters (Code, Testing, Docs, Git, Security, DevOps, Data)
- MCP server catalog with inline configuration forms for servers requiring API keys
- Hooks library covering safety, quality, notifications, and workflow categories
- Memory tab for viewing and editing CLAUDE.md and memory files
- Live Stack architecture view showing active model, skills, MCPs, and hooks
- Project scope support - manage global and per-workspace settings independently
- Live settings.json watcher - model and hook changes reflect instantly without reload
- Friendly model display names parsed from Claude Code model IDs
- Install / uninstall skills with a single click
- Create custom skills from built-in templates
