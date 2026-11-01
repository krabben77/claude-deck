// Hooks tab.
export const HOOKS_JS = `// ── Hooks ─────────────────────────────────────────────────────
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
`;
