// Global/project scope switching and undo button.
export const SCOPE_JS = `// ── Scope ─────────────────────────────────────────────────────
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
`;
