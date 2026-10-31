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

// Quality/workflow hooks read the same stdin JSON but never block a tool call themselves:
// they skip silently when the tool is missing, and report problems with exit 2 (stderr
// reaches Claude after PostToolUse). Newlines are built with fromCharCode(10) because an
// escaped newline in this template literal would become a real line break in the command.
const fileHook = (body: string): string =>
  `node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let i={};try{i=JSON.parse(s).tool_input||{}}catch(e){process.exit(0)}const f=i.file_path||"",c=i.command||"",fs=require("fs"),w=process.platform==="win32",r=(b,a)=>require("child_process").spawnSync(b,w?a.map(x=>JSON.stringify(x)):a,{encoding:"utf8",shell:w}),has=b=>r(w?"where":"which",[b]).status===0,local=b=>fs.existsSync("node_modules/.bin/"+b)||fs.existsSync("node_modules/.bin/"+b+".cmd"),ext=p=>p.test(f),tail=(x,n)=>((x.stdout||"")+(x.stderr||"")).trim().split(String.fromCharCode(10)).slice(-n).join(String.fromCharCode(10)),fail=x=>{console.error(tail(x,30));process.exit(2)};${body}})'`;

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
    matcher: 'Edit|Write',
    command: fileHook('if(ext(/[.](js|ts|jsx|tsx)$/)&&local("eslint")){const x=r("npx",["--no-install","eslint","--fix",f]);if(x.status!==0)fail(x)}'),
    icon: '✅',
    category: 'quality',
    note: 'Requires ESLint in the project.',
  },

  {
    id: 'pytest-after-edit',
    name: 'pytest after Python edit',
    description: 'Run related pytest tests after any Python file is edited.',
    event: 'PostToolUse',
    matcher: 'Edit|Write',
    command: fileHook('if(ext(/[.]py$/)){const x=r(w?"python":"python3",["-m","pytest","--tb=short","-q"]);if(x.status!==0&&x.status!==5&&!/No module named pytest/.test(x.stderr||""))fail(x)}'),
    icon: '🧪',
    category: 'quality',
    note: 'Requires pytest installed.',
  },

  {
    id: 'typecheck-after-ts',
    name: 'TypeScript check after edit',
    description: 'Run tsc --noEmit after any TypeScript file is modified.',
    event: 'PostToolUse',
    matcher: 'Edit|Write',
    command: fileHook('if(ext(/[.]tsx?$/)&&fs.existsSync("tsconfig.json")&&local("tsc")){const x=r("npx",["--no-install","tsc","--noEmit"]);if(x.status!==0)fail(x)}'),
    icon: '📐',
    category: 'quality',
  },

  {
    id: 'log-bash',
    name: 'Log all Bash commands',
    description: 'Append every Bash command Claude runs to ~/.claude/bash.log with timestamp.',
    event: 'PreToolUse',
    matcher: 'Bash',
    command: fileHook('if(c){const p=require("path").join(require("os").homedir(),".claude","bash.log");fs.appendFileSync(p,"["+new Date().toISOString()+"] "+JSON.stringify(c)+String.fromCharCode(10))}'),
    icon: '📋',
    category: 'quality',
  },

  {
    id: 'prettier-after-edit',
    name: 'Prettier after JS/TS/CSS edit',
    description: 'Run Prettier on any JS, TS, or CSS file after Claude edits it.',
    event: 'PostToolUse',
    matcher: 'Edit|Write',
    command: fileHook('if(ext(/[.](js|ts|jsx|tsx|css|scss|json|md)$/)&&local("prettier"))r("npx",["--no-install","prettier","--write",f])'),
    icon: '🎨',
    category: 'quality',
    note: 'Requires Prettier in the project.',
  },

  {
    id: 'gofmt-after-edit',
    name: 'gofmt after Go edit',
    description: 'Run gofmt + goimports on any Go file after Claude edits it.',
    event: 'PostToolUse',
    matcher: 'Edit|Write',
    command: fileHook('if(ext(/[.]go$/)&&has("gofmt")){const x=r("gofmt",["-w",f]);if(x.status!==0)fail(x);if(has("goimports"))r("goimports",["-w",f])}'),
    icon: '🐹',
    category: 'quality',
  },

  {
    id: 'ruff-after-edit',
    name: 'Ruff after Python edit',
    description: 'Run ruff format + ruff check --fix on any Python file after Claude edits it.',
    event: 'PostToolUse',
    matcher: 'Edit|Write',
    command: fileHook('if(ext(/[.]py$/)&&has("ruff")){r("ruff",["format",f]);const x=r("ruff",["check","--fix",f]);if(x.status!==0)fail(x)}'),
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
    name: 'Desktop notify on completion (Linux/Mac only)',
    description: 'Send a desktop notification when Claude finishes a task. Linux and macOS only; does nothing on Windows.',
    event: 'Stop',
    matcher: '',
    command: 'bash -c \'notify-send "Claude Code" "Task complete" --icon=dialog-information 2>/dev/null || osascript -e \'display notification "Task complete" with title "Claude Code"\' 2>/dev/null || true\'',
    icon: '🔔',
    category: 'notify',
    note: 'Linux (notify-send) and macOS (osascript) only. Does nothing on Windows.',
  },

  {
    id: 'notify-sound',
    name: 'Play sound on completion (Linux/Mac only)',
    description: 'Play a system sound when Claude stops. Linux (paplay) and macOS (afplay) only; does nothing on Windows.',
    event: 'Stop',
    matcher: '',
    command: 'bash -c \'paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true\'',
    icon: '🎵',
    category: 'notify',
  },

  {
    id: 'notify-on-error',
    name: 'Notify on task error (Linux/Mac only)',
    description: 'Send a desktop notification if Claude stops due to an error or tool failure. Linux and macOS only; does nothing on Windows.',
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
    matcher: 'Edit|Write',
    command: fileHook('if(f)r("git",["add",f])'),
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
    matcher: 'Edit|Write',
    command: fileHook('if(f&&fs.existsSync(f))fs.copyFileSync(f,f+".bak")'),
    icon: '💾',
    category: 'workflow',
  },
];
