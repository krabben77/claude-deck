import { HookEvent } from '../settingsManager';

export interface HookTemplate {
  id: string;
  name: string;
  description: string;
  event: HookEvent;
  matcher: string;
  command: string;
  icon: string;
  category: 'safety' | 'quality' | 'notify' | 'workflow';
  note?: string;
}

// Claude Code passes the tool call as JSON on stdin; only exit code 2 blocks it.
// Safety hooks fail closed: unparseable input blocks rather than lets the call through.
// The JS uses double quotes only so it can sit inside single quotes in the shell.
const stdinGuard = (check: string): string =>
  `node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let i;try{i=JSON.parse(s).tool_input||{}}catch(e){console.error("BLOCKED: cannot parse hook input");process.exit(2)}const b=m=>{console.error("BLOCKED: "+m);process.exit(2)},c=i.command||"",f=(i.file_path||"").split(String.fromCharCode(92)).join("/");${check}})'`;

export const HOOK_TEMPLATES: HookTemplate[] = [

  // ── SAFETY ─────────────────────────────────────────────────────────────

  {
    id: 'block-rm-rf',
    name: 'Block rm -rf',
    description: 'Abort any Bash command that contains rm -rf — prevents accidental deletion.',
    event: 'PreToolUse',
    matcher: 'Bash',
    command: stdinGuard('if(c.includes("rm -rf"))b("rm -rf not allowed")'),
    icon: '🛡️',
    category: 'safety',
    note: 'Reads the tool call from stdin and exits with code 2, which is what blocks it. Requires Node.js.',
  },

  {
    id: 'block-force-push',
    name: 'Block git force push',
    description: 'Prevent force pushes to main/master to protect shared history.',
    event: 'PreToolUse',
    matcher: 'Bash',
    command: stdinGuard('if(/git push.* (-f|--force)( |$)/.test(c))b("force push not allowed")'),
    icon: '🚫',
    category: 'safety',
  },

  {
    id: 'block-env-write',
    name: 'Protect .env files',
    description: 'Block any write to .env files to prevent accidental credential overwrites.',
    event: 'PreToolUse',
    matcher: 'Write',
    command: stdinGuard('if(/[.]env/.test(f))b(".env write blocked")'),
    icon: '🔐',
    category: 'safety',
  },

  {
    id: 'block-drop-table',
    name: 'Block DROP TABLE',
    description: 'Abort any Bash command containing DROP TABLE to prevent accidental data loss.',
    event: 'PreToolUse',
    matcher: 'Bash',
    command: stdinGuard('if(/drop table/i.test(c))b("DROP TABLE not allowed")'),
    icon: '🗑️',
    category: 'safety',
  },

  {
    id: 'block-prod-env',
    name: 'Block writes to production config',
    description: 'Prevent edits to files that contain "prod" in the path — guards against accidental production config changes.',
    event: 'PreToolUse',
    matcher: 'Edit',
    command: stdinGuard('if(/[/]prod|[.]prod[.]/.test(f))b("production file edit blocked")'),
    icon: '🚧',
    category: 'safety',
    note: 'Blocks edits to any path containing /prod or .prod.',
  },

  {
    id: 'block-secret-commit',
    name: 'Block potential secret in commit',
    description: 'Scan staged content for patterns that look like API keys or tokens before committing.',
    event: 'PreToolUse',
    matcher: 'Bash',
    command: stdinGuard('if(c.includes("git commit")){let d="";try{d=require("child_process").execSync("git diff --cached",{encoding:"utf8",maxBuffer:50000000})}catch(e){}if(/(sk-|ghp_|AKIA|eyJhbGci|-----BEGIN)/.test(d))b("possible secret in staged changes")}'),
    icon: '🔑',
    category: 'safety',
  },

  // ── QUALITY ────────────────────────────────────────────────────────────

  {
    id: 'eslint-after-edit',
    name: 'ESLint after JS/TS edit',
    description: 'Run ESLint on any JS or TS file after Claude edits it.',
    event: 'PostToolUse',
    matcher: 'Edit',
    command: 'bash -c \'FILE=$(echo "$CLAUDE_TOOL_INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get(\'file_path\',\'\'))" 2>/dev/null); [[ "$FILE" =~ \\.(js|ts|jsx|tsx)$ ]] && npx eslint --fix "$FILE" 2>&1 || true\'',
    icon: '✅',
    category: 'quality',
    note: 'Requires ESLint in the project.',
  },

  {
    id: 'pytest-after-edit',
    name: 'pytest after Python edit',
    description: 'Run related pytest tests after any Python file is edited.',
    event: 'PostToolUse',
    matcher: 'Edit',
    command: 'bash -c \'FILE=$(echo "$CLAUDE_TOOL_INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get(\'file_path\',\'\'))" 2>/dev/null); [[ "$FILE" =~ \\.py$ ]] && python3 -m pytest --tb=short -q 2>&1 | tail -20 || true\'',
    icon: '🧪',
    category: 'quality',
    note: 'Requires pytest installed.',
  },

  {
    id: 'typecheck-after-ts',
    name: 'TypeScript check after edit',
    description: 'Run tsc --noEmit after any TypeScript file is modified.',
    event: 'PostToolUse',
    matcher: 'Edit',
    command: 'bash -c \'FILE=$(echo "$CLAUDE_TOOL_INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get(\'file_path\',\'\'))" 2>/dev/null); [[ "$FILE" =~ \\.tsx?$ ]] && npx tsc --noEmit 2>&1 | head -30 || true\'',
    icon: '📐',
    category: 'quality',
  },

  {
    id: 'log-bash',
    name: 'Log all Bash commands',
    description: 'Append every Bash command Claude runs to ~/.claude/bash.log with timestamp.',
    event: 'PreToolUse',
    matcher: 'Bash',
    command: 'bash -c \'echo "[$(date -Iseconds)] $CLAUDE_TOOL_INPUT" >> ~/.claude/bash.log\'',
    icon: '📋',
    category: 'quality',
  },

  {
    id: 'prettier-after-edit',
    name: 'Prettier after JS/TS/CSS edit',
    description: 'Run Prettier on any JS, TS, or CSS file after Claude edits it.',
    event: 'PostToolUse',
    matcher: 'Edit',
    command: 'bash -c \'FILE=$(echo "$CLAUDE_TOOL_INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get(\'file_path\',\'\'))" 2>/dev/null); [[ "$FILE" =~ \\.(js|ts|jsx|tsx|css|scss|json|md)$ ]] && npx prettier --write "$FILE" 2>&1 || true\'',
    icon: '🎨',
    category: 'quality',
    note: 'Requires Prettier in the project.',
  },

  {
    id: 'gofmt-after-edit',
    name: 'gofmt after Go edit',
    description: 'Run gofmt + goimports on any Go file after Claude edits it.',
    event: 'PostToolUse',
    matcher: 'Edit',
    command: 'bash -c \'FILE=$(echo "$CLAUDE_TOOL_INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get(\'file_path\',\'\'))" 2>/dev/null); [[ "$FILE" =~ \\.go$ ]] && gofmt -w "$FILE" && goimports -w "$FILE" 2>/dev/null || true\'',
    icon: '🐹',
    category: 'quality',
  },

  {
    id: 'ruff-after-edit',
    name: 'Ruff after Python edit',
    description: 'Run ruff format + ruff check --fix on any Python file after Claude edits it.',
    event: 'PostToolUse',
    matcher: 'Edit',
    command: 'bash -c \'FILE=$(echo "$CLAUDE_TOOL_INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get(\'file_path\',\'\'))" 2>/dev/null); [[ "$FILE" =~ \\.py$ ]] && ruff format "$FILE" && ruff check --fix "$FILE" 2>&1 || true\'',
    icon: '⚡',
    category: 'quality',
    note: 'Requires ruff installed (pip install ruff).',
  },

  {
    id: 'test-on-stop',
    name: 'Run tests when Claude stops',
    description: 'Automatically run the project test suite when Claude finishes a task.',
    event: 'Stop',
    matcher: '',
    command: 'bash -c \'cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" && ([ -f package.json ] && npm test -- --passWithNoTests 2>&1 | tail -20) || ([ -f pytest.ini ] || [ -f pyproject.toml ] && python3 -m pytest -q 2>&1 | tail -20) || true\'',
    icon: '🧪',
    category: 'quality',
    note: 'Runs npm test or pytest depending on project type.',
  },

  // ── NOTIFY ─────────────────────────────────────────────────────────────

  {
    id: 'notify-stop',
    name: 'Desktop notify on completion',
    description: 'Send a desktop notification when Claude finishes a task.',
    event: 'Stop',
    matcher: '',
    command: 'bash -c \'notify-send "Claude Code" "Task complete" --icon=dialog-information 2>/dev/null || osascript -e \'display notification "Task complete" with title "Claude Code"\' 2>/dev/null || true\'',
    icon: '🔔',
    category: 'notify',
    note: 'Works on Linux (notify-send) and macOS (osascript).',
  },

  {
    id: 'notify-sound',
    name: 'Play sound on completion',
    description: 'Play a system sound when Claude stops.',
    event: 'Stop',
    matcher: '',
    command: 'bash -c \'paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true\'',
    icon: '🎵',
    category: 'notify',
  },

  {
    id: 'notify-on-error',
    name: 'Notify on task error',
    description: 'Send a desktop notification if Claude stops due to an error or tool failure.',
    event: 'Stop',
    matcher: '',
    command: 'bash -c \'[ "$CLAUDE_STOP_REASON" = "error" ] && (notify-send "Claude Code" "Task failed ❌" 2>/dev/null || osascript -e \'display notification "Task failed" with title "Claude Code"\' 2>/dev/null) || true\'',
    icon: '🚨',
    category: 'notify',
  },

  // ── WORKFLOW ───────────────────────────────────────────────────────────

  {
    id: 'auto-stage',
    name: 'Auto-stage edits',
    description: 'Automatically git add any file Claude edits, so you can commit immediately after.',
    event: 'PostToolUse',
    matcher: 'Edit',
    command: 'bash -c \'FILE=$(echo "$CLAUDE_TOOL_INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get(\'file_path\',\'\'))" 2>/dev/null); [ -n "$FILE" ] && git add "$FILE" 2>/dev/null || true\'',
    icon: '➕',
    category: 'workflow',
  },

  {
    id: 'print-tool-name',
    name: 'Print tool name to terminal',
    description: 'Echo the name of every tool Claude calls — useful for debugging agent behavior.',
    event: 'PreToolUse',
    matcher: '',
    command: 'bash -c \'echo "▶ Tool: $CLAUDE_TOOL_NAME"\'',
    icon: '🔍',
    category: 'workflow',
  },

  {
    id: 'git-status-on-stop',
    name: 'Show git status on completion',
    description: 'Print a compact git status summary to the terminal when Claude finishes.',
    event: 'Stop',
    matcher: '',
    command: 'bash -c \'git -C "${CLAUDE_PROJECT_DIR:-$(pwd)}" status -s 2>/dev/null && echo "---" || true\'',
    icon: '📊',
    category: 'workflow',
  },

  {
    id: 'log-session',
    name: 'Log session to file',
    description: 'Append a timestamped entry to ~/.claude/sessions.log each time Claude stops.',
    event: 'Stop',
    matcher: '',
    command: 'bash -c \'echo "[$(date -Iseconds)] session ended in $(pwd)" >> ~/.claude/sessions.log\'',
    icon: '📝',
    category: 'workflow',
  },

  {
    id: 'backup-before-edit',
    name: 'Backup file before edit',
    description: 'Copy any file to a .bak before Claude edits it — easy manual rollback.',
    event: 'PreToolUse',
    matcher: 'Edit',
    command: 'bash -c \'FILE=$(echo "$CLAUDE_TOOL_INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get(\'file_path\',\'\'))" 2>/dev/null); [ -f "$FILE" ] && cp "$FILE" "${FILE}.bak" 2>/dev/null || true\'',
    icon: '💾',
    category: 'workflow',
  },
];
