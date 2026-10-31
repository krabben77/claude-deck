import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Scope } from './skillsManager';

const GLOBAL_SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');

export function settingsPath(scope: Scope, projectPath?: string): string {
  if (scope === 'project' && projectPath) {
    return path.join(projectPath, '.claude', 'settings.json');
  }
  return GLOBAL_SETTINGS;
}

export interface MCPServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface HookEntry {
  type: 'command';
  command: string;
}

export interface HookMatcher {
  matcher?: string;
  hooks: HookEntry[];
}

export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'Stop' | 'Notification' | 'UserPromptSubmit';

export interface ClaudeSettings {
  mcpServers?: Record<string, MCPServerConfig>;
  hooks?: Partial<Record<HookEvent, HookMatcher[]>>;
  permissions?: { allow?: string[]; deny?: string[]; ask?: string[]; defaultMode?: string; [key: string]: unknown };
  effortLevel?: string;
  [key: string]: unknown;
}

export interface ActiveMCP {
  name: string;
  command: string;
  args: string[];
  hasEnv: boolean;
  envKeys: string[];
}

export interface ActiveHook {
  event: HookEvent;
  matcher: string;
  command: string;
}

function friendlyModelName(id: string): string {
  if (!id || id === 'default') { return 'Default'; }
  // full API ID: claude-opus-4-7 or claude-opus-4-7[1m]
  const full = id.match(/^claude-([a-z]+)-(\d+)-(\d+)/i);
  if (full) {
    const family = full[1].charAt(0).toUpperCase() + full[1].slice(1);
    return `${family} ${full[2]}.${full[3]}`;
  }
  // short-form: opus[1m], sonnet[4k], haiku, etc.
  const short = id.match(/^([a-z]+)(\[\w+\])?/i);
  if (short) {
    const family = short[1].charAt(0).toUpperCase() + short[1].slice(1);
    return short[2] ? `${family} ${short[2]}` : family;
  }
  return id;
}

export function getActiveModel(projectPath?: string): string {
  const proj = projectPath ? readRaw('project', projectPath) : {};
  const glob = readRaw('global');
  const m = (typeof proj.model === 'string' && proj.model) || (typeof glob.model === 'string' && glob.model) || '';
  return friendlyModelName(m);
}

function readRaw(scope: Scope, projectPath?: string): ClaudeSettings {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(scope, projectPath), 'utf-8')) as ClaudeSettings;
  } catch {
    return {};
  }
}

function writeRaw(settings: ClaudeSettings, scope: Scope, projectPath?: string): void {
  const p = settingsPath(scope, projectPath);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
  fs.writeFileSync(p, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}

export function getActiveMCPs(scope: Scope, projectPath?: string): ActiveMCP[] {
  const s = readRaw(scope, projectPath);
  return Object.entries(s.mcpServers ?? {}).map(([name, cfg]) => ({
    name,
    command: cfg.command,
    args: cfg.args ?? [],
    hasEnv: !!cfg.env && Object.keys(cfg.env).length > 0,
    envKeys: Object.keys(cfg.env ?? {}),
  }));
}

export function addMCPServer(name: string, config: MCPServerConfig, scope: Scope, projectPath?: string): void {
  const s = readRaw(scope, projectPath);
  if (!s.mcpServers) { s.mcpServers = {}; }
  s.mcpServers[name] = config;
  writeRaw(s, scope, projectPath);
}

export function removeMCPServer(name: string, scope: Scope, projectPath?: string): void {
  const s = readRaw(scope, projectPath);
  if (s.mcpServers) { delete s.mcpServers[name]; }
  writeRaw(s, scope, projectPath);
}

export function getActiveHooks(scope: Scope, projectPath?: string): ActiveHook[] {
  const s = readRaw(scope, projectPath);
  const result: ActiveHook[] = [];
  for (const [event, matchers] of Object.entries(s.hooks ?? {})) {
    (matchers ?? []).forEach(m => {
      m.hooks.forEach(h => {
        result.push({ event: event as HookEvent, matcher: m.matcher ?? '*', command: h.command });
      });
    });
  }
  return result;
}

export function addHook(event: HookEvent, matcher: string, command: string, scope: Scope, projectPath?: string): void {
  const s = readRaw(scope, projectPath);
  if (!s.hooks) { s.hooks = {}; }
  if (!s.hooks[event]) { s.hooks[event] = []; }
  s.hooks[event]!.push({ matcher: matcher || undefined, hooks: [{ type: 'command', command }] });
  writeRaw(s, scope, projectPath);
}

export function removeHook(event: HookEvent, command: string, scope: Scope, projectPath?: string): void {
  const s = readRaw(scope, projectPath);
  if (!s.hooks?.[event]) { return; }
  s.hooks[event] = s.hooks[event]!.filter(m => !m.hooks.some(h => h.command === command));
  if (s.hooks[event]!.length === 0) { delete s.hooks[event]; }
  writeRaw(s, scope, projectPath);
}

function disabledHooksPath(scope: Scope, projectPath?: string): string {
  return path.join(path.dirname(settingsPath(scope, projectPath)), '.claude-deck-disabled-hooks.json');
}

function readDisabledHooks(scope: Scope, projectPath?: string): ActiveHook[] {
  try {
    return JSON.parse(fs.readFileSync(disabledHooksPath(scope, projectPath), 'utf-8')) as ActiveHook[];
  } catch {
    return [];
  }
}

function writeDisabledHooks(hooks: ActiveHook[], scope: Scope, projectPath?: string): void {
  const p = disabledHooksPath(scope, projectPath);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
  fs.writeFileSync(p, JSON.stringify(hooks, null, 2) + '\n', 'utf-8');
}

export function getDisabledHooks(scope: Scope, projectPath?: string): ActiveHook[] {
  return readDisabledHooks(scope, projectPath);
}

// Hooks have no native enabled/disabled flag in settings.json, so a disabled hook is
// moved out of settings.json entirely and held in a sidecar file until re-enabled.
export function disableHook(event: HookEvent, command: string, scope: Scope, projectPath?: string): void {
  const s = readRaw(scope, projectPath);
  if (!s.hooks?.[event]) { return; }
  const moved: ActiveHook[] = [];
  s.hooks[event] = s.hooks[event]!.filter(m => {
    const match = m.hooks.some(h => h.command === command);
    if (match) { moved.push({ event, matcher: m.matcher ?? '*', command }); }
    return !match;
  });
  if (s.hooks[event]!.length === 0) { delete s.hooks[event]; }
  writeRaw(s, scope, projectPath);
  writeDisabledHooks([...readDisabledHooks(scope, projectPath), ...moved], scope, projectPath);
}

export function enableHook(event: HookEvent, matcher: string, command: string, scope: Scope, projectPath?: string): void {
  const disabled = readDisabledHooks(scope, projectPath);
  const idx = disabled.findIndex(h => h.event === event && h.matcher === matcher && h.command === command);
  if (idx === -1) { return; }
  disabled.splice(idx, 1);
  writeDisabledHooks(disabled, scope, projectPath);
  addHook(event, matcher === '*' ? '' : matcher, command, scope, projectPath);
}

// --- Permissions -----------------------------------------------------------
export type PermissionList = 'allow' | 'ask' | 'deny';
export const PERMISSION_LISTS: PermissionList[] = ['allow', 'ask', 'deny'];
export const PERMISSION_MODES = ['default', 'acceptEdits', 'plan', 'auto', 'dontAsk', 'bypassPermissions'];

export interface PermissionsInfo {
  allow: string[];
  ask: string[];
  deny: string[];
  defaultMode: string;
}

export function getPermissions(scope: Scope, projectPath?: string): PermissionsInfo {
  const perms = readRaw(scope, projectPath).permissions ?? {};
  const list = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  return {
    allow: list(perms.allow),
    ask: list(perms.ask),
    deny: list(perms.deny),
    defaultMode: typeof perms.defaultMode === 'string' ? perms.defaultMode : '',
  };
}

function assertList(list: string): asserts list is PermissionList {
  if (!PERMISSION_LISTS.includes(list as PermissionList)) { throw new Error(`Unknown permission list: ${list}`); }
}

export function addPermissionRule(list: PermissionList, rule: string, scope: Scope, projectPath?: string): void {
  assertList(list);
  const r = rule.trim();
  if (!r) { throw new Error('Rule is required.'); }
  const s = readRaw(scope, projectPath);
  if (!s.permissions) { s.permissions = {}; }
  const rules = Array.isArray(s.permissions[list]) ? s.permissions[list]! : [];
  if (!rules.includes(r)) { rules.push(r); }
  s.permissions[list] = rules;
  writeRaw(s, scope, projectPath);
}

export function removePermissionRule(list: PermissionList, rule: string, scope: Scope, projectPath?: string): void {
  assertList(list);
  const s = readRaw(scope, projectPath);
  const rules = s.permissions?.[list];
  if (!s.permissions || !Array.isArray(rules)) { return; }
  s.permissions[list] = rules.filter(x => x !== rule);
  if (s.permissions[list]!.length === 0) { delete s.permissions[list]; }
  if (Object.keys(s.permissions).length === 0) { delete s.permissions; }
  writeRaw(s, scope, projectPath);
}

// An empty mode removes the key so Claude Code falls back to its own default.
export function setDefaultMode(mode: string, scope: Scope, projectPath?: string): void {
  if (mode && !PERMISSION_MODES.includes(mode)) { throw new Error(`Unknown permission mode: ${mode}`); }
  const s = readRaw(scope, projectPath);
  if (mode) {
    if (!s.permissions) { s.permissions = {}; }
    s.permissions.defaultMode = mode;
  } else if (s.permissions) {
    delete s.permissions.defaultMode;
    if (Object.keys(s.permissions).length === 0) { delete s.permissions; }
  }
  writeRaw(s, scope, projectPath);
}

// --- Undo ------------------------------------------------------------------
// One-level undo for the last change made through the panel. Before each mutation
// the current text of settings.json and the disabled-hooks sidecar is saved to a
// sidecar next to settings.json; undoLastChange() puts both back exactly as they
// were (a file that did not exist is deleted again) and drops the snapshot.
interface UndoSnapshot { label: string; settings: string | null; disabledHooks: string | null; }

function undoPath(scope: Scope, projectPath?: string): string {
  return path.join(path.dirname(settingsPath(scope, projectPath)), '.claude-deck-undo.json');
}

function readText(p: string): string | null {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return null; }
}

function restoreText(p: string, text: string | null): void {
  if (text === null) { fs.rmSync(p, { force: true }); return; }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text, 'utf-8');
}

export function snapshotForUndo(label: string, scope: Scope, projectPath?: string): void {
  const snap: UndoSnapshot = {
    label,
    settings: readText(settingsPath(scope, projectPath)),
    disabledHooks: readText(disabledHooksPath(scope, projectPath)),
  };
  const p = undoPath(scope, projectPath);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(snap, null, 2) + '\n', 'utf-8');
}

export function getUndoLabel(scope: Scope, projectPath?: string): string | null {
  try {
    return (JSON.parse(fs.readFileSync(undoPath(scope, projectPath), 'utf-8')) as UndoSnapshot).label;
  } catch {
    return null;
  }
}

export function undoLastChange(scope: Scope, projectPath?: string): string | null {
  const up = undoPath(scope, projectPath);
  let snap: UndoSnapshot;
  try { snap = JSON.parse(fs.readFileSync(up, 'utf-8')) as UndoSnapshot; } catch { return null; }
  restoreText(settingsPath(scope, projectPath), snap.settings);
  restoreText(disabledHooksPath(scope, projectPath), snap.disabledHooks);
  fs.rmSync(up, { force: true });
  return snap.label;
}

// --- Lock allowlist -------------------------------------------------------
// Separate from disableHook/enableHook above: those remove a whole hook's
// registration from settings.json, which is the wrong tool for opening one
// path temporarily — it would turn off protection for everything the hook
// covers, not just the one approved write. The allowlist below is a sidecar
// list of explicitly opened path prefixes that a PreToolUse hook (outside
// this extension, in the target project's .claude/scripts/) consults before
// deciding to deny or defer. Default is closed: a path not listed here is
// locked. Opening is manual and does not expire on its own — close it
// explicitly, or leave it open across a session at your own judgment.

export interface AllowlistEntry {
  path: string;
  openedAt: string;
}

function allowlistPath(scope: Scope, projectPath?: string): string {
  return path.join(path.dirname(settingsPath(scope, projectPath)), '.claude-deck-allowlist.json');
}

function readAllowlist(scope: Scope, projectPath?: string): AllowlistEntry[] {
  try {
    return JSON.parse(fs.readFileSync(allowlistPath(scope, projectPath), 'utf-8')) as AllowlistEntry[];
  } catch {
    return [];
  }
}

function writeAllowlist(entries: AllowlistEntry[], scope: Scope, projectPath?: string): void {
  const p = allowlistPath(scope, projectPath);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
  fs.writeFileSync(p, JSON.stringify(entries, null, 2) + '\n', 'utf-8');
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase().replace(/\/+$/, '');
}

export function getAllowlist(scope: Scope, projectPath?: string): AllowlistEntry[] {
  return readAllowlist(scope, projectPath);
}

export function openPath(targetPath: string, scope: Scope, projectPath?: string): void {
  const entries = readAllowlist(scope, projectPath);
  const normalized = normalizePath(targetPath);
  if (entries.some(e => normalizePath(e.path) === normalized)) { return; }
  entries.push({ path: targetPath, openedAt: new Date().toISOString() });
  writeAllowlist(entries, scope, projectPath);
}

export function closePath(targetPath: string, scope: Scope, projectPath?: string): void {
  const entries = readAllowlist(scope, projectPath);
  const normalized = normalizePath(targetPath);
  writeAllowlist(entries.filter(e => normalizePath(e.path) !== normalized), scope, projectPath);
}

// Prefix match: an open entry for a folder covers everything under it.
// A closed-by-default path with no matching entry (exact or ancestor) is locked.
export function isPathAllowed(targetPath: string, scope: Scope, projectPath?: string): boolean {
  const normalized = normalizePath(targetPath);
  return readAllowlist(scope, projectPath).some(e => {
    const openedPrefix = normalizePath(e.path);
    return normalized === openedPrefix || normalized.startsWith(openedPrefix + '/');
  });
}

export interface HealthIssue {
  level: 'error' | 'warn';
  message: string;
}

function commandOnPath(cmd: string): boolean {
  const exts = process.platform === 'win32' ? ['', ...(process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';')] : [''];
  return (process.env.PATH ?? '').split(path.delimiter).some(dir =>
    !!dir && exts.some(ext => fs.existsSync(path.join(dir, cmd + ext))));
}

function commandExists(cmd: string, baseDir: string): boolean {
  if (/[\/]/.test(cmd)) {
    const p = cmd.startsWith('~') ? path.join(os.homedir(), cmd.slice(1)) : path.resolve(baseDir, cmd);
    return fs.existsSync(p);
  }
  return commandOnPath(cmd);
}

// Paths a hook command refers to: absolute, ~ or ./ tokens that end in a file extension.
function hookFilePaths(command: string, projectPath?: string): string[] {
  const out: string[] = [];
  for (const m of command.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) {
    let tok = m[1] ?? m[2] ?? m[3];
    tok = tok.replace(/\$\{CLAUDE_PROJECT_DIR\}|\$CLAUDE_PROJECT_DIR/g, projectPath ?? '');
    if (/:\/\/|[$%*?]/.test(tok) || !/\.\w{1,5}$/.test(tok)) { continue; }
    if (/^([A-Za-z]:[\/]|\/|~[\/]|\.\.?[\/])/.test(tok)) { out.push(tok); }
  }
  return out;
}

export function getHealthIssues(scope: Scope, projectPath?: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const file = settingsPath(scope, projectPath);
  let s: ClaudeSettings;
  try {
    s = JSON.parse(fs.readFileSync(file, 'utf-8')) as ClaudeSettings;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      issues.push({ level: 'error', message: `settings.json is not valid JSON: ${(e as Error).message}` });
    }
    return issues;
  }

  const baseDir = scope === 'project' && projectPath ? projectPath : os.homedir();
  for (const [name, cfg] of Object.entries(s.mcpServers ?? {})) {
    if (!cfg?.command) {
      issues.push({ level: 'error', message: `MCP "${name}" has no command.` });
    } else if (!commandExists(cfg.command, baseDir)) {
      issues.push({ level: 'error', message: `MCP "${name}": command not found: ${cfg.command}` });
    }
  }

  const seen = new Set<string>();
  for (const h of getActiveHooks(scope, projectPath)) {
    for (const p of hookFilePaths(h.command, projectPath)) {
      const resolved = p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : path.resolve(baseDir, p);
      const key = `${h.event}|${resolved}`;
      if (!fs.existsSync(resolved) && !seen.has(key)) {
        seen.add(key);
        issues.push({ level: 'error', message: `${h.event} hook points to a missing file: ${p}` });
      }
    }
  }

  if (scope === 'project' && projectPath) {
    const g = readRaw('global');
    for (const name of Object.keys(s.mcpServers ?? {})) {
      if (g.mcpServers && name in g.mcpServers) {
        issues.push({ level: 'warn', message: `MCP "${name}" is defined in both global and project scope.` });
      }
    }
    const globalHooks = new Set(getActiveHooks('global').map(h => `${h.event}|${h.matcher}|${h.command}`));
    for (const h of getActiveHooks('project', projectPath)) {
      if (globalHooks.has(`${h.event}|${h.matcher}|${h.command}`)) {
        issues.push({ level: 'warn', message: `${h.event} hook duplicates a global hook: ${h.command.slice(0, 80)}` });
      }
    }
  }
  return issues;
}
