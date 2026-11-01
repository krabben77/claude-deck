// Git tab.
export const GIT_JS = `// ── Git ───────────────────────────────────────────────────────
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
`;
