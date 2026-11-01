// Initial requests sent when the panel loads.
export const INIT_JS = `// ── Init ──────────────────────────────────────────────────────
document.addEventListener('click', function(e) {
  var row = e.target.closest && e.target.closest('[data-goto]');
  if (row) goToTab(row.getAttribute('data-goto'), scope);
});

renderHookTemplates();
updateScopeBanners();
vscode.postMessage({ type: 'getStack' });
vscode.postMessage({ type: 'getInstalled', scope: 'global' });
if (HAS_PROJECT) vscode.postMessage({ type: 'getInstalled', scope: 'project' });`;
