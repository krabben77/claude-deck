// Modal dialog and line diff preview.
export const MODAL_JS = `// ── Modal + diff preview ──────────────────────────────────────
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
`;
