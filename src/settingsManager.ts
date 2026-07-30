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
  permissions?: { allow?: string[]; deny?: string[] };
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
