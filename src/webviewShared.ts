import * as settings from './settingsManager';
import { CURATED_SKILLS, CATEGORIES } from './data/curatedSkills';
import { MCP_CATALOG, MCP_CATEGORIES } from './data/mcpCatalog';
import { HOOK_TEMPLATES } from './data/hookTemplates';
import { S, CAT_ICONS } from './webview/icons';
import { CSS } from './webview/styles';
import { bodyMarkup } from './webview/markup';

export { WebviewContext, handleMessage, sendInstalled, sendStack } from './webview/messages';

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
${CSS}
</style>
</head>
<body>
${bodyMarkup({ hasProject, projectName, activeModel, catChips, mcpCatChips, createCatOptions })}
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
    ? issues.map(function(i) { return '<div class="h-item ' + i.level + '">' + (i.level === 'error' ? 'x ' : '! ') + e(i.message) + '</div>'; }).join('')
    : '<div class="h-ok">No problems found in settings, MCP servers or hooks.</div>';
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
  var safe = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!/[a-z0-9]/.test(safe)) { showStatus('create-status', 'Name must contain at least one letter or number.', false); return; }
  if (!editingSkillName) { submitSkill(safe, cat, content, null); return; }

  var arr = scope === 'global' ? installedGlobal : installedProject;
  var orig = arr.find(function(s) { return s.name === editingSkillName; });
  var target = arr.find(function(s) { return s.name === safe; });
  var renameFrom = safe !== editingSkillName ? editingSkillName : null;
  var notes = [];
  if (renameFrom) {
    notes.push('Renames /' + renameFrom + ' to /' + safe + ' (the old file is removed).');
    if (target) notes.push('A skill named /' + safe + ' already exists and will be overwritten.');
  }
  var before = (target || orig) ? (target || orig).content.trim() : '';
  showDiff('Review changes to /' + safe, before, content, notes.join(' '), function() {
    submitSkill(safe, cat, content, renameFrom);
  }, null, 'Cancel');
}

function submitSkill(name, cat, content, renameFrom) {
  pendingRename = renameFrom ? { name: renameFrom, scope: scope } : null;
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

// ── Modal + diff preview ──────────────────────────────────────
var NL = String.fromCharCode(10);
var modalApply = null, modalBack = null, mcpEditing = null, pendingRename = null;

function openModal(title, view) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-edit').style.display = view === 'edit' ? '' : 'none';
  document.getElementById('modal-diff').style.display = view === 'diff' ? '' : 'none';
  document.getElementById('modal').style.display = 'flex';
}
function closeModal() {
  document.getElementById('modal').style.display = 'none';
  modalApply = null;
  modalBack = null;
}

function splitLines(t) { return t === '' ? [] : t.split(NL); }

function lineDiff(a, b) {
  var n = a.length, m = b.length, out = [], i = 0, j = 0;
  if (n * m > 4000000) {
    a.forEach(function(s) { out.push({ t: '-', s: s }); });
    b.forEach(function(s) { out.push({ t: '+', s: s }); });
    return out;
  }
  var dp = [];
  for (var x = 0; x <= n; x++) dp.push(new Array(m + 1).fill(0));
  for (var x2 = n - 1; x2 >= 0; x2--) {
    for (var y = m - 1; y >= 0; y--) {
      dp[x2][y] = a[x2] === b[y] ? dp[x2 + 1][y + 1] + 1 : Math.max(dp[x2 + 1][y], dp[x2][y + 1]);
    }
  }
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ t: ' ', s: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: '-', s: a[i] }); i++; }
    else { out.push({ t: '+', s: b[j] }); j++; }
  }
  while (i < n) { out.push({ t: '-', s: a[i] }); i++; }
  while (j < m) { out.push({ t: '+', s: b[j] }); j++; }
  return out;
}

function showDiff(title, before, after, note, applyFn, backFn, backLabel) {
  var ops = lineDiff(splitLines(before), splitLines(after));
  var changed = ops.some(function(op) { return op.t !== ' '; });
  var keep = new Array(ops.length).fill(false);
  ops.forEach(function(op, k) {
    if (op.t === ' ') return;
    for (var d = -2; d <= 2; d++) { if (k + d >= 0 && k + d < ops.length) keep[k + d] = true; }
  });
  var html = '', skipped = 0;
  var gap = function(n) { return '<div class="dl gap">… ' + n + ' unchanged lines …</div>'; };
  ops.forEach(function(op, k) {
    if (!keep[k]) { skipped++; return; }
    if (skipped) { html += gap(skipped); skipped = 0; }
    html += '<div class="dl ' + (op.t === '+' ? 'add' : op.t === '-' ? 'del' : '') + '">' + e(op.t + ' ' + op.s) + '</div>';
  });
  if (skipped) html += gap(skipped);
  if (!changed) html = '<div class="dl gap">No content changes.</div>';
  document.getElementById('diff-note').textContent = note || '';
  document.getElementById('diff-body').innerHTML = html;
  document.getElementById('diff-apply').disabled = !(changed || note);
  document.getElementById('diff-back-label').textContent = backLabel || 'Cancel';
  modalApply = applyFn;
  modalBack = backFn || null;
  openModal(title, 'diff');
}
function applyDiff() { var fn = modalApply; closeModal(); if (fn) fn(); }
function diffBack() { var fn = modalBack; if (fn) fn(); else closeModal(); }

// ── MCP ───────────────────────────────────────────────────────
function editMCP(name) { vscode.postMessage({ type: 'getMCP', name: name, scope: scope }); }

function openMCPEdit(name, cfg, mcpScope) {
  mcpEditing = { name: name, scope: mcpScope, config: cfg };
  document.getElementById('med-name').value = name;
  document.getElementById('med-cmd').value = cfg.command || '';
  document.getElementById('med-args').value = (cfg.args || []).join(NL);
  document.getElementById('med-env').value = Object.keys(cfg.env || {}).map(function(k) { return k + '=' + cfg.env[k]; }).join(NL);
  document.getElementById('med-status').innerHTML = '';
  openModal('Edit MCP server', 'edit');
}

function readLines(id) {
  return document.getElementById(id).value.split(NL).map(function(l) { return l.replace(/\\r$/, ''); }).filter(function(l) { return l.trim() !== ''; });
}

function reviewMCPEdit() {
  var command = document.getElementById('med-cmd').value.trim();
  if (!command) { showStatus('med-status', 'Command is required.', false); return; }
  var args = readLines('med-args');
  var envLines = readLines('med-env');
  var env = {};
  for (var i = 0; i < envLines.length; i++) {
    var eq = envLines[i].indexOf('=');
    if (eq < 1) { showStatus('med-status', 'Env entry ' + (i + 1) + ' must be KEY=VALUE.', false); return; }
    env[envLines[i].slice(0, eq).trim()] = envLines[i].slice(eq + 1);
  }
  var ed = mcpEditing;
  var next = JSON.parse(JSON.stringify(ed.config));
  next.command = command;
  if (args.length) next.args = args; else delete next.args;
  if (Object.keys(env).length) next.env = env; else delete next.env;
  showDiff('Review changes to ' + ed.name, JSON.stringify(ed.config, null, 2), JSON.stringify(next, null, 2), '', function() {
    vscode.postMessage({ type: 'updateMCP', name: ed.name, config: { command: command, args: args, env: env }, scope: ed.scope });
  }, function() { openModal('Edit MCP server', 'edit'); }, 'Back');
}

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
      '<button class="btn btn-sm" data-action="edit-mcp" data-id="' + e(m.name) + '">Edit</button>' +
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
  } else if (action === 'edit-mcp') {
    editMCP(btn.dataset.id);
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
    case 'mcpConfig':
      if (msg.config) openMCPEdit(msg.name, msg.config, msg.scope);
      else showStatus('mcp-status', 'MCP server not found.', false);
      break;
    case 'mcpUpdateResult':
      showStatus('mcp-status', msg.ok ? 'MCP server updated.' : ('Error: ' + (msg.error || '')), msg.ok);
      break;
    case 'createResult':
      if (msg.ok && pendingRename) {
        vscode.postMessage({ type: 'uninstall', skillName: pendingRename.name, scope: pendingRename.scope });
      }
      pendingRename = null;
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
