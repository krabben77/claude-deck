// Sessions tab.
export const SESSIONS_JS = `// ── Sessions ──────────────────────────────────────────────────
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
`;
