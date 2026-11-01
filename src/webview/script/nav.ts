// Tabs, skills subtabs and category chips.
export const NAV_JS = `// ── Tabs ──────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var tabId = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('panel-' + tabId).classList.add('active');
    if (tabId === 'git') { requestGitStatus(); }
    if (tabId === 'sessions') { requestSessions(); }
  });
});

// ── Subtabs (skills) ──────────────────────────────────────────
document.querySelectorAll('.subtab').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var sub = btn.dataset.ssub;
    if (sub === 'create') { resetCreateForm(); }
    document.querySelectorAll('.subtab').forEach(function(t) { t.classList.remove('active'); });
    btn.classList.add('active');
    document.getElementById('skills-browse').style.display    = sub === 'browse'    ? '' : 'none';
    document.getElementById('skills-installed').style.display = sub === 'installed' ? '' : 'none';
    document.getElementById('skills-create').style.display    = sub === 'create'    ? '' : 'none';
  });
});

function resetCreateForm() {
  if (!editingSkillName) return;
  editingSkillName = null;
  ['create-name','create-title','create-desc','create-content'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var btn = document.getElementById('create-submit-btn');
  if (btn) { var sp = btn.querySelector('span'); if (sp) sp.textContent = 'Create Skill'; }
}

// ── Category chips (skills) ───────────────────────────────────
document.querySelectorAll('.chip[data-scat]').forEach(function(chip) {
  chip.addEventListener('click', function() {
    skillCatFilter = chip.dataset.scat;
    document.querySelectorAll('.chip[data-scat]').forEach(function(c) { c.classList.remove('active'); });
    chip.classList.add('active');
    renderSkillList();
  });
});

// ── Category chips (mcp) ──────────────────────────────────────
document.querySelectorAll('.chip[data-mcat]').forEach(function(chip) {
  chip.addEventListener('click', function() {
    mcpCatFilter = chip.dataset.mcat;
    document.querySelectorAll('.chip[data-mcat]').forEach(function(c) { c.classList.remove('active'); });
    chip.classList.add('active');
    renderMCPCatalog();
  });
});
`;
