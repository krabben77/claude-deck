// Tab counts and small utilities.
export const UTILS_JS = `// ── Counts ────────────────────────────────────────────────────
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
`;
