// Memory tab.
export const MEMORY_JS = `// ── Memory ────────────────────────────────────────────────────
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
`;
