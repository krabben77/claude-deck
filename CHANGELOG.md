# Changelog

## [Unreleased]

### Added
- Hooks: pause/enable a hook without deleting it (disabled hooks are held in a sidecar file, `.claude-deck-disabled-hooks.json`)
- Skills → Installed: edit an existing command file directly from the panel, including renaming
- Git tab: view changed files and commit with a message, without leaving the panel
- Sessions tab: browse past Claude Code sessions per project (date, message count) — read-only
- Chat tab: converse with Claude directly in the panel via headless `claude -p --output-format stream-json`, with streaming responses and multi-turn context (`--continue`/`--resume`); "Continue" button on Sessions rows resumes an old session in Chat

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
