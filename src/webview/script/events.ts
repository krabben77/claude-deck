// Event delegation for dynamic list items and the extension message listener.
export const EVENTS_JS = `// ── Event delegation for dynamic list items ───────────────────
document.addEventListener('click', function(ev) {
  var btn = ev.target.closest('[data-action]');
  if (!btn) return;
  var action = btn.dataset.action;
  if (action === 'install') {
    installSkill(btn.dataset.id);
  } else if (action === 'uninstall') {
    armRemoveEl(btn, function() { uninstallSkill(btn.dataset.id); });
  } else if (action === 'edit-skill') {
    editSkill(btn.dataset.id);
  } else if (action === 'remove-mcp') {
    armRemoveEl(btn, function() { removeMCP(btn.dataset.id); });
  } else if (action === 'edit-mcp') {
    editMCP(btn.dataset.id);
  } else if (action === 'config-mcp') {
    openMCPConfig(btn.dataset.id);
  } else if (action === 'add-mcp') {
    addMCPFromCatalog(btn.dataset.id);
  } else if (action === 'view-memory') {
    viewMemory(btn.dataset.filepath, btn.dataset.name);
  } else if (action === 'resume-session') {
    resumeSession(btn.dataset.id);
  }
});

// ── Messages ──────────────────────────────────────────────────
window.addEventListener('message', function(ev) {
  var msg = ev.data;
  switch (msg.type) {
    case 'installedList':
      if (msg.scope === 'global') installedGlobal = msg.skills || [];
      else installedProject = msg.skills || [];
      renderSkillList();
      renderInstalledList();
      updateCounts();
      break;
    case 'stackData':
      stackData = msg;
      var mdl = document.getElementById('orchestrator-model');
      if (mdl) mdl.textContent = msg.model || 'default';
      updateUndo();
      renderStack();
      renderMCPActive();
      renderMCPCatalog();
      renderHooksActive();
      renderHooksDisabled();
      renderPermissions();
      updateCounts();
      renderMemory();
      break;
    case 'mcpConfig':
      if (msg.config) openMCPEdit(msg.name, msg.config, msg.scope);
      else showStatus('mcp-status', 'MCP server not found.', false);
      break;
    case 'mcpUpdateResult':
      showStatus('mcp-status', msg.ok ? 'MCP server updated.' : ('Error: ' + (msg.error || '')), msg.ok);
      break;
    case 'createResult':
      if (msg.ok && pendingRename) {
        vscode.postMessage({ type: 'uninstall', skillName: pendingRename.name, scope: pendingRename.scope });
      }
      pendingRename = null;
      if (msg.ok) {
        showStatus('create-status', 'Created /' + (msg.name || '') + ' successfully.', true);
        ['create-name','create-title','create-desc','create-content'].forEach(function(id) {
          var el = document.getElementById(id);
          if (el) el.value = '';
        });
        editingSkillName = null;
        var submitBtn = document.getElementById('create-submit-btn');
        if (submitBtn) { var sp2 = submitBtn.querySelector('span'); if (sp2) sp2.textContent = 'Create Skill'; }
      } else {
        showStatus('create-status', msg.error || 'Create failed.', false);
      }
      break;
    case 'templatePreview': {
      var ta = document.getElementById('create-content');
      if (ta && !ta.value) ta.value = msg.content;
      break;
    }
    case 'mcpResult':
      showStatus('mcp-status', msg.ok ? 'MCP server added.' : ('Error: ' + (msg.error || '')), msg.ok);
      if (msg.ok) {
        ['mcp-name','mcp-cmd','mcp-args'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
      }
      break;
    case 'hookResult':
      showStatus('hooks-status', msg.ok ? 'Hook added.' : ('Error: ' + (msg.error || '')), msg.ok);
      if (msg.ok) {
        ['hook-matcher','hook-cmd'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
      }
      break;
    case 'permResult':
      showStatus('perm-status', msg.message, msg.ok);
      if (msg.ok) { var pr = document.getElementById('perm-add-rule'); if (pr) pr.value = ''; }
      break;
    case 'memoryContent':
      setInner('memory-viewer-content', msg.content || '(empty)');
      break;
    case 'gitStatusData':
      renderGitStatus(msg);
      break;
    case 'gitCommitResult':
      showStatus('git-status', msg.ok ? 'Committed successfully.' : ('Error: ' + (msg.output || '')), msg.ok);
      if (msg.ok) { var msgEl2 = document.getElementById('git-commit-msg'); if (msgEl2) msgEl2.value = ''; }
      break;
    case 'sessionsData':
      renderSessions(msg.projects);
      break;
    case 'chatCliResult': {
      var chatEl = document.getElementById('chat-cli-status');
      if (chatEl) chatEl.textContent = msg.ok ? ('Connected — ' + msg.version) : ('Error: ' + msg.version);
      break;
    }
    case 'chatChunk':
      if (currentAssistantEl) {
        currentAssistantEl.textContent += msg.text;
        var chatList = document.getElementById('chat-messages');
        if (chatList) chatList.scrollTop = chatList.scrollHeight;
      }
      break;
    case 'chatDone':
      if (msg.sessionId) chatSessionId = msg.sessionId;
      chatBusy = false;
      setChatSendEnabled(true);
      currentAssistantEl = null;
      break;
    case 'chatError':
      showStatus('chat-status', 'Error: ' + msg.message, false);
      chatBusy = false;
      setChatSendEnabled(true);
      currentAssistantEl = null;
      break;
    case 'navigateTab':
      if (msg.scope && msg.scope !== scope) {
        var scopeBtn = document.getElementById(msg.scope === 'global' ? 'scopeGlobal' : 'scopeProject');
        if (scopeBtn && !scopeBtn.classList.contains('disabled')) scopeBtn.click();
      }
      if (msg.tab) {
        var tabBtn = document.querySelector('.tab[data-tab="' + msg.tab + '"]');
        if (tabBtn) tabBtn.click();
      }
      break;
  }
});
`;
