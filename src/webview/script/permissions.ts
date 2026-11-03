// Permissions tab.
export const PERMISSIONS_JS = `// ── Permissions ───────────────────────────────────────────────
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
`;
