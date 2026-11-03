import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as manager from '../skillsManager';
import * as settings from '../settingsManager';
import * as memory from '../memoryManager';
import * as git from '../gitManager';
import * as sessionsManager from '../sessionsManager';
import * as chatManager from '../chatManager';
import { Scope } from '../skillsManager';
import { CURATED_SKILLS, CATEGORIES, Category } from '../data/curatedSkills';
import { TEMPLATES } from '../data/templates';
import { MCP_CATALOG, MCP_CATEGORIES } from '../data/mcpCatalog';
import { HOOK_TEMPLATES } from '../data/hookTemplates';
import { HookEvent } from '../settingsManager';

type InMsg =
  | { type: 'getInstalled'; scope: Scope }
  | { type: 'getStack' }
  | { type: 'install'; skillId: string; scope: Scope }
  | { type: 'uninstall'; skillName: string; scope: Scope }
  | { type: 'create'; name: string; category: Category; content: string; scope: Scope }
  | { type: 'previewTemplate'; category: Category; name: string; title: string; description: string }
  | { type: 'addMCP'; serverKey: string; config: settings.MCPServerConfig; scope: Scope }
  | { type: 'removeMCP'; name: string; scope: Scope }
  | { type: 'getMCP'; name: string; scope: Scope }
  | { type: 'updateMCP'; name: string; config: settings.MCPServerConfig; scope: Scope }
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

    case 'getMCP':
      webview.postMessage({ type: 'mcpConfig', name: msg.name, scope: msg.scope, config: settings.getMCPConfig(msg.name, msg.scope, pp) });
      break;

    case 'updateMCP': {
      try {
        settings.snapshotForUndo(`Edit MCP server ${msg.name}`, msg.scope, pp);
        settings.updateMCPServer(msg.name, msg.config, msg.scope, pp);
        webview.postMessage({ type: 'mcpUpdateResult', ok: true, name: msg.name });
        sendStack(ctx);
      } catch (e) {
        webview.postMessage({ type: 'mcpUpdateResult', ok: false, error: String(e) });
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
