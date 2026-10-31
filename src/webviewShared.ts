import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as manager from './skillsManager';
import * as settings from './settingsManager';
import * as memory from './memoryManager';
import * as git from './gitManager';
import * as sessionsManager from './sessionsManager';
import * as chatManager from './chatManager';
import { Scope } from './skillsManager';
import { CURATED_SKILLS, CATEGORIES, Category } from './data/curatedSkills';
import { TEMPLATES } from './data/templates';
import { MCP_CATALOG, MCP_CATEGORIES } from './data/mcpCatalog';
import { HOOK_TEMPLATES } from './data/hookTemplates';
import { HookEvent } from './settingsManager';

type InMsg =
  | { type: 'getInstalled'; scope: Scope }
  | { type: 'getStack' }
  | { type: 'install'; skillId: string; scope: Scope }
  | { type: 'uninstall'; skillName: string; scope: Scope }
  | { type: 'create'; name: string; category: Category; content: string; scope: Scope }
  | { type: 'previewTemplate'; category: Category; name: string; title: string; description: string }
  | { type: 'addMCP'; serverKey: string; config: settings.MCPServerConfig; scope: Scope }
  | { type: 'removeMCP'; name: string; scope: Scope }
  | { type: 'addHook'; event: HookEvent; matcher: string; command: string; scope: Scope }
  | { type: 'removeHook'; event: HookEvent; command: string; scope: Scope }
  | { type: 'disableHook'; event: HookEvent; command: string; scope: Scope }
  | { type: 'enableHook'; event: HookEvent; matcher: string; command: string; scope: Scope }
  | { type: 'addPermission'; list: settings.PermissionList; rule: string; scope: Scope }
  | { type: 'removePermission'; list: settings.PermissionList; rule: string; scope: Scope }
  | { type: 'setDefaultMode'; mode: string; scope: Scope }
  | { type: 'undo'; scope: Scope }
  | { type: 'readMemory'; filepath: string }
  | { type: 'getGitStatus' }
  | { type: 'gitCommit'; files: string[]; message: string }
  | { type: 'getSessions' }
  | { type: 'checkChatCli' }
  | { type: 'sendChatMessage'; text: string; resumeSessionId?: string }
  | { type: 'openSettings'; scope: Scope }
  | { type: 'openCommandsDir'; scope: Scope };

export interface WebviewContext {
  webview: vscode.Webview;
  projectPath?: string;
  projectName?: string;
}

export function handleMessage(msg: InMsg, ctx: WebviewContext): void {
  const { webview, projectPath } = ctx;
  const pp = projectPath;

  switch (msg.type) {
    case 'getInstalled':
      sendInstalled(ctx, msg.scope);
      break;

    case 'getStack':
      sendStack(ctx);
      break;

    case 'install': {
      const skill = CURATED_SKILLS.find(s => s.id === msg.skillId);
      if (!skill) { return; }
      try {
        manager.installSkill(skill.name, skill.content, msg.scope, pp);
        webview.postMessage({ type: 'installResult', skillId: msg.skillId, ok: true });
        sendInstalled(ctx, msg.scope);
        sendStack(ctx);
      } catch (e) {
        webview.postMessage({ type: 'installResult', skillId: msg.skillId, ok: false, error: String(e) });
      }
      break;
    }

    case 'uninstall': {
      try {
        manager.uninstallSkill(msg.skillName, msg.scope, pp);
        sendInstalled(ctx, msg.scope);
        sendStack(ctx);
      } catch (e) {
        webview.postMessage({ type: 'uninstallResult', ok: false, error: String(e) });
      }
      break;
    }

    case 'create': {
      const safeName = msg.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (!safeName || !/[a-z0-9]/.test(safeName)) { webview.postMessage({ type: 'createResult', ok: false, error: 'Name must contain at least one letter or number.' }); return; }
      try {
        manager.installSkill(safeName, msg.content, msg.scope, pp);
        webview.postMessage({ type: 'createResult', ok: true, name: safeName });
        sendInstalled(ctx, msg.scope);
        sendStack(ctx);
      } catch (e) {
        webview.postMessage({ type: 'createResult', ok: false, error: String(e) });
      }
      break;
    }

    case 'previewTemplate': {
      const tpl = TEMPLATES[msg.category];
      webview.postMessage({
        type: 'templatePreview',
        content: tpl.starter
          .replace(/{name}/g, msg.name || 'my-skill')
          .replace(/{title}/g, msg.title || 'My Skill')
          .replace(/{description}/g, msg.description || 'Describe what this skill does.'),
      });
      break;
    }

    case 'addMCP': {
      try {
        settings.snapshotForUndo(`Add MCP server ${msg.serverKey}`, msg.scope, pp);
        settings.addMCPServer(msg.serverKey, msg.config, msg.scope, pp);
        webview.postMessage({ type: 'mcpResult', ok: true, name: msg.serverKey });
        sendStack(ctx);
      } catch (e) {
        webview.postMessage({ type: 'mcpResult', ok: false, error: String(e) });
      }
      break;
    }

    case 'removeMCP': {
      try {
        settings.snapshotForUndo(`Remove MCP server ${msg.name}`, msg.scope, pp);
        settings.removeMCPServer(msg.name, msg.scope, pp);
        sendStack(ctx);
      } catch (e) {
        webview.postMessage({ type: 'mcpResult', ok: false, error: String(e) });
      }
      break;
    }

    case 'addHook': {
      try {
        settings.snapshotForUndo(`Add ${msg.event} hook`, msg.scope, pp);
        settings.addHook(msg.event, msg.matcher, msg.command, msg.scope, pp);
        webview.postMessage({ type: 'hookResult', ok: true });
        sendStack(ctx);
      } catch (e) {
        webview.postMessage({ type: 'hookResult', ok: false, error: String(e) });
      }
      break;
    }

    case 'removeHook': {
      try {
        settings.snapshotForUndo(`Remove ${msg.event} hook`, msg.scope, pp);
        settings.removeHook(msg.event, msg.command, msg.scope, pp);
        sendStack(ctx);
      } catch (e) {
        webview.postMessage({ type: 'hookResult', ok: false, error: String(e) });
      }
      break;
    }

    case 'disableHook': {
      try {
        settings.snapshotForUndo(`Pause ${msg.event} hook`, msg.scope, pp);
        settings.disableHook(msg.event, msg.command, msg.scope, pp);
        sendStack(ctx);
      } catch (e) {
        webview.postMessage({ type: 'hookResult', ok: false, error: String(e) });
      }
      break;
    }

    case 'enableHook': {
      try {
        settings.snapshotForUndo(`Enable ${msg.event} hook`, msg.scope, pp);
        settings.enableHook(msg.event, msg.matcher, msg.command, msg.scope, pp);
        sendStack(ctx);
      } catch (e) {
        webview.postMessage({ type: 'hookResult', ok: false, error: String(e) });
      }
      break;
    }

    case 'addPermission': {
      try {
        settings.snapshotForUndo(`Add ${msg.list} rule`, msg.scope, pp);
        settings.addPermissionRule(msg.list, msg.rule, msg.scope, pp);
        webview.postMessage({ type: 'permResult', ok: true, message: 'Rule added.' });
        sendStack(ctx);
      } catch (e) {
        webview.postMessage({ type: 'permResult', ok: false, message: String(e) });
      }
      break;
    }

    case 'removePermission': {
      try {
        settings.snapshotForUndo(`Remove ${msg.list} rule`, msg.scope, pp);
        settings.removePermissionRule(msg.list, msg.rule, msg.scope, pp);
        sendStack(ctx);
      } catch (e) {
        webview.postMessage({ type: 'permResult', ok: false, message: String(e) });
      }
      break;
    }

    case 'setDefaultMode': {
      try {
        settings.snapshotForUndo('Change default mode', msg.scope, pp);
        settings.setDefaultMode(msg.mode, msg.scope, pp);
        webview.postMessage({ type: 'permResult', ok: true, message: 'Default mode saved.' });
        sendStack(ctx);
      } catch (e) {
        webview.postMessage({ type: 'permResult', ok: false, message: String(e) });
        sendStack(ctx);
      }
      break;
    }

    case 'undo': {
      try {
        const label = settings.undoLastChange(msg.scope, pp);
        webview.postMessage({ type: 'undoResult', ok: label !== null, label });
        sendStack(ctx);
      } catch (e) {
        webview.postMessage({ type: 'undoResult', ok: false, error: String(e) });
      }
      break;
    }

    case 'readMemory':
      webview.postMessage({ type: 'memoryContent', filepath: msg.filepath, content: memory.readMemoryFile(msg.filepath) });
      break;

    case 'getGitStatus': {
      if (!pp) { webview.postMessage({ type: 'gitStatusData', branch: '', files: [], error: 'No project folder open.' }); break; }
      git.getStatus(pp).then(status => webview.postMessage({ type: 'gitStatusData', ...status }));
      break;
    }

    case 'gitCommit': {
      if (!pp) { webview.postMessage({ type: 'gitCommitResult', ok: false, output: 'No project folder open.' }); break; }
      git.commit(pp, msg.files, msg.message).then(result => {
        webview.postMessage({ type: 'gitCommitResult', ...result });
        if (result.ok) { git.getStatus(pp).then(status => webview.postMessage({ type: 'gitStatusData', ...status })); }
      });
      break;
    }

    case 'getSessions':
      webview.postMessage({ type: 'sessionsData', projects: sessionsManager.getSessions() });
      break;

    case 'checkChatCli':
      chatManager.checkCli().then(result => webview.postMessage({ type: 'chatCliResult', ...result }));
      break;

    case 'sendChatMessage': {
      if (!pp) { webview.postMessage({ type: 'chatError', message: 'Open a project folder to use Chat.' }); break; }
      chatManager.sendMessage(pp, msg.text, msg.resumeSessionId, {
        onChunk: text => webview.postMessage({ type: 'chatChunk', text }),
        onDone: sessionId => webview.postMessage({ type: 'chatDone', sessionId }),
        onError: message => webview.postMessage({ type: 'chatError', message }),
      });
      break;
    }

    case 'openSettings': {
      const sp = settings.settingsPath(msg.scope, pp);
      const dir = path.dirname(sp);
      if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
      if (!fs.existsSync(sp)) { fs.writeFileSync(sp, '{}\n', 'utf-8'); }
      vscode.commands.executeCommand('vscode.open', vscode.Uri.file(sp));
      break;
    }
    case 'openCommandsDir': {
      const cd = manager.commandsDir(msg.scope, pp);
      if (!fs.existsSync(cd)) { fs.mkdirSync(cd, { recursive: true }); }
      vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(cd));
      break;
    }
  }
}

export function sendInstalled(ctx: WebviewContext, scope: Scope): void {
  const skills = manager.getInstalledSkills(scope, ctx.projectPath);
  ctx.webview.postMessage({
    type: 'installedList',
    scope,
    skills,
    installedNames: skills.map(s => s.name),
  });
}

export function sendStack(ctx: WebviewContext): void {
  const { projectPath } = ctx;
  const gSkills = manager.getInstalledSkills('global');
  const pSkills = projectPath ? manager.getInstalledSkills('project', projectPath) : [];
  ctx.webview.postMessage({
    type: 'stackData',
    global: {
      skills: gSkills.length,
      mcps: settings.getActiveMCPs('global'),
      hooks: settings.getActiveHooks('global'),
      disabledHooks: settings.getDisabledHooks('global'),
      undo: settings.getUndoLabel('global'),
      permissions: settings.getPermissions('global'),
      health: settings.getHealthIssues('global'),
    },
    project: {
      available: !!projectPath,
      path: projectPath ?? '',
      skills: pSkills.length,
      mcps: projectPath ? settings.getActiveMCPs('project', projectPath) : [],
      hooks: projectPath ? settings.getActiveHooks('project', projectPath) : [],
      disabledHooks: projectPath ? settings.getDisabledHooks('project', projectPath) : [],
      undo: projectPath ? settings.getUndoLabel('project', projectPath) : null,
      permissions: projectPath ? settings.getPermissions('project', projectPath) : null,
      health: projectPath ? settings.getHealthIssues('project', projectPath) : [],
    },
    memoryFiles: memory.getMemoryFiles(),
    model: settings.getActiveModel(projectPath),
  });
}

const S: Record<string, string> = {
  logo:     `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="17.5" width="20" height="2" rx="0.7" opacity="0.35"/><rect x="2" y="14.5" width="20" height="2" rx="0.7" opacity="0.55"/><rect x="2" y="11.5" width="20" height="2" rx="0.7" opacity="0.75"/><rect x="2" y="2" width="20" height="11" rx="2" opacity="0.15"/><path d="M4 2 h16 a2 2 0 0 1 2 2 v7 a2 2 0 0 1 -2 2 h-16 a2 2 0 0 1 -2 -2 v-7 a2 2 0 0 1 2 -2 z" fill="none" stroke="currentColor" stroke-width="1.4"/><g transform="translate(12,7.5)"><ellipse cx="0" cy="0" rx="0.85" ry="3" transform="rotate(0)"/><ellipse cx="0" cy="0" rx="0.85" ry="3" transform="rotate(60)"/><ellipse cx="0" cy="0" rx="0.85" ry="3" transform="rotate(120)"/><circle cx="0" cy="0" r="1.1"/></g></svg>`,
  layers:   `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M8 1.5 L14 4.5 L8 7.5 L2 4.5 Z"/><path d="M2 8 L8 11 L14 8"/><path d="M2 11.5 L8 14.5 L14 11.5"/></svg>`,
  command:  `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2.5 A1.5 1.5 0 1 0 4.5 5.5 H11.5 A1.5 1.5 0 1 0 11.5 2.5 A1.5 1.5 0 1 0 11.5 5.5 V10.5 A1.5 1.5 0 1 0 11.5 13.5 A1.5 1.5 0 1 0 11.5 10.5 H4.5 A1.5 1.5 0 1 0 4.5 13.5 A1.5 1.5 0 1 0 4.5 10.5 V5.5"/></svg>`,
  plug:     `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 1.5 V4.5"/><path d="M11 1.5 V4.5"/><rect x="3.5" y="4.5" width="9" height="4.5" rx="1"/><path d="M8 9 V12"/><path d="M5.5 12 H10.5 V14"/></svg>`,
  hook:     `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2 V8 A3 3 0 0 1 5 8"/><circle cx="11" cy="2" r="1"/></svg>`,
  brain:    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M8 3 a2 2 0 0 0 -4 0 a2 2 0 0 0 -1 3.5 a2 2 0 0 0 0 3 a2 2 0 0 0 2 3 a2 2 0 0 0 3 0.5"/><path d="M8 3 a2 2 0 0 1 4 0 a2 2 0 0 1 1 3.5 a2 2 0 0 1 0 3 a2 2 0 0 1 -2 3 a2 2 0 0 1 -3 0.5"/><path d="M8 3 V13"/></svg>`,
  clock:    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 4.5 V8 L10.5 9.5"/></svg>`,
  globe:    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M2 8 H14"/><path d="M8 2 a8 6 0 0 1 0 12 a8 6 0 0 1 0 -12"/></svg>`,
  folder:   `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M2 4 a1 1 0 0 1 1 -1 H6.5 L8 4.5 H13 a1 1 0 0 1 1 1 V12 a1 1 0 0 1 -1 1 H3 a1 1 0 0 1 -1 -1 Z"/></svg>`,
  search:   `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 L14 14"/></svg>`,
  arrow:    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3 L10 8 L5 13"/></svg>`,
  external: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3 H13 V7"/><path d="M13 3 L7 9"/><path d="M11 9 V12 a1 1 0 0 1 -1 1 H4 a1 1 0 0 1 -1 -1 V6 a1 1 0 0 1 1 -1 H7"/></svg>`,
  user:     `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="5.5" r="2.5"/><path d="M3 13.5 a5 5 0 0 1 10 0"/></svg>`,
  doc:      `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M4 2 H10 L13 5 V14 H4 Z"/><path d="M10 2 V5 H13"/><path d="M6 8 H11"/><path d="M6 11 H11"/></svg>`,
  cube:     `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M8 1.5 L14 4.5 V11.5 L8 14.5 L2 11.5 V4.5 Z"/><path d="M2 4.5 L8 7.5 L14 4.5"/><path d="M8 7.5 V14.5"/></svg>`,
  monitor:  `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.5" width="12" height="9" rx="1"/><path d="M5.5 14 H10.5"/><path d="M8 11.5 V14"/></svg>`,
  bot:      `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="10" height="8" rx="1.5"/><circle cx="6" cy="9" r="0.5" fill="currentColor"/><circle cx="10" cy="9" r="0.5" fill="currentColor"/><path d="M8 2 V5"/><circle cx="8" cy="2" r="0.5" fill="currentColor"/></svg>`,
  check:    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5 L6.5 12 L13 4.5"/></svg>`,
  plus:     `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 3 V13"/><path d="M3 8 H13"/></svg>`,
  trash:    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4 H13.5"/><path d="M6 4 V2.5 a.5.5 0 0 1 .5-.5 H9.5 a.5.5 0 0 1 .5.5 V4"/><path d="M3.5 4 L4.5 13.5 a.5.5 0 0 0 .5.5 H11 a.5.5 0 0 0 .5-.5 L12.5 4"/></svg>`,
  code:     `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 4 L2 8 L5.5 12"/><path d="M10.5 4 L14 8 L10.5 12"/></svg>`,
  flask:    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 H10"/><path d="M7 2 V6.5 L3.5 12.5 a1 1 0 0 0 .9 1.5 H11.6 a1 1 0 0 0 .9-1.5 L9 6.5 V2"/></svg>`,
  branch:   `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="3.5" r="1.5"/><circle cx="4" cy="12.5" r="1.5"/><circle cx="12" cy="6.5" r="1.5"/><path d="M4 5 V11"/><path d="M4 6.5 a4 4 0 0 0 4 4 H10.5"/></svg>`,
  shield:   `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M8 1.5 L13.5 3.5 V8 a6 6 0 0 1 -5.5 6 a6 6 0 0 1 -5.5 -6 V3.5 Z"/></svg>`,
  rocket:   `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2 a5 5 0 0 1 3 3 L9.5 9.5 L6.5 6.5 Z"/><path d="M6.5 6.5 L4 9 L7 12 L9.5 9.5"/><path d="M5 11 L3 13"/></svg>`,
  database: `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><ellipse cx="8" cy="3.5" rx="5.5" ry="2"/><path d="M2.5 3.5 V8 a5.5 2 0 0 0 11 0 V3.5"/><path d="M2.5 8 V12.5 a5.5 2 0 0 0 11 0 V8"/></svg>`,
  lightning:`<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M9 1.5 L3 9 H7.5 L7 14.5 L13 7 H8.5 Z"/></svg>`,
  chat:     `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M2 3.5 a1 1 0 0 1 1 -1 H13 a1 1 0 0 1 1 1 V9.5 a1 1 0 0 1 -1 1 H6 L3 13 V10.5 H3 a1 1 0 0 1 -1 -1 Z"/></svg>`,
};

const CAT_ICONS: Record<string, string> = {
  code: 'code', testing: 'flask', docs: 'doc', git: 'branch',
  security: 'shield', devops: 'rocket', data: 'database',
};

export function buildWebviewHtml(projectPath?: string, projectName?: string): string {
  const hasProject = !!projectPath;
  const activeModel = settings.getActiveModel(projectPath);
  const skills = CURATED_SKILLS.map(s => ({
    id: s.id, name: s.name, title: s.title,
    description: s.description, category: s.category, source: s.source,
  }));
  const mcpCatalog = MCP_CATALOG.map(m => ({
    id: m.id, name: m.name, serverKey: m.serverKey,
    description: m.description, category: m.category, icon: m.icon,
    npm: m.npm ?? '', configTemplate: m.configTemplate, envVars: m.envVars ?? [],
  }));
  const hookTemplates = HOOK_TEMPLATES.map(t => ({
    id: t.id, name: t.name, description: t.description,
    event: t.event, matcher: t.matcher, command: t.command,
  }));

  const catChips = CATEGORIES.map(c =>
    `<button class="chip" data-scat="${c.id}"><span class="icn">${S[CAT_ICONS[c.id] ?? 'command']}</span><span>${c.label}</span></button>`
  ).join('');

  const mcpCatChips = MCP_CATEGORIES.map(c =>
    `<button class="chip" data-mcat="${c.id}">${c.label}</button>`
  ).join('');

  const createCatOptions = CATEGORIES.map(c =>
    `<option value="${c.id}">${c.label}</option>`
  ).join('');

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
:root {
  --bg:          var(--vscode-editor-background, #1e1e1e);
  --bg-1:        var(--vscode-sideBar-background, #252526);
  --bg-2:        var(--vscode-list-hoverBackground, #2d2d30);
  --bg-input:    var(--vscode-input-background, #1a1a1a);
  --line:        var(--vscode-panel-border, #333335);
  --line-2:      #404044;
  --hairline:    rgba(255,255,255,.06);
  --fg:          var(--vscode-editor-foreground, #e8e8ea);
  --fg-mute:     var(--vscode-descriptionForeground, #a1a1a6);
  --fg-dim:      #6e6e74;
  --fg-faint:    #4a4a50;
  --accent:      #d97757;
  --accent-hi:   #e08e72;
  --accent-bg:   rgba(217,119,87,.12);
  --accent-line: rgba(217,119,87,.28);
  --ok:          #4ade80;
  --err:         #f87171;
  --warn:        #fbbf24;
  --global:      #74a8e8;
  --global-bg:   rgba(116,168,232,.10);
  --global-ln:   rgba(116,168,232,.28);
  --project:     #b89bf0;
  --project-bg:  rgba(184,155,240,.10);
  --project-ln:  rgba(184,155,240,.28);
  --sans: var(--vscode-font-family, -apple-system, 'Segoe UI', system-ui, sans-serif);
  --mono: var(--vscode-editor-font-family, ui-monospace, 'SF Mono', Menlo, monospace);
  --r-sm: 4px;
  --r:    6px;
  --r-lg: 10px;
}
*,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
html,body { height:100%; background:var(--bg); color:var(--fg); font-family:var(--sans); font-size:13px; line-height:1.5; -webkit-font-smoothing:antialiased; }
body { overflow:hidden; display:flex; flex-direction:column; }
.app { display:flex; flex-direction:column; height:100vh; overflow:hidden; }

/* Header */
.hdr { display:flex; align-items:center; gap:12px; padding:14px 18px 12px; border-bottom:1px solid var(--line); flex-shrink:0; }
.hdr-mark { width:36px; height:36px; border-radius:9px; background:linear-gradient(135deg,var(--accent),#b85a3e); display:grid; place-items:center; color:#fff; box-shadow:0 1px 0 rgba(255,255,255,.12) inset,0 1px 2px rgba(0,0,0,.3); flex-shrink:0; }
.hdr-mark svg { width:22px; height:22px; }
.hdr-text { flex:1; min-width:0; }
.hdr-title { font-size:13px; font-weight:600; letter-spacing:-0.01em; }
.hdr-sub { font-size:11px; color:var(--fg-dim); margin-top:1px; }
.scope { display:flex; background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r); padding:2px; gap:2px; }
.scope-btn { border:0; background:transparent; color:var(--fg-mute); font:inherit; font-size:11px; font-weight:500; padding:4px 10px; border-radius:4px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:color .12s,background .12s; max-width:180px; }
.undo-btn { border:1px solid var(--line); background:var(--bg-1); color:var(--fg-mute); font:inherit; font-size:11px; font-weight:500; padding:4px 10px; border-radius:4px; cursor:pointer; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.undo-btn:hover { color:var(--fg); }
.scope-btn .label { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.scope-btn:hover:not(.active):not(.disabled) { color:var(--fg); }
.scope-btn .dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
.scope-btn.global .dot  { background:var(--global); }
.scope-btn.project .dot { background:var(--project); }
.scope-btn.disabled { opacity:.35; cursor:not-allowed; }
.scope-btn.active.global  { background:var(--global-bg);  color:var(--global);  box-shadow:inset 0 0 0 1px var(--global-ln); }
.scope-btn.active.project { background:var(--project-bg); color:var(--project); box-shadow:inset 0 0 0 1px var(--project-ln); }

/* Tabs */
.tabs { display:flex; padding:0 12px; border-bottom:1px solid var(--line); flex-shrink:0; background:var(--bg); }
.tab { border:0; background:transparent; color:var(--fg-mute); font:inherit; font-size:12px; font-weight:500; padding:10px 12px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; position:relative; transition:color .12s; }
.tab svg { width:14px; height:14px; opacity:.85; }
.tab:hover { color:var(--fg); }
.tab.active { color:var(--fg); }
.tab.active::after { content:""; position:absolute; left:8px; right:8px; bottom:-1px; height:2px; background:var(--accent); border-radius:2px 2px 0 0; }
.tab .count { font-size:10px; font-weight:600; padding:1px 6px; border-radius:10px; background:var(--bg-2); color:var(--fg-mute); min-width:18px; text-align:center; }
.tab.active .count { background:var(--accent-bg); color:var(--accent); }

/* Panels */
.panels { flex:1; overflow-y:auto; }
.panel { display:none; padding:18px 18px 32px; max-width:920px; margin:0 auto; }
.panel.active { display:block; }

/* Stack overview */
.overview-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:22px; }
.col-card { background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-lg); overflow:hidden; }
.col-head { display:flex; align-items:center; gap:8px; padding:11px 14px; border-bottom:1px solid var(--hairline); }
.col-head .dot { width:8px; height:8px; border-radius:50%; }
.col-head.global  .dot { background:var(--global);  box-shadow:0 0 0 3px var(--global-bg); }
.col-head.project .dot { background:var(--project); box-shadow:0 0 0 3px var(--project-bg); }
.col-head .title { font-size:12px; font-weight:600; }
.col-head.global  .title { color:var(--global); }
.col-head.project .title { color:var(--project); }
.col-head .path { font-family:var(--mono); font-size:10.5px; color:var(--fg-dim); margin-left:auto; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.col-rows { padding:4px; }
.col-row { display:grid; grid-template-columns:28px 1fr auto auto; align-items:center; gap:10px; padding:9px 10px; border-radius:var(--r); cursor:pointer; transition:background .1s; }
.col-row:hover { background:var(--bg-2); }
.col-row .icn { width:28px; height:28px; border-radius:var(--r-sm); background:var(--bg-2); color:var(--fg-mute); display:grid; place-items:center; }
.col-row .icn svg { width:14px; height:14px; }
.col-row .lbl { font-size:12px; font-weight:500; color:var(--fg); }
.col-row .lbl small { display:block; font-weight:400; color:var(--fg-dim); font-size:10.5px; margin-top:1px; }
.col-row .num { font-size:18px; font-weight:600; color:var(--fg); font-variant-numeric:tabular-nums; letter-spacing:-.02em; }
.col-row .arrow { color:var(--fg-faint); transition:color .12s,transform .12s; }
.col-row:hover .arrow { color:var(--fg-mute); transform:translateX(2px); }
.health-card { margin-top:12px; background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-lg); padding:12px 16px; font-size:12px; }
.health-card .h-title { font-weight:600; margin-bottom:6px; }
.health-card .h-ok { color:var(--fg-dim); }
.health-card .h-item { padding:3px 0; line-height:1.5; word-break:break-word; }
.health-card .h-item.error { color:var(--err); }
.health-card .h-item.warn { color:var(--warn); }
.empty-col { padding:24px 18px; text-align:center; color:var(--fg-dim); font-size:12px; line-height:1.7; }
.empty-col code { font-family:var(--mono); background:var(--bg-2); padding:1px 6px; border-radius:3px; font-size:11px; }

/* Architecture */
.arch { background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-lg); padding:16px 18px 18px; }
.arch-h { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:14px; }
.arch-h h3 { font-size:12px; font-weight:600; letter-spacing:.02em; text-transform:uppercase; color:var(--fg-mute); }
.arch-h .legend { display:flex; gap:12px; font-size:10.5px; color:var(--fg-dim); }
.arch-h .legend i { display:inline-block; width:8px; height:8px; border-radius:2px; margin-right:5px; vertical-align:-1px; }
.arch-h .legend .lg-g { background:var(--global); }
.arch-h .legend .lg-p { background:var(--project); }
.arch-stack { display:flex; flex-direction:column; gap:6px; position:relative; }
.arch-stack::before { content:""; position:absolute; left:28px; top:18px; bottom:18px; width:1px; background:linear-gradient(to bottom,var(--line) 0%,var(--line-2) 50%,var(--line) 100%); z-index:0; }
.arch-row { display:grid; grid-template-columns:32px 1fr auto; align-items:center; gap:12px; padding:11px 14px; background:var(--bg); border:1px solid var(--line); border-radius:var(--r); position:relative; z-index:1; }
.arch-row::before { content:""; position:absolute; left:28px; top:50%; width:14px; height:1px; background:var(--line); transform:translateY(-50%); }
.arch-row .icn { width:28px; height:28px; border-radius:var(--r-sm); background:var(--bg-2); display:grid; place-items:center; color:var(--fg-mute); }
.arch-row .icn svg { width:14px; height:14px; }
.arch-row .name { font-size:12px; font-weight:600; color:var(--fg); }
.arch-row .desc { font-size:10.5px; color:var(--fg-dim); margin-top:1px; }
.arch-row .pills { display:flex; gap:6px; }
.arch-row.live .icn { color:var(--accent); background:var(--accent-bg); }

/* Pills */
.pill { display:inline-flex; align-items:center; gap:5px; font-size:10.5px; font-weight:500; padding:2px 8px; border-radius:11px; background:var(--bg-2); color:var(--fg-mute); line-height:1.6; white-space:nowrap; }
.pill .dot { width:5px; height:5px; border-radius:50%; }
.pill.global  { background:var(--global-bg);  color:var(--global);  box-shadow:inset 0 0 0 1px var(--global-ln); }
.pill.global .dot  { background:var(--global); }
.pill.project { background:var(--project-bg); color:var(--project); box-shadow:inset 0 0 0 1px var(--project-ln); }
.pill.project .dot { background:var(--project); }
.pill.live    { background:rgba(74,222,128,.12); color:var(--ok); box-shadow:inset 0 0 0 1px rgba(74,222,128,.25); }
.pill.muted   { color:var(--fg-faint); }
.pill.accent  { background:var(--accent-bg); color:var(--accent); box-shadow:inset 0 0 0 1px var(--accent-line); }

/* Scope banner */
.scope-banner { display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:var(--r); margin-bottom:14px; font-size:11.5px; font-weight:500; }
.scope-banner.global  { background:var(--global-bg);  color:var(--global);  box-shadow:inset 0 0 0 1px var(--global-ln); }
.scope-banner.project { background:var(--project-bg); color:var(--project); box-shadow:inset 0 0 0 1px var(--project-ln); }
.scope-banner svg { width:14px; height:14px; }
.scope-banner .path { margin-left:auto; font-family:var(--mono); font-size:10.5px; opacity:.85; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* Subtabs */
.subtabs { display:inline-flex; background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r); padding:2px; gap:2px; margin-bottom:14px; }
.subtab { border:0; background:transparent; color:var(--fg-mute); font:inherit; font-size:11px; font-weight:500; padding:4px 10px; border-radius:4px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; }
.subtab.active { background:var(--bg-2); color:var(--fg); }
.subtab .count { font-size:10px; color:var(--fg-faint); }
.subtab.active .count { color:var(--fg-mute); }

/* Search */
.search { position:relative; margin-bottom:10px; }
.search input { width:100%; background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r); padding:7px 10px 7px 32px; font:inherit; font-size:12px; color:var(--fg); outline:none; transition:border-color .12s; }
.search input:focus { border-color:var(--accent-line); box-shadow:0 0 0 3px var(--accent-bg); }
.search input::placeholder { color:var(--fg-faint); }
.search svg { position:absolute; left:10px; top:50%; transform:translateY(-50%); width:14px; height:14px; color:var(--fg-faint); }

/* Chips */
.chips { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:12px; }
.chip { border:1px solid var(--line); background:transparent; color:var(--fg-mute); font:inherit; font-size:11px; font-weight:500; padding:3px 10px; border-radius:12px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:all .1s; }
.chip:hover { color:var(--fg); border-color:var(--line-2); }
.chip.active { background:var(--fg); color:var(--bg); border-color:var(--fg); }
.chip .icn { width:12px; height:12px; }

/* List / Items */
.list { display:flex; flex-direction:column; gap:6px; }
.item { display:grid; grid-template-columns:32px 1fr auto; align-items:center; gap:12px; padding:11px 14px; background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r); transition:border-color .12s; }
.item.cfg-open { align-items:start; }
.mcp-cfg { grid-column:1/-1; display:none; flex-direction:column; gap:8px; border-top:1px solid var(--line); margin-top:4px; padding-top:12px; }
.mcp-cfg.open { display:flex; }
.mcp-cfg-title { font-size:10.5px; font-weight:600; color:var(--fg-mute); text-transform:uppercase; letter-spacing:.06em; }
.mcp-cfg-field { display:flex; flex-direction:column; gap:3px; }
.mcp-cfg-label { font-size:11px; color:var(--fg-mute); font-weight:500; display:flex; align-items:center; gap:4px; font-family:var(--mono); }
.mcp-cfg-req { color:var(--err); font-size:9.5px; font-family:var(--sans); font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
.mcp-cfg-opt { color:var(--fg-faint); font-size:9.5px; font-family:var(--sans); text-transform:uppercase; letter-spacing:.04em; }
.mcp-cfg-input { width:100%; background:var(--bg-input); border:1px solid var(--line); border-radius:var(--r-sm); padding:5px 9px; font-family:var(--mono); font-size:11.5px; color:var(--fg); outline:none; transition:border-color .12s,box-shadow .12s; }
.mcp-cfg-input:focus { border-color:var(--accent-line); box-shadow:0 0 0 2px var(--accent-bg); }
.mcp-cfg-hint { font-size:10.5px; color:var(--fg-faint); line-height:1.4; }
.mcp-cfg-actions { display:flex; gap:6px; padding-top:4px; }
.item:hover { border-color:var(--line-2); }
.item .icn { width:32px; height:32px; border-radius:var(--r-sm); background:var(--bg-2); display:grid; place-items:center; color:var(--fg-mute); flex-shrink:0; }
.item .icn svg { width:15px; height:15px; }
.item .body { min-width:0; }
.item .title { font-family:var(--mono); font-size:12px; font-weight:500; color:var(--fg); display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.item .title .sname { color:var(--accent); }
.item .desc { font-size:11.5px; color:var(--fg-dim); margin-top:3px; line-height:1.45; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.item .meta { display:flex; gap:5px; margin-top:6px; flex-wrap:wrap; }
.tag { font-size:10px; font-weight:500; padding:1px 7px; border-radius:3px; background:var(--bg-2); color:var(--fg-mute); text-transform:lowercase; letter-spacing:.02em; }
.tag.anthropic { background:rgba(217,119,87,.14); color:var(--accent); }
.tag.popular   { background:rgba(251,191,36,.12);  color:var(--warn); }
.tag.community { background:rgba(74,222,128,.12);  color:var(--ok); }

/* Buttons */
.btn { border:1px solid var(--line); background:var(--bg-1); color:var(--fg); font:inherit; font-size:11.5px; font-weight:500; padding:5px 12px; border-radius:var(--r-sm); cursor:pointer; transition:all .1s; display:inline-flex; align-items:center; gap:5px; white-space:nowrap; }
.btn:hover { background:var(--bg-2); border-color:var(--line-2); }
.btn svg { width:12px; height:12px; }
.btn-primary { background:var(--accent); border-color:var(--accent); color:#fff; }
.btn-primary:hover { background:var(--accent-hi); border-color:var(--accent-hi); }
.btn-installed { background:transparent; border-color:rgba(74,222,128,.3); color:var(--ok); cursor:default; }
.btn-installed:hover { background:transparent; }
.btn-installed-rm { background:transparent; border-color:rgba(74,222,128,.3); color:var(--ok); cursor:pointer; transition:all .15s; }
.btn-installed-rm:hover { border-color:rgba(248,113,113,.4); background:rgba(248,113,113,.08); color:var(--err); }
.btn-danger { background:transparent; color:var(--err); border-color:rgba(248,113,113,.3); }
.btn-danger:hover { background:rgba(248,113,113,.08); border-color:var(--err); }
.btn-sm { padding:3px 9px; font-size:11px; }

/* Section headers */
.section-h { display:flex; align-items:baseline; justify-content:space-between; margin:22px 0 10px; }
.section-h:first-child { margin-top:0; }
.section-h h3 { font-size:11px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--fg-mute); }
.empty { text-align:center; color:var(--fg-dim); font-size:12px; padding:24px 0; background:var(--bg-1); border:1px dashed var(--line); border-radius:var(--r); }

/* Forms */
.form-group { margin-bottom:14px; }
.form-label { display:block; font-size:11px; font-weight:500; color:var(--fg-mute); margin-bottom:5px; letter-spacing:.04em; text-transform:uppercase; }
.form-input,.form-select,.form-textarea { width:100%; background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r); padding:7px 10px; font:inherit; font-size:12px; color:var(--fg); outline:none; transition:border-color .12s; }
.form-input:focus,.form-select:focus,.form-textarea:focus { border-color:var(--accent-line); box-shadow:0 0 0 3px var(--accent-bg); }
.form-textarea { font-family:var(--mono); font-size:11px; resize:vertical; min-height:120px; }
.form-select { cursor:pointer; }
.status { font-size:11.5px; padding:8px 12px; border-radius:var(--r); margin-top:10px; }
.status.ok  { background:rgba(74,222,128,.1);  color:var(--ok);  border:1px solid rgba(74,222,128,.25); }
.status.err { background:rgba(248,113,113,.1); color:var(--err); border:1px solid rgba(248,113,113,.25); }

/* Scrollbar */
::-webkit-scrollbar { width:8px; height:8px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:var(--line); border-radius:4px; }
::-webkit-scrollbar-thumb:hover { background:var(--line-2); }
</style>
</head>
<body>
<div class="app">

  <!-- Header -->
  <div class="hdr">
    <div class="hdr-mark">${S.logo}</div>
    <div class="hdr-text">
      <div class="hdr-title">Claude Deck</div>
      <div class="hdr-sub">Skills · MCP · Hooks · Memory</div>
    </div>
    <button class="undo-btn" id="undoBtn" style="display:none" onclick="undoLast()"><span id="undoLabel">Undo</span></button>
    <div class="scope">
      <button class="scope-btn global${hasProject ? '' : ' active'}" id="scopeGlobal" onclick="setScope('global')">
        <i class="dot"></i><span class="label">Global</span>
      </button>
      <button class="scope-btn project${hasProject ? ' active' : ' disabled'}" id="scopeProject"
        onclick="${hasProject ? "setScope('project')" : ''}">
        <i class="dot"></i><span class="label">${projectName ?? 'Project'}</span>
      </button>
    </div>
  </div>

  <!-- Tabs -->
  <div class="tabs">
    <button class="tab active" data-tab="stack">${S.layers}<span>Stack</span></button>
    <button class="tab" data-tab="skills">${S.command}<span>Skills</span><span class="count" id="cnt-skills">0</span></button>
    <button class="tab" data-tab="mcp">${S.plug}<span>MCP</span><span class="count" id="cnt-mcp">0</span></button>
    <button class="tab" data-tab="hooks">${S.hook}<span>Hooks</span><span class="count" id="cnt-hooks">0</span></button>
    <button class="tab" data-tab="perms">${S.shield}<span>Permissions</span><span class="count" id="cnt-perms">0</span></button>
    <button class="tab" data-tab="memory">${S.brain}<span>Memory</span><span class="count" id="cnt-memory">0</span></button>
    <button class="tab" data-tab="git">${S.branch}<span>Git</span></button>
    <button class="tab" data-tab="sessions">${S.clock}<span>Sessions</span></button>
    <button class="tab" data-tab="chat">${S.chat}<span>Chat</span></button>
  </div>

  <div class="panels">

    <!-- STACK -->
    <div class="panel active" id="panel-stack">
      <div id="stack-overview-card" style="margin-bottom:22px"></div>
      <div class="arch">
        <div class="arch-h">
          <h3>Architecture</h3>
        </div>
        <div class="arch-stack">
          <div class="arch-row">
            <div class="icn">${S.doc}</div>
            <div><div class="name">System Prompt</div><div class="desc">Skills + Memory injected at session start</div></div>
            <div class="pills"><span class="pill" id="arch-skills-pill"><i class="dot"></i><span id="arch-skills">0</span> skills</span></div>
          </div>
          <div class="arch-row live">
            <div class="icn">${S.bot}</div>
            <div><div class="name">Orchestrator</div><div class="desc" id="orchestrator-model">${activeModel}</div></div>
            <div class="pills"><span class="pill live">active</span></div>
          </div>
          <div class="arch-row">
            <div class="icn">${S.layers}</div>
            <div><div class="name">Capabilities</div><div class="desc">Skills · MCP · Hooks · Native tools</div></div>
            <div class="pills"><span class="pill" id="arch-total-pill"><i class="dot"></i><span id="arch-total">0</span> active</span></div>
          </div>
          <div class="arch-row">
            <div class="icn">${S.cube}</div>
            <div><div class="name">Artifacts</div><div class="desc">DOCX · PPTX · Code · SVG</div></div>
            <div class="pills"><span class="pill muted">5 formats</span></div>
          </div>
          <div class="arch-row">
            <div class="icn">${S.monitor}</div>
            <div><div class="name">Delivery</div><div class="desc">Claude Code · API · Claude.ai</div></div>
            <div class="pills"><span class="pill accent">Claude Code</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- SKILLS -->
    <div class="panel" id="panel-skills">
      <div class="scope-banner global" id="skills-banner">
        <span id="skills-banner-icon">${S.globe}</span>
        <span id="skills-banner-label">Global</span>
        <span class="path" id="skills-banner-path">~/.claude/commands/</span>
      </div>
      <div class="subtabs">
        <button class="subtab active" data-ssub="browse">Browse</button>
        <button class="subtab" data-ssub="installed">Installed <span class="count" id="ssub-inst-count">0</span></button>
        <button class="subtab" data-ssub="create">${S.plus}<span>Create</span></button>
      </div>
      <div id="skills-browse">

        <div class="chips">
          <button class="chip active" data-scat="all"><span>All</span></button>
          ${catChips}
        </div>
        <div class="list" id="skill-list"></div>
      </div>
      <div id="skills-installed" style="display:none">
        <div class="section-h">
          <h3 id="inst-path">~/.claude/commands/</h3>
          <button class="btn btn-sm" onclick="openCommandsDir()">${S.external}<span>Open</span></button>
        </div>
        <div class="list" id="installed-list"></div>
      </div>
      <div id="skills-create" style="display:none">
        <div class="form-group">
          <label class="form-label">Skill name (slug)</label>
          <input class="form-input" id="create-name" placeholder="my-skill" oninput="previewCreateTemplate()">
        </div>
        <div class="form-group">
          <label class="form-label">Title</label>
          <input class="form-input" id="create-title" placeholder="My Skill" oninput="previewCreateTemplate()">
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input class="form-input" id="create-desc" placeholder="What this skill does" oninput="previewCreateTemplate()">
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-select" id="create-cat" onchange="previewCreateTemplate()">
            ${createCatOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Content (Markdown)</label>
          <textarea class="form-textarea" id="create-content"></textarea>
        </div>
        <button class="btn btn-primary" id="create-submit-btn" onclick="createSkill()">${S.plus}<span>Create Skill</span></button>
        <div id="create-status"></div>
      </div>
    </div>

    <!-- MCP -->
    <div class="panel" id="panel-mcp">
      <div class="scope-banner global" id="mcp-banner">
        <span id="mcp-banner-icon">${S.globe}</span>
        <span id="mcp-banner-label">Global</span>
        <span class="path" id="mcp-banner-path">~/.claude/settings.json</span>
      </div>
      <div class="section-h">
        <h3>Active MCP servers</h3>
        <button class="btn btn-sm" onclick="openSettings()">${S.external}<span>settings.json</span></button>
      </div>
      <div class="list" id="mcp-active-list"></div>
      <div class="section-h"><h3>Add from catalog</h3></div>
      <div class="chips" id="mcp-cat-chips">
        <button class="chip active" data-mcat="all"><span>All</span></button>
        ${mcpCatChips}
      </div>
      <div class="list" id="mcp-catalog-list"></div>
      <div class="section-h" style="margin-top:22px"><h3>Add custom server</h3></div>
      <div class="form-group">
        <label class="form-label">Server key</label>
        <input class="form-input" id="mcp-name" placeholder="my-server">
      </div>
      <div class="form-group">
        <label class="form-label">Command</label>
        <input class="form-input" id="mcp-cmd" placeholder="npx">
      </div>
      <div class="form-group">
        <label class="form-label">Args (space-separated)</label>
        <input class="form-input" id="mcp-args" placeholder="-y @scope/mcp-server">
      </div>
      <button class="btn btn-primary" onclick="addCustomMCP()">${S.plus}<span>Add Server</span></button>
      <div id="mcp-status"></div>
    </div>

    <!-- HOOKS -->
    <div class="panel" id="panel-hooks">
      <div class="scope-banner global" id="hooks-banner">
        <span id="hooks-banner-icon">${S.globe}</span>
        <span id="hooks-banner-label">Global</span>
        <span class="path" id="hooks-banner-path">~/.claude/settings.json</span>
      </div>
      <div class="section-h">
        <h3>Active hooks</h3>
        <button class="btn btn-sm" onclick="openSettings()">${S.external}<span>settings.json</span></button>
      </div>
      <div class="list" id="hooks-active-list"></div>
      <div class="section-h" style="margin-top:22px"><h3>Disabled hooks</h3></div>
      <div class="list" id="hooks-disabled-list"></div>
      <div class="section-h"><h3>Add from templates</h3></div>
      <div class="list" id="hooks-templates-list"></div>
      <div class="section-h" style="margin-top:22px"><h3>Add custom hook</h3></div>
      <div class="form-group">
        <label class="form-label">Event</label>
        <select class="form-select" id="hook-event">
          <option value="PreToolUse">PreToolUse</option>
          <option value="PostToolUse">PostToolUse</option>
          <option value="Stop">Stop</option>
          <option value="Notification">Notification</option>
          <option value="UserPromptSubmit">UserPromptSubmit</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Matcher (tool name or *)</label>
        <input class="form-input" id="hook-matcher" placeholder="*">
      </div>
      <div class="form-group">
        <label class="form-label">Command</label>
        <input class="form-input" id="hook-cmd" placeholder="echo hook fired">
      </div>
      <button class="btn btn-primary" onclick="addCustomHook()">${S.plus}<span>Add Hook</span></button>
      <div id="hooks-status"></div>
    </div>

    <!-- PERMISSIONS -->
    <div class="panel" id="panel-perms">
      <div class="scope-banner global" id="perms-banner">
        <span id="perms-banner-icon">${S.globe}</span>
        <span id="perms-banner-label">Global</span>
        <span class="path" id="perms-banner-path">~/.claude/settings.json</span>
      </div>
      <div class="section-h">
        <h3>Default mode</h3>
        <button class="btn btn-sm" onclick="openSettings()">${S.external}<span>settings.json</span></button>
      </div>
      <div class="form-group">
        <select class="form-select" id="perm-mode" onchange="changeDefaultMode()">
          <option value="">(not set)</option>
          <option value="default">default — ask before most actions</option>
          <option value="acceptEdits">acceptEdits — auto-accept file edits</option>
          <option value="plan">plan — read-only planning</option>
          <option value="auto">auto — classifier decides (global only)</option>
          <option value="dontAsk">dontAsk — deny anything not allowed</option>
          <option value="bypassPermissions">bypassPermissions — no prompts (dangerous)</option>
        </select>
        <div class="desc" id="perm-mode-note" style="margin-top:6px"></div>
      </div>
      <div class="section-h" style="margin-top:22px"><h3>Allow</h3></div>
      <div class="list" id="perm-list-allow"></div>
      <div class="section-h" style="margin-top:22px"><h3>Ask</h3></div>
      <div class="list" id="perm-list-ask"></div>
      <div class="section-h" style="margin-top:22px"><h3>Deny</h3></div>
      <div class="list" id="perm-list-deny"></div>
      <div class="section-h" style="margin-top:22px"><h3>Add rule</h3></div>
      <div class="form-group">
        <label class="form-label">List</label>
        <select class="form-select" id="perm-add-list">
          <option value="allow">allow</option>
          <option value="ask">ask</option>
          <option value="deny">deny</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Rule (e.g. Bash(git status), Read(./src/**), mcp__server__tool)</label>
        <input class="form-input" id="perm-add-rule" placeholder="Bash(git status)">
      </div>
      <button class="btn btn-primary" onclick="addPermission()">${S.plus}<span>Add Rule</span></button>
      <div id="perm-status"></div>
    </div>

    <!-- MEMORY -->
    <div class="panel" id="panel-memory">
      <div class="section-h">
        <h3>Memory files</h3>
        <span style="font-family:var(--mono);font-size:11px;color:var(--fg-dim)">~/.claude/projects/*/memory/</span>
      </div>
      <div class="list" id="memory-list"></div>
      <div id="memory-viewer" style="display:none;margin-top:16px">
        <div class="section-h" style="margin-top:0">
          <h3 id="memory-viewer-name"></h3>
          <button class="btn btn-sm" onclick="closeMemoryViewer()">Close</button>
        </div>
        <pre id="memory-viewer-content" style="background:var(--bg-1);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;font-family:var(--mono);font-size:11px;color:var(--fg-mute);overflow:auto;max-height:400px;white-space:pre-wrap;word-break:break-word"></pre>
      </div>
    </div>

    <!-- GIT -->
    <div class="panel" id="panel-git">
      <div id="git-no-project" style="display:none" class="empty">Open a project folder to use Git.</div>
      <div id="git-content">
        <div class="section-h">
          <h3>Changes <span id="git-branch" class="tag" style="margin-left:8px"></span></h3>
          <button class="btn btn-sm" onclick="requestGitStatus()">Refresh</button>
        </div>
        <div class="list" id="git-files-list"></div>
        <div class="form-group" style="margin-top:16px">
          <label class="form-label">Commit message</label>
          <textarea class="form-textarea" id="git-commit-msg" placeholder="Describe the change"></textarea>
        </div>
        <button class="btn btn-primary" onclick="doGitCommit()">${S.check}<span>Commit</span></button>
        <div id="git-status"></div>
      </div>
    </div>

    <!-- SESSIONS -->
    <div class="panel" id="panel-sessions">
      <div class="section-h">
        <h3>Claude sessions</h3>
        <span style="font-family:var(--mono);font-size:11px;color:var(--fg-dim)">~/.claude/projects/*/*.jsonl</span>
      </div>
      <div class="list" id="sessions-list"></div>
    </div>

    <!-- CHAT -->
    <div class="panel" id="panel-chat">
      <div class="section-h">
        <h3>Chat</h3>
        <button class="btn btn-sm" onclick="checkChatCli()">Test connection</button>
      </div>
      <div id="chat-cli-status" class="empty">Click "Test connection" to check the claude CLI.</div>
      <div id="chat-messages" style="margin-top:14px;display:flex;flex-direction:column;gap:10px;max-height:420px;overflow:auto"></div>
      <div class="form-group" style="margin-top:14px">
        <textarea class="form-textarea" id="chat-input" placeholder="Message Claude…" rows="3"></textarea>
      </div>
      <button class="btn btn-primary" id="chat-send-btn" onclick="sendChat()">${S.chat}<span>Send</span></button>
      <div id="chat-status"></div>
    </div>

  </div>
</div>
<script>
const vscode = acquireVsCodeApi();
const SKILLS_DATA = ${JSON.stringify(skills)};
const MCP_CATALOG_DATA = ${JSON.stringify(mcpCatalog)};
const HOOK_TEMPLATES_DATA = ${JSON.stringify(hookTemplates)};
const HAS_PROJECT = ${JSON.stringify(hasProject)};
const PROJECT_PATH = ${JSON.stringify(projectPath ?? '')};
const PROJECT_NAME = ${JSON.stringify(projectName ?? 'Project')};
const GLOBE_SVG = ${JSON.stringify(S.globe)};
const FOLDER_SVG = ${JSON.stringify(S.folder)};
const SHIELD_SVG = ${JSON.stringify(S.shield)};

let scope = HAS_PROJECT ? 'project' : 'global';
let stackData = null;
let installedGlobal = [];
let installedProject = [];
let skillCatFilter = 'all';
let mcpCatFilter = 'all';
let activeHooks = [];
let disabledHooks = [];
let editingSkillName = null;
let removePending = {};

// ── Scope ─────────────────────────────────────────────────────
function setScope(s) {
  scope = s;
  document.getElementById('scopeGlobal').classList.toggle('active', s === 'global');
  document.getElementById('scopeProject').classList.toggle('active', s === 'project');
  updateScopeBanners();
  updateUndo();
  renderStack();
  renderSkillList();
  renderInstalledList();
  renderMCPActive();
  renderMCPCatalog();
  renderHooksActive();
  renderHooksDisabled();
  renderPermissions();
  updateCounts();
  vscode.postMessage({ type: 'getInstalled', scope: s });
}

function updateUndo() {
  var btn = document.getElementById('undoBtn');
  if (!btn) return;
  var d = stackData ? (scope === 'global' ? stackData.global : stackData.project) : null;
  var label = d && d.undo ? d.undo : '';
  btn.style.display = label ? '' : 'none';
  btn.title = label ? 'Undo: ' + label : '';
  document.getElementById('undoLabel').textContent = label ? 'Undo: ' + label : 'Undo';
}
function undoLast() { vscode.postMessage({ type: 'undo', scope: scope }); }

function updateScopeBanners() {
  var defs = [
    { prefix: 'skills', globalPath: '~/.claude/commands/',     projSuffix: '/.claude/commands/'  },
    { prefix: 'mcp',    globalPath: '~/.claude/settings.json', projSuffix: '/.claude/settings.json' },
    { prefix: 'hooks',  globalPath: '~/.claude/settings.json', projSuffix: '/.claude/settings.json' },
    { prefix: 'perms',  globalPath: '~/.claude/settings.json', projSuffix: '/.claude/settings.json' },
  ];
  defs.forEach(function(d) {
    var banner  = document.getElementById(d.prefix + '-banner');
    var iconEl  = document.getElementById(d.prefix + '-banner-icon');
    var labelEl = document.getElementById(d.prefix + '-banner-label');
    var pathEl  = document.getElementById(d.prefix + '-banner-path');
    if (!banner) return;
    banner.className = 'scope-banner ' + scope;
    if (scope === 'global') {
      iconEl.innerHTML  = GLOBE_SVG;
      labelEl.textContent = 'Global';
      pathEl.textContent  = d.globalPath;
    } else {
      iconEl.innerHTML  = FOLDER_SVG;
      labelEl.textContent = PROJECT_NAME;
      pathEl.textContent  = PROJECT_PATH + d.projSuffix;
    }
  });
  var instPath = document.getElementById('inst-path');
  if (instPath) instPath.textContent = scope === 'global' ? '~/.claude/commands/' : PROJECT_PATH + '/.claude/commands/';
}

// ── Tabs ──────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var tabId = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('panel-' + tabId).classList.add('active');
    if (tabId === 'git') { requestGitStatus(); }
    if (tabId === 'sessions') { requestSessions(); }
  });
});

// ── Subtabs (skills) ──────────────────────────────────────────
document.querySelectorAll('.subtab').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var sub = btn.dataset.ssub;
    if (sub === 'create') { resetCreateForm(); }
    document.querySelectorAll('.subtab').forEach(function(t) { t.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('skills-browse').style.display    = sub === 'browse'    ? '' : 'none';
    document.getElementById('skills-installed').style.display = sub === 'installed' ? '' : 'none';
    document.getElementById('skills-create').style.display    = sub === 'create'    ? '' : 'none';
  });
});

function resetCreateForm() {
  if (!editingSkillName) return;
  editingSkillName = null;
  ['create-name','create-title','create-desc','create-content'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var btn = document.getElementById('create-submit-btn');
  if (btn) { var sp = btn.querySelector('span'); if (sp) sp.textContent = 'Create Skill'; }
}

// ── Category chips (skills) ───────────────────────────────────
document.querySelectorAll('.chip[data-scat]').forEach(function(chip) {
  chip.addEventListener('click', function() {
    skillCatFilter = chip.dataset.scat;
    document.querySelectorAll('.chip[data-scat]').forEach(function(c) { c.classList.remove('active'); });
    chip.classList.add('active');
    renderSkillList();
  });
});

// ── Category chips (mcp) ──────────────────────────────────────
document.querySelectorAll('.chip[data-mcat]').forEach(function(chip) {
  chip.addEventListener('click', function() {
    mcpCatFilter = chip.dataset.mcat;
    document.querySelectorAll('.chip[data-mcat]').forEach(function(c) { c.classList.remove('active'); });
    chip.classList.add('active');
    renderMCPCatalog();
  });
});

// ── Stack ─────────────────────────────────────────────────────
var CMD_SVG     = ${JSON.stringify(S.command)};
var PLUG_SVG    = ${JSON.stringify(S.plug)};
var HOOK_SVG    = ${JSON.stringify(S.hook)};
var ARROW_SVG   = ${JSON.stringify(S.arrow)};
var TRASH_SVG   = ${JSON.stringify(S.trash)};
var PLUS_SVG    = ${JSON.stringify(S.plus)};
var CHECK_SVG   = ${JSON.stringify(S.check)};
var BRAIN_SVG   = ${JSON.stringify(S.brain)};
var CLOCK_SVG   = ${JSON.stringify(S.clock)};
var LIGHT_SVG   = ${JSON.stringify(S.lightning)};
var EXT_SVG     = ${JSON.stringify(S.external)};
var CAT_ICONS_MAP = ${JSON.stringify(CAT_ICONS)};
var ICON_SVG_MAP = {
  code:     ${JSON.stringify(S.code)},
  flask:    ${JSON.stringify(S.flask)},
  doc:      ${JSON.stringify(S.doc)},
  branch:   ${JSON.stringify(S.branch)},
  shield:   ${JSON.stringify(S.shield)},
  rocket:   ${JSON.stringify(S.rocket)},
  database: ${JSON.stringify(S.database)},
  command:  ${JSON.stringify(S.command)},
};

function getSkillIcon(category) {
  var key = CAT_ICONS_MAP[category];
  return ICON_SVG_MAP[key] || ICON_SVG_MAP.command;
}

function goToTab(tabId, scp) {
  if (scp && scp !== scope) {
    scope = scp;
    document.getElementById(scp === 'global' ? 'scopeGlobal' : 'scopeProject').click();
  }
  document.querySelector('.tab[data-tab="' + tabId + '"]').click();
}

function renderHealth(issues) {
  var body = issues.length
    ? issues.map(function(i) { return '<div class="h-item ' + i.level + '">' + (i.level === 'error' ? '✖ ' : '⚠ ') + e(i.message) + '</div>'; }).join('')
    : '<div class="h-ok">✔ No problems found in settings, MCP servers or hooks.</div>';
  return '<div class="health-card"><div class="h-title">Health check</div>' + body + '</div>';
}

function renderStack() {
  var el = document.getElementById('stack-overview-card');
  if (!el) return;

  var isGlobal = scope === 'global';
  var scopeClass = isGlobal ? 'global' : 'project';
  var title = isGlobal ? 'Global' : PROJECT_NAME;
  var path  = isGlobal ? '~/.claude/' : PROJECT_PATH + '/.claude/';

  if (!isGlobal && !HAS_PROJECT) {
    el.innerHTML = '<div class="col-card">' +
      '<div class="col-head project"><i class="dot"></i><span class="title">' + e(PROJECT_NAME) + '</span></div>' +
      '<div class="empty-col">Open a workspace folder<br>to manage project-level config.<br><br>Settings live in <code>.claude/</code></div>' +
    '</div>';
    return;
  }

  if (!stackData) {
    el.innerHTML = '<div class="col-card"><div class="col-head ' + scopeClass + '"><i class="dot"></i><span class="title">' + e(title) + '</span><span class="path">' + e(path) + '</span></div><div class="empty-col">Loading…</div></div>';
    return;
  }

  var d = isGlobal ? stackData.global : stackData.project;
  var skills = d.skills;
  var mcps   = d.mcps.length;
  var hooks  = d.hooks.length;
  var total  = skills + mcps + hooks;

  el.innerHTML = '<div class="col-card">' +
    '<div class="col-head ' + scopeClass + '"><i class="dot"></i><span class="title">' + e(title) + '</span><span class="path">' + e(path) + '</span></div>' +
    '<div class="col-rows">' +
      '<div class="col-row" data-goto="skills" data-scp="' + scope + '">' +
        '<div class="icn">' + CMD_SVG + '</div>' +
        '<div class="lbl">Skills<small>slash commands</small></div>' +
        '<div class="num">' + skills + '</div>' +
        '<div class="arrow">' + ARROW_SVG + '</div>' +
      '</div>' +
      '<div class="col-row" data-goto="mcp" data-scp="' + scope + '">' +
        '<div class="icn">' + PLUG_SVG + '</div>' +
        '<div class="lbl">MCP servers<small>external tools</small></div>' +
        '<div class="num">' + mcps + '</div>' +
        '<div class="arrow">' + ARROW_SVG + '</div>' +
      '</div>' +
      '<div class="col-row" data-goto="hooks" data-scp="' + scope + '">' +
        '<div class="icn">' + HOOK_SVG + '</div>' +
        '<div class="lbl">Hooks<small>pre/post tool events</small></div>' +
        '<div class="num">' + hooks + '</div>' +
        '<div class="arrow">' + ARROW_SVG + '</div>' +
      '</div>' +
    '</div>' +
  '</div>' + renderHealth(d.health || []);

  // Update arch pills to reflect current scope
  var pill1 = document.getElementById('arch-skills-pill');
  var pill2 = document.getElementById('arch-total-pill');
  if (pill1) pill1.className = 'pill ' + scopeClass;
  if (pill2) pill2.className = 'pill ' + scopeClass;
  setInner('arch-skills', skills);
  setInner('arch-total',  total);

  updateCounts();
}

// ── Skills ────────────────────────────────────────────────────
function renderSkillList() {
  var installedSet = new Set((scope === 'global' ? installedGlobal : installedProject).map(function(s) { return s.name; }));
  var list = SKILLS_DATA.slice();
  if (skillCatFilter !== 'all') list = list.filter(function(s) { return s.category === skillCatFilter; });
  var el = document.getElementById('skill-list');
  if (!el) return;
  if (list.length === 0) { el.innerHTML = '<div class="empty">No skills match your filter.</div>'; return; }
  el.innerHTML = list.map(function(s) {
    var inst = installedSet.has(s.name);
    var actionBtn = inst
      ? '<button class="btn btn-installed-rm btn-sm" data-action="uninstall" data-id="' + e(s.name) + '">' + CHECK_SVG + '<span>Installed</span></button>'
      : '<button class="btn btn-primary btn-sm" data-action="install" data-id="' + e(s.id) + '">' + PLUS_SVG + '<span>Install</span></button>';
    return '<div class="item">' +
      '<div class="icn">' + getSkillIcon(s.category) + '</div>' +
      '<div class="body">' +
        '<div class="title"><span class="sname">/' + e(s.name) + '</span><span>' + e(s.title) + '</span></div>' +
        '<div class="desc">' + e(s.description) + '</div>' +
        '<div class="meta"><span class="tag ' + e(s.source) + '">' + e(s.source) + '</span><span class="tag">' + e(s.category) + '</span></div>' +
      '</div>' +
      actionBtn +
    '</div>';
  }).join('');
}

function renderInstalledList() {
  var arr = scope === 'global' ? installedGlobal : installedProject;
  var el = document.getElementById('installed-list');
  if (!el) return;
  setInner('ssub-inst-count', arr.length);
  if (arr.length === 0) { el.innerHTML = '<div class="empty">No skills installed in this scope yet.</div>'; return; }
  el.innerHTML = arr.map(function(sk) {
    var meta = SKILLS_DATA.find(function(x) { return x.name === sk.name; });
    var armId = 'arm-uninst-' + sk.name.replace(/[^a-z0-9]/g, '-');
    return '<div class="item">' +
      '<div class="icn">' + CMD_SVG + '</div>' +
      '<div class="body">' +
        '<div class="title"><span class="sname">/' + e(sk.name) + '</span></div>' +
        (meta ? '<div class="desc">' + e(meta.description) + '</div>' : '') +
      '</div>' +
      '<button class="btn btn-sm" data-action="edit-skill" data-id="' + e(sk.name) + '">Edit</button>' +
      '<button class="btn btn-danger btn-sm" data-action="uninstall" data-id="' + e(sk.name) + '">' + TRASH_SVG + '<span>Remove</span></button>' +
    '</div>';
  }).join('');
}

function installSkill(skillId) { vscode.postMessage({ type: 'install', skillId: skillId, scope: scope }); }
function uninstallSkill(name)  { vscode.postMessage({ type: 'uninstall', skillName: name, scope: scope }); }
function openCommandsDir()     { vscode.postMessage({ type: 'openCommandsDir', scope: scope }); }

function previewCreateTemplate() {
  var cat = document.getElementById('create-cat') ? document.getElementById('create-cat').value : '';
  var name = document.getElementById('create-name') ? document.getElementById('create-name').value : '';
  var title = document.getElementById('create-title') ? document.getElementById('create-title').value : '';
  var desc = document.getElementById('create-desc') ? document.getElementById('create-desc').value : '';
  if (cat) vscode.postMessage({ type: 'previewTemplate', category: cat, name: name, title: title, description: desc });
}

function createSkill() {
  var name = document.getElementById('create-name') ? document.getElementById('create-name').value.trim() : '';
  var cat  = document.getElementById('create-cat')  ? document.getElementById('create-cat').value  : '';
  var content = document.getElementById('create-content') ? document.getElementById('create-content').value.trim() : '';
  if (!name || !content) { showStatus('create-status', 'Name and content are required.', false); return; }
  if (editingSkillName && editingSkillName !== name) {
    vscode.postMessage({ type: 'uninstall', skillName: editingSkillName, scope: scope });
  }
  vscode.postMessage({ type: 'create', name: name, category: cat, content: content, scope: scope });
}

function editSkill(name) {
  var arr = scope === 'global' ? installedGlobal : installedProject;
  var sk = arr.find(function(s) { return s.name === name; });
  if (!sk) return;
  editingSkillName = name;
  document.querySelectorAll('.subtab').forEach(function(t) { t.classList.toggle('active', t.dataset.ssub === 'create'); });
  document.getElementById('skills-browse').style.display    = 'none';
  document.getElementById('skills-installed').style.display = 'none';
  document.getElementById('skills-create').style.display    = '';
  var nameEl = document.getElementById('create-name'); if (nameEl) nameEl.value = sk.name;
  var contentEl = document.getElementById('create-content'); if (contentEl) contentEl.value = sk.content;
  var titleEl = document.getElementById('create-title'); if (titleEl) titleEl.value = '';
  var descEl = document.getElementById('create-desc'); if (descEl) descEl.value = '';
  var btn = document.getElementById('create-submit-btn');
  if (btn) { var sp = btn.querySelector('span'); if (sp) sp.textContent = 'Save Changes'; }
}

// ── MCP ───────────────────────────────────────────────────────
function renderMCPActive() {
  var el = document.getElementById('mcp-active-list');
  if (!el || !stackData) return;
  var list = scope === 'global' ? stackData.global.mcps : stackData.project.mcps;
  if (list.length === 0) { el.innerHTML = '<div class="empty">No MCP servers configured for this scope.</div>'; return; }
  el.innerHTML = list.map(function(m) {
    var armId = 'arm-mcp-' + m.name.replace(/[^a-z0-9]/g, '-');
    var argsPreview = (m.args || []).slice(0,3).join(' ');
    return '<div class="item">' +
      '<div class="icn">' + PLUG_SVG + '</div>' +
      '<div class="body">' +
        '<div class="title"><span class="sname">' + e(m.name) + '</span></div>' +
        '<div class="desc" style="font-family:var(--mono)">' + e(m.command + (argsPreview ? ' ' + argsPreview : '')) + '</div>' +
        ((m.envKeys && m.envKeys.length) ? '<div class="meta">' + m.envKeys.map(function(k) { return '<span class="tag">' + e(k) + '</span>'; }).join('') + '</div>' : '') +
      '</div>' +
      '<button class="btn btn-danger btn-sm" data-action="remove-mcp" data-id="' + e(m.name) + '">' + TRASH_SVG + '<span>Remove</span></button>' +
    '</div>';
  }).join('');
}

function renderMCPCatalog() {
  var el = document.getElementById('mcp-catalog-list');
  if (!el) return;
  var list = MCP_CATALOG_DATA.slice();
  if (mcpCatFilter !== 'all') list = list.filter(function(m) { return m.category === mcpCatFilter; });
  var activeMcps = stackData ? (scope === 'global' ? stackData.global.mcps : stackData.project.mcps) : [];
  var activeNames = new Set(activeMcps.map(function(m) { return m.name; }));
  el.innerHTML = list.map(function(m) {
    var isActive = activeNames.has(m.serverKey);
    var hasEnv = !isActive && m.envVars && m.envVars.length > 0;
    var actionBtn = isActive
      ? '<button class="btn btn-installed btn-sm">' + CHECK_SVG + '<span>Added</span></button>'
      : '<button class="btn btn-primary btn-sm" data-action="' + (hasEnv ? 'config-mcp' : 'add-mcp') + '" data-id="' + e(m.id) + '">' + PLUS_SVG + '<span>Add</span></button>';
    var configForm = '';
    if (hasEnv) {
      var fields = m.envVars.map(function(ev) {
        return '<div class="mcp-cfg-field">' +
          '<label class="mcp-cfg-label">' + e(ev.key) +
            (ev.required ? '<span class="mcp-cfg-req">required</span>' : '<span class="mcp-cfg-opt">optional</span>') +
          '</label>' +
          '<input class="mcp-cfg-input" id="mcp-env-' + e(m.id) + '-' + e(ev.key) + '"' +
            ' placeholder="' + e(ev.placeholder || '') + '">' +
          (ev.description ? '<span class="mcp-cfg-hint">' + e(ev.description) + '</span>' : '') +
        '</div>';
      }).join('');
      var mid = e(m.id);
      configForm = '<div class="mcp-cfg" id="mcp-cfg-' + mid + '">' +
        '<div class="mcp-cfg-title">Configuration</div>' +
        fields +
        '<div class="mcp-cfg-actions">' +
          '<button class="btn btn-primary btn-sm" onclick="confirmAddMCP(&quot;' + mid + '&quot;)">' + CHECK_SVG + '<span>Add Server</span></button>' +
          '<button class="btn btn-sm" onclick="cancelMCPForm(&quot;' + mid + '&quot;)"><span>Cancel</span></button>' +
        '</div>' +
      '</div>';
    }
    return '<div class="item mcp-item" id="mcp-item-' + e(m.id) + '">' +
      '<div class="icn">' + PLUG_SVG + '</div>' +
      '<div class="body">' +
        '<div class="title"><span class="sname">' + e(m.name) + '</span></div>' +
        '<div class="desc">' + e(m.description) + '</div>' +
      '</div>' +
      actionBtn +
      configForm +
    '</div>';
  }).join('');
}

function openMCPConfig(id) {
  document.querySelectorAll('.mcp-cfg.open').forEach(function(el) {
    if (el.id !== 'mcp-cfg-' + id) {
      el.classList.remove('open');
      var item = document.getElementById('mcp-item-' + el.id.replace('mcp-cfg-', ''));
      if (item) item.classList.remove('cfg-open');
    }
  });
  var form = document.getElementById('mcp-cfg-' + id);
  var item = document.getElementById('mcp-item-' + id);
  if (!form) return;
  var opening = !form.classList.contains('open');
  form.classList.toggle('open', opening);
  if (item) item.classList.toggle('cfg-open', opening);
  if (opening) {
    var first = form.querySelector('.mcp-cfg-input');
    if (first) setTimeout(function() { first.focus(); }, 50);
  }
}

function cancelMCPForm(id) {
  var form = document.getElementById('mcp-cfg-' + id);
  var item = document.getElementById('mcp-item-' + id);
  if (form) form.classList.remove('open');
  if (item) item.classList.remove('cfg-open');
}

function confirmAddMCP(id) {
  var mcp = MCP_CATALOG_DATA.find(function(m) { return m.id === id; });
  if (!mcp) return;
  var missing = (mcp.envVars || []).filter(function(ev) {
    if (!ev.required) return false;
    var input = document.getElementById('mcp-env-' + id + '-' + ev.key);
    return !input || !input.value.trim();
  });
  if (missing.length) {
    showStatus('mcp-status', 'Required: ' + missing.map(function(ev) { return ev.key; }).join(', '), false);
    return;
  }
  var config = JSON.parse(JSON.stringify(mcp.configTemplate));
  if (config.env) {
    (mcp.envVars || []).forEach(function(ev) {
      var input = document.getElementById('mcp-env-' + id + '-' + ev.key);
      if (input && input.value.trim()) config.env[ev.key] = input.value.trim();
    });
  }
  vscode.postMessage({ type: 'addMCP', serverKey: mcp.serverKey, config: config, scope: scope });
  cancelMCPForm(id);
  showStatus('mcp-status', mcp.name + ' added successfully.', true);
}

function addMCPFromCatalog(id) {
  var mcp = MCP_CATALOG_DATA.find(function(m) { return m.id === id; });
  if (!mcp) return;
  var config = JSON.parse(JSON.stringify(mcp.configTemplate));
  vscode.postMessage({ type: 'addMCP', serverKey: mcp.serverKey, config: config, scope: scope });
}

function addCustomMCP() {
  var name = document.getElementById('mcp-name') ? document.getElementById('mcp-name').value.trim() : '';
  var cmd  = document.getElementById('mcp-cmd')  ? document.getElementById('mcp-cmd').value.trim()  : '';
  var argsStr = document.getElementById('mcp-args') ? document.getElementById('mcp-args').value.trim() : '';
  if (!name || !cmd) { showStatus('mcp-status', 'Server key and command are required.', false); return; }
  var args = argsStr ? argsStr.split(/\\s+/) : [];
  vscode.postMessage({ type: 'addMCP', serverKey: name, config: { command: cmd, args: args }, scope: scope });
}

function removeMCP(name) { vscode.postMessage({ type: 'removeMCP', name: name, scope: scope }); }
function openSettings()  { vscode.postMessage({ type: 'openSettings', scope: scope }); }

// ── Hooks ─────────────────────────────────────────────────────
function renderHooksActive() {
  var el = document.getElementById('hooks-active-list');
  if (!el || !stackData) return;
  var list = scope === 'global' ? stackData.global.hooks : stackData.project.hooks;
  activeHooks = list.slice();
  if (list.length === 0) { el.innerHTML = '<div class="empty">No hooks configured for this scope.</div>'; return; }
  el.innerHTML = list.map(function(hk, i) {
    var cmd80 = hk.command.slice(0, 80) + (hk.command.length > 80 ? '…' : '');
    var armId = 'arm-hook-' + i;
    return '<div class="item">' +
      '<div class="icn">' + HOOK_SVG + '</div>' +
      '<div class="body">' +
        '<div class="meta" style="margin-top:0"><span class="tag">' + e(hk.event) + '</span>' +
          (hk.matcher && hk.matcher !== '*' ? '<span class="tag">' + e(hk.matcher) + '</span>' : '') +
        '</div>' +
        '<div class="desc" style="font-family:var(--mono);margin-top:6px">' + e(cmd80) + '</div>' +
      '</div>' +
      '<button class="btn btn-sm" onclick="pauseHook(' + i + ')">Pause</button>' +
      '<button class="btn btn-danger btn-sm" id="' + armId + '" onclick="armRemoveHook(' + i + ')">' + TRASH_SVG + '<span>Remove</span></button>' +
    '</div>';
  }).join('');
}

function armRemoveHook(i) {
  var hk = activeHooks[i];
  if (!hk) return;
  armRemove('arm-hook-' + i, function() { vscode.postMessage({ type: 'removeHook', event: hk.event, command: hk.command, scope: scope }); });
}

function pauseHook(i) {
  var hk = activeHooks[i];
  if (!hk) return;
  vscode.postMessage({ type: 'disableHook', event: hk.event, command: hk.command, scope: scope });
}

function renderHooksDisabled() {
  var el = document.getElementById('hooks-disabled-list');
  if (!el || !stackData) return;
  var list = scope === 'global' ? stackData.global.disabledHooks : stackData.project.disabledHooks;
  disabledHooks = (list || []).slice();
  if (disabledHooks.length === 0) { el.innerHTML = '<div class="empty">No disabled hooks.</div>'; return; }
  el.innerHTML = disabledHooks.map(function(hk, i) {
    var cmd80 = hk.command.slice(0, 80) + (hk.command.length > 80 ? '…' : '');
    return '<div class="item" style="opacity:0.6">' +
      '<div class="icn">' + HOOK_SVG + '</div>' +
      '<div class="body">' +
        '<div class="meta" style="margin-top:0"><span class="tag">' + e(hk.event) + '</span>' +
          (hk.matcher && hk.matcher !== '*' ? '<span class="tag">' + e(hk.matcher) + '</span>' : '') +
        '</div>' +
        '<div class="desc" style="font-family:var(--mono);margin-top:6px">' + e(cmd80) + '</div>' +
      '</div>' +
      '<button class="btn btn-primary btn-sm" onclick="reEnableHook(' + i + ')">' + PLUS_SVG + '<span>Enable</span></button>' +
    '</div>';
  }).join('');
}

function reEnableHook(i) {
  var hk = disabledHooks[i];
  if (!hk) return;
  vscode.postMessage({ type: 'enableHook', event: hk.event, matcher: hk.matcher, command: hk.command, scope: scope });
}

function renderHookTemplates() {
  var el = document.getElementById('hooks-templates-list');
  if (!el) return;
  el.innerHTML = HOOK_TEMPLATES_DATA.map(function(t, i) {
    return '<div class="item">' +
      '<div class="icn">' + LIGHT_SVG + '</div>' +
      '<div class="body">' +
        '<div class="title"><span style="color:var(--fg)">' + e(t.name) + '</span></div>' +
        '<div class="desc">' + e(t.description) + '</div>' +
        '<div class="meta"><span class="tag">' + e(t.event) + '</span><span class="tag">' + e(t.matcher || '*') + '</span></div>' +
      '</div>' +
      '<button class="btn btn-primary btn-sm" onclick="addHookTemplate(' + i + ')">' + PLUS_SVG + '<span>Add</span></button>' +
    '</div>';
  }).join('');
}

function addHookTemplate(idx) {
  var t = HOOK_TEMPLATES_DATA[idx];
  vscode.postMessage({ type: 'addHook', event: t.event, matcher: t.matcher || '*', command: t.command, scope: scope });
}

function addCustomHook() {
  var event   = document.getElementById('hook-event')   ? document.getElementById('hook-event').value   : 'PreToolUse';
  var matcher = document.getElementById('hook-matcher') ? document.getElementById('hook-matcher').value.trim() : '*';
  var command = document.getElementById('hook-cmd')     ? document.getElementById('hook-cmd').value.trim() : '';
  if (!command) { showStatus('hooks-status', 'Command is required.', false); return; }
  vscode.postMessage({ type: 'addHook', event: event, matcher: matcher || '*', command: command, scope: scope });
}

// ── Permissions ───────────────────────────────────────────────
var permRules = { allow: [], ask: [], deny: [] };
function currentPerms() {
  if (!stackData) return null;
  return scope === 'global' ? stackData.global.permissions : stackData.project.permissions;
}
function renderPermissions() {
  var pm = currentPerms();
  var modeEl = document.getElementById('perm-mode');
  if (modeEl) modeEl.value = pm ? pm.defaultMode : '';
  var note = document.getElementById('perm-mode-note');
  if (note) {
    var m = pm ? pm.defaultMode : '';
    note.textContent = m === 'bypassPermissions' ? 'Warning: bypassPermissions skips all permission prompts.'
      : (m === 'auto' && scope === 'project') ? 'Note: Claude Code ignores auto mode when set in project settings; set it in Global.'
      : '';
  }
  ['allow', 'ask', 'deny'].forEach(function(list) {
    var el = document.getElementById('perm-list-' + list);
    if (!el) return;
    var rules = pm ? pm[list] : [];
    permRules[list] = rules.slice();
    if (rules.length === 0) { el.innerHTML = '<div class="empty">No ' + list + ' rules for this scope.</div>'; return; }
    el.innerHTML = rules.map(function(rule, i) {
      return '<div class="item">' +
        '<div class="icn">' + SHIELD_SVG + '</div>' +
        '<div class="body"><div class="desc" style="font-family:var(--mono);margin-top:0">' + e(rule) + '</div></div>' +
        '<button class="btn btn-danger btn-sm" id="arm-perm-' + list + '-' + i + '" onclick="armRemovePerm(&quot;' + list + '&quot;,' + i + ')">' + TRASH_SVG + '<span>Remove</span></button>' +
      '</div>';
    }).join('');
  });
}
function armRemovePerm(list, i) {
  var rule = permRules[list][i];
  if (rule === undefined) return;
  armRemove('arm-perm-' + list + '-' + i, function() { vscode.postMessage({ type: 'removePermission', list: list, rule: rule, scope: scope }); });
}
function addPermission() {
  var list = document.getElementById('perm-add-list').value;
  var rule = document.getElementById('perm-add-rule').value.trim();
  if (!rule) { showStatus('perm-status', 'Rule is required.', false); return; }
  vscode.postMessage({ type: 'addPermission', list: list, rule: rule, scope: scope });
}
function changeDefaultMode() {
  vscode.postMessage({ type: 'setDefaultMode', mode: document.getElementById('perm-mode').value, scope: scope });
}

// ── Memory ────────────────────────────────────────────────────
function renderMemory() {
  var el = document.getElementById('memory-list');
  if (!el || !stackData) return;
  var files = stackData.memoryFiles || [];
  setInner('cnt-memory', files.length);
  if (files.length === 0) { el.innerHTML = '<div class="empty">No memory files found.</div>'; return; }
  el.innerHTML = files.map(function(f) {
    return '<div class="item">' +
      '<div class="icn">' + BRAIN_SVG + '</div>' +
      '<div class="body">' +
        '<div class="title"><span class="sname">' + e(f.filename || '') + '</span></div>' +
        '<div class="desc" style="font-family:var(--mono);font-size:10.5px;color:var(--fg-faint);margin-top:2px">' + e(f.projectPath || '') + '</div>' +
        (f.preview ? '<div class="desc">' + e(f.preview) + '</div>' : '') +
      '</div>' +
      '<button class="btn btn-sm" data-action="view-memory" data-filepath="' + e(f.filepath) + '" data-name="' + e(f.filename || '') + '">View</button>' +
    '</div>';
  }).join('');
}

function viewMemory(filepath, name) {
  document.getElementById('memory-viewer').style.display = '';
  document.getElementById('memory-viewer-name').textContent = name;
  document.getElementById('memory-viewer-content').textContent = 'Loading…';
  vscode.postMessage({ type: 'readMemory', filepath: filepath });
}

function closeMemoryViewer() { document.getElementById('memory-viewer').style.display = 'none'; }

// ── Git ───────────────────────────────────────────────────────
let gitFiles = [];

function requestGitStatus() { vscode.postMessage({ type: 'getGitStatus' }); }

function renderGitStatus(data) {
  var noProj = document.getElementById('git-no-project');
  var content = document.getElementById('git-content');
  if (!noProj || !content) return;
  if (data.error) {
    noProj.style.display = '';
    noProj.textContent = data.error;
    content.style.display = 'none';
    return;
  }
  noProj.style.display = 'none';
  content.style.display = '';
  gitFiles = data.files || [];
  var branchEl = document.getElementById('git-branch');
  if (branchEl) branchEl.textContent = data.branch || '';
  var el = document.getElementById('git-files-list');
  if (!el) return;
  if (gitFiles.length === 0) { el.innerHTML = '<div class="empty">No changes.</div>'; return; }
  el.innerHTML = gitFiles.map(function(f, i) {
    return '<div class="item">' +
      '<label style="display:flex;align-items:center;gap:10px;flex:1;cursor:pointer">' +
        '<input type="checkbox" class="git-file-check" data-idx="' + i + '" checked>' +
        '<span class="tag">' + e(f.status || '?') + '</span>' +
        '<span style="font-family:var(--mono);font-size:11px">' + e(f.path) + '</span>' +
      '</label>' +
    '</div>';
  }).join('');
}

function doGitCommit() {
  var msgEl = document.getElementById('git-commit-msg');
  var msgText = msgEl ? msgEl.value.trim() : '';
  if (!msgText) { showStatus('git-status', 'Commit message is required.', false); return; }
  var checked = Array.prototype.slice.call(document.querySelectorAll('.git-file-check:checked'));
  var files = checked.map(function(cb) { return gitFiles[parseInt(cb.dataset.idx, 10)].path; });
  if (files.length === 0) { showStatus('git-status', 'Select at least one file.', false); return; }
  vscode.postMessage({ type: 'gitCommit', files: files, message: msgText });
}

// ── Sessions ──────────────────────────────────────────────────
function requestSessions() { vscode.postMessage({ type: 'getSessions' }); }

function renderSessions(projects) {
  var el = document.getElementById('sessions-list');
  if (!el) return;
  if (!projects || projects.length === 0) { el.innerHTML = '<div class="empty">No Claude sessions found.</div>'; return; }
  el.innerHTML = projects.map(function(p) {
    var rows = p.sessions.map(function(s) {
      var d = new Date(s.date);
      var sid = s.file.replace(/\.jsonl$/, '');
      return '<div class="item">' +
        '<div class="icn">' + CLOCK_SVG + '</div>' +
        '<div class="body">' +
          '<div class="title"><span class="sname">' + e(d.toLocaleString()) + '</span></div>' +
          '<div class="desc">' + s.messageCount + ' messages</div>' +
        '</div>' +
        '<button class="btn btn-sm" data-action="resume-session" data-id="' + e(sid) + '">Continue</button>' +
      '</div>';
    }).join('');
    return '<div class="section-h" style="margin-top:18px"><h3 style="font-family:var(--mono);font-size:12px">' + e(p.projectPath) + '</h3></div>' + rows;
  }).join('');
}

// ── Chat ──────────────────────────────────────────────────────
let chatSessionId = null;
let chatBusy = false;
let currentAssistantEl = null;

function checkChatCli() {
  var el = document.getElementById('chat-cli-status');
  if (el) el.textContent = 'Checking…';
  vscode.postMessage({ type: 'checkChatCli' });
}

function setChatSendEnabled(enabled) {
  var btn = document.getElementById('chat-send-btn');
  if (btn) btn.disabled = !enabled;
}

function appendChatMessage(role, text) {
  var list = document.getElementById('chat-messages');
  if (!list) return null;
  var row = document.createElement('div');
  row.className = 'item';
  row.style.flexDirection = 'column';
  row.style.alignItems = 'flex-start';
  var label = document.createElement('div');
  label.className = 'meta';
  label.innerHTML = '<span class="tag">' + (role === 'user' ? 'You' : 'Claude') + '</span>';
  var body = document.createElement('div');
  body.style.whiteSpace = 'pre-wrap';
  body.style.fontSize = '12.5px';
  body.style.marginTop = '4px';
  body.textContent = text;
  row.appendChild(label);
  row.appendChild(body);
  list.appendChild(row);
  list.scrollTop = list.scrollHeight;
  return body;
}

function sendChat() {
  if (chatBusy) return;
  var ta = document.getElementById('chat-input');
  var text = ta ? ta.value.trim() : '';
  if (!text) return;
  appendChatMessage('user', text);
  ta.value = '';
  chatBusy = true;
  setChatSendEnabled(false);
  currentAssistantEl = appendChatMessage('assistant', '');
  vscode.postMessage({ type: 'sendChatMessage', text: text, resumeSessionId: chatSessionId || undefined });
}

function resumeSession(id) {
  chatSessionId = id;
  var chatTab = document.querySelector('.tab[data-tab="chat"]');
  if (chatTab) chatTab.click();
  showStatus('chat-status', 'Resuming session ' + id + ' — send a message to continue.', true);
}

// ── Counts ────────────────────────────────────────────────────
function updateCounts() {
  if (!stackData) return;
  var g = stackData.global, p = stackData.project;
  var installed = scope === 'global' ? installedGlobal : installedProject;
  var mcps  = scope === 'global' ? g.mcps  : p.mcps;
  var hooks = scope === 'global' ? g.hooks : p.hooks;
  setInner('cnt-skills', installed.length);
  setInner('cnt-mcp',    mcps.length);
  setInner('cnt-hooks',  hooks.length);
  var pm = scope === 'global' ? g.permissions : p.permissions;
  setInner('cnt-perms', pm ? pm.allow.length + pm.ask.length + pm.deny.length : 0);
}

// ── Utils ─────────────────────────────────────────────────────
function e(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function setInner(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = String(val);
}
function showStatus(id, msg, ok) {
  var el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '<div class="status ' + (ok ? 'ok' : 'err') + '">' + e(msg) + '</div>';
  setTimeout(function() { if (el) el.innerHTML = ''; }, 4000);
}
function armRemove(id, fn) {
  var btn = document.getElementById(id);
  armRemoveEl(btn, fn, id);
}

function armRemoveEl(btn, fn, key) {
  var k = key || (btn && (btn.dataset.action + ':' + (btn.dataset.id || btn.dataset.filepath || '')));
  if (!k) return;
  if (removePending[k]) {
    clearTimeout(removePending[k]);
    delete removePending[k];
    fn();
    return;
  }
  if (btn) {
    var span = btn.querySelector('span');
    var origText = span ? span.textContent : '';
    if (span) { span.textContent = 'Confirm?'; span.style.color = 'var(--warn)'; }
    removePending[k] = setTimeout(function() {
      delete removePending[k];
      if (span) { span.textContent = origText; span.style.color = ''; }
    }, 3000);
  }
}

// ── Event delegation for dynamic list items ───────────────────
document.addEventListener('click', function(ev) {
  var btn = ev.target.closest('[data-action]');
  if (!btn) return;
  var action = btn.dataset.action;
  if (action === 'install') {
    installSkill(btn.dataset.id);
  } else if (action === 'uninstall') {
    armRemoveEl(btn, function() { uninstallSkill(btn.dataset.id); });
  } else if (action === 'edit-skill') {
    editSkill(btn.dataset.id);
  } else if (action === 'remove-mcp') {
    armRemoveEl(btn, function() { removeMCP(btn.dataset.id); });
  } else if (action === 'config-mcp') {
    openMCPConfig(btn.dataset.id);
  } else if (action === 'add-mcp') {
    addMCPFromCatalog(btn.dataset.id);
  } else if (action === 'view-memory') {
    viewMemory(btn.dataset.filepath, btn.dataset.name);
  } else if (action === 'resume-session') {
    resumeSession(btn.dataset.id);
  }
});

// ── Messages ──────────────────────────────────────────────────
window.addEventListener('message', function(ev) {
  var msg = ev.data;
  switch (msg.type) {
    case 'installedList':
      if (msg.scope === 'global') installedGlobal = msg.skills || [];
      else installedProject = msg.skills || [];
      renderSkillList();
      renderInstalledList();
      updateCounts();
      break;
    case 'stackData':
      stackData = msg;
      var mdl = document.getElementById('orchestrator-model');
      if (mdl) mdl.textContent = msg.model || 'default';
      updateUndo();
      renderStack();
      renderMCPActive();
      renderMCPCatalog();
      renderHooksActive();
      renderHooksDisabled();
      renderPermissions();
      updateCounts();
      renderMemory();
      break;
    case 'createResult':
      if (msg.ok) {
        showStatus('create-status', 'Created /' + (msg.name || '') + ' successfully.', true);
        ['create-name','create-title','create-desc','create-content'].forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.value = '';
        });
        editingSkillName = null;
        var submitBtn = document.getElementById('create-submit-btn');
        if (submitBtn) { var sp2 = submitBtn.querySelector('span'); if (sp2) sp2.textContent = 'Create Skill'; }
      } else {
        showStatus('create-status', msg.error || 'Create failed.', false);
      }
      break;
    case 'templatePreview': {
      var ta = document.getElementById('create-content');
      if (ta && !ta.value) ta.value = msg.content;
      break;
    }
    case 'mcpResult':
      showStatus('mcp-status', msg.ok ? 'MCP server added.' : ('Error: ' + (msg.error || '')), msg.ok);
      if (msg.ok) {
        ['mcp-name','mcp-cmd','mcp-args'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
      }
      break;
    case 'hookResult':
      showStatus('hooks-status', msg.ok ? 'Hook added.' : ('Error: ' + (msg.error || '')), msg.ok);
      if (msg.ok) {
        ['hook-matcher','hook-cmd'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
      }
      break;
    case 'permResult':
      showStatus('perm-status', msg.message, msg.ok);
      if (msg.ok) { var pr = document.getElementById('perm-add-rule'); if (pr) pr.value = ''; }
      break;
    case 'memoryContent':
      setInner('memory-viewer-content', msg.content || '(empty)');
      break;
    case 'gitStatusData':
      renderGitStatus(msg);
      break;
    case 'gitCommitResult':
      showStatus('git-status', msg.ok ? 'Committed successfully.' : ('Error: ' + (msg.output || '')), msg.ok);
      if (msg.ok) { var msgEl2 = document.getElementById('git-commit-msg'); if (msgEl2) msgEl2.value = ''; }
      break;
    case 'sessionsData':
      renderSessions(msg.projects);
      break;
    case 'chatCliResult': {
      var chatEl = document.getElementById('chat-cli-status');
      if (chatEl) chatEl.textContent = msg.ok ? ('Connected — ' + msg.version) : ('Error: ' + msg.version);
      break;
    }
    case 'chatChunk':
      if (currentAssistantEl) {
        currentAssistantEl.textContent += msg.text;
        var chatList = document.getElementById('chat-messages');
        if (chatList) chatList.scrollTop = chatList.scrollHeight;
      }
      break;
    case 'chatDone':
      if (msg.sessionId) chatSessionId = msg.sessionId;
      chatBusy = false;
      setChatSendEnabled(true);
      currentAssistantEl = null;
      break;
    case 'chatError':
      showStatus('chat-status', 'Error: ' + msg.message, false);
      chatBusy = false;
      setChatSendEnabled(true);
      currentAssistantEl = null;
      break;
    case 'navigateTab':
      if (msg.scope && msg.scope !== scope) {
        var scopeBtn = document.getElementById(msg.scope === 'global' ? 'scopeGlobal' : 'scopeProject');
        if (scopeBtn && !scopeBtn.classList.contains('disabled')) scopeBtn.click();
      }
      if (msg.tab) {
        var tabBtn = document.querySelector('.tab[data-tab="' + msg.tab + '"]');
        if (tabBtn) tabBtn.click();
      }
      break;
  }
});

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('click', function(e) {
  var row = e.target.closest && e.target.closest('[data-goto]');
  if (row) goToTab(row.getAttribute('data-goto'), scope);
});

renderHookTemplates();
updateScopeBanners();
vscode.postMessage({ type: 'getStack' });
vscode.postMessage({ type: 'getInstalled', scope: 'global' });
if (HAS_PROJECT) vscode.postMessage({ type: 'getInstalled', scope: 'project' });
</script>
</body>
</html>`;
}
