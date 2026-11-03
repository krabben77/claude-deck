// MCP tab: active servers, catalog, edit and add forms.
export const MCP_JS = `// ── MCP ───────────────────────────────────────────────────────
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
`;
