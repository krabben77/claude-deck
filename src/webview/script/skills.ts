// Skills tab: catalog, installed list, create and edit.
export const SKILLS_JS = `// ── Skills ────────────────────────────────────────────────────
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
`;
