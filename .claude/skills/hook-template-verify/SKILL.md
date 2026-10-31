---
name: hook-template-verify
description: Run every safety hook template in src/data/hookTemplates.ts against sample tool-call JSON on stdin and check that dangerous input exits 2 and safe input exits 0. Use after editing hookTemplates.ts, when adding a hook template, or when asked whether the hook templates actually block anything.
user-invocable: true
allowed-tools:
  - Bash
  - Read
---

# Verify hook templates

Claude Code passes the tool call as JSON on stdin and only exit code 2 blocks it. Exit 1 and `$CLAUDE_TOOL_INPUT` do not work.

Run from the repo root:

```bash
node .claude/skills/hook-template-verify/verify.mjs
```

It bundles `hookTemplates.ts`, runs each `block-*` template through `bash -c` with the cases in `verify.mjs`, and prints PASS/FAIL per case. Exit code is non-zero on any FAIL.

When you add or change a safety template, add a dangerous case (expect 2) and a safe case (expect 0) to `verify.mjs`. The built-in bad-JSON case (expect 2, fail closed) runs for every template listed there.

The script also runs the quality and workflow templates (gofmt, ruff, pytest, tsc, auto-stage, backup-before-edit, log-bash) in throwaway projects, and skips a tool that is not installed. eslint and prettier only get the "ignores unrelated file" check unless they are installed in the repo's node_modules. Notify templates and the Stop-event templates are not tested here.
