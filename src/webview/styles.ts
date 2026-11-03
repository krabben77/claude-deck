// Panel CSS, embedded in the webview HTML by buildWebviewHtml().
export const CSS = `:root {
  --bg:          var(--vscode-editor-background, #1e1e1e);
  --bg-1:        var(--vscode-sideBar-background, #252526);
  --bg-2:        var(--vscode-list-hoverBackground, #2d2d30);
  --bg-input:    var(--vscode-input-background, #1a1a1a);
  --line:        var(--vscode-panel-border, #333335);
  --line-2:      #404044;
  --hairline:    rgba(255,255,255,.06);
  --fg:          var(--vscode-editor-foreground, #e8e8ea);
  --fg-mute:     var(--vscode-descriptionForeground, #a1a1a6);
  --fg-dim:      #6e6e74;
  --fg-faint:    #4a4a50;
  --accent:      #d97757;
  --accent-hi:   #e08e72;
  --accent-bg:   rgba(217,119,87,.12);
  --accent-line: rgba(217,119,87,.28);
  --ok:          #4ade80;
  --err:         #f87171;
  --warn:        #fbbf24;
  --global:      #74a8e8;
  --global-bg:   rgba(116,168,232,.10);
  --global-ln:   rgba(116,168,232,.28);
  --project:     #b89bf0;
  --project-bg:  rgba(184,155,240,.10);
  --project-ln:  rgba(184,155,240,.28);
  --sans: var(--vscode-font-family, -apple-system, 'Segoe UI', system-ui, sans-serif);
  --mono: var(--vscode-editor-font-family, ui-monospace, 'SF Mono', Menlo, monospace);
  --r-sm: 4px;
  --r:    6px;
  --r-lg: 10px;
}
*,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
html,body { height:100%; background:var(--bg); color:var(--fg); font-family:var(--sans); font-size:13px; line-height:1.5; -webkit-font-smoothing:antialiased; }
body { overflow:hidden; display:flex; flex-direction:column; }
.app { display:flex; flex-direction:column; height:100vh; overflow:hidden; }

/* Header */
.hdr { display:flex; align-items:center; gap:12px; padding:14px 18px 12px; border-bottom:1px solid var(--line); flex-shrink:0; }
.hdr-mark { width:36px; height:36px; border-radius:9px; background:linear-gradient(135deg,var(--accent),#b85a3e); display:grid; place-items:center; color:#fff; box-shadow:0 1px 0 rgba(255,255,255,.12) inset,0 1px 2px rgba(0,0,0,.3); flex-shrink:0; }
.hdr-mark svg { width:22px; height:22px; }
.hdr-text { flex:1; min-width:0; }
.hdr-title { font-size:13px; font-weight:600; letter-spacing:-0.01em; }
.hdr-sub { font-size:11px; color:var(--fg-dim); margin-top:1px; }
.scope { display:flex; background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r); padding:2px; gap:2px; }
.scope-btn { border:0; background:transparent; color:var(--fg-mute); font:inherit; font-size:11px; font-weight:500; padding:4px 10px; border-radius:4px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; transition:color .12s,background .12s; max-width:180px; }
.undo-btn { border:1px solid var(--line); background:var(--bg-1); color:var(--fg-mute); font:inherit; font-size:11px; font-weight:500; padding:4px 10px; border-radius:4px; cursor:pointer; max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.undo-btn:hover { color:var(--fg); }
.scope-btn .label { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.scope-btn:hover:not(.active):not(.disabled) { color:var(--fg); }
.scope-btn .dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; }
.scope-btn.global .dot  { background:var(--global); }
.scope-btn.project .dot { background:var(--project); }
.scope-btn.disabled { opacity:.35; cursor:not-allowed; }
.scope-btn.active.global  { background:var(--global-bg);  color:var(--global);  box-shadow:inset 0 0 0 1px var(--global-ln); }
.scope-btn.active.project { background:var(--project-bg); color:var(--project); box-shadow:inset 0 0 0 1px var(--project-ln); }

/* Tabs */
.tabs { display:flex; padding:0 12px; border-bottom:1px solid var(--line); flex-shrink:0; background:var(--bg); }
.tab { border:0; background:transparent; color:var(--fg-mute); font:inherit; font-size:12px; font-weight:500; padding:10px 12px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; position:relative; transition:color .12s; }
.tab svg { width:14px; height:14px; opacity:.85; }
.tab:hover { color:var(--fg); }
.tab.active { color:var(--fg); }
.tab.active::after { content:""; position:absolute; left:8px; right:8px; bottom:-1px; height:2px; background:var(--accent); border-radius:2px 2px 0 0; }
.tab .count { font-size:10px; font-weight:600; padding:1px 6px; border-radius:10px; background:var(--bg-2); color:var(--fg-mute); min-width:18px; text-align:center; }
.tab.active .count { background:var(--accent-bg); color:var(--accent); }

/* Panels */
.panels { flex:1; overflow-y:auto; }
.panel { display:none; padding:18px 18px 32px; max-width:920px; margin:0 auto; }
.panel.active { display:block; }

/* Stack overview */
.overview-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:22px; }
.col-card { background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-lg); overflow:hidden; }
.col-head { display:flex; align-items:center; gap:8px; padding:11px 14px; border-bottom:1px solid var(--hairline); }
.col-head .dot { width:8px; height:8px; border-radius:50%; }
.col-head.global  .dot { background:var(--global);  box-shadow:0 0 0 3px var(--global-bg); }
.col-head.project .dot { background:var(--project); box-shadow:0 0 0 3px var(--project-bg); }
.col-head .title { font-size:12px; font-weight:600; }
.col-head.global  .title { color:var(--global); }
.col-head.project .title { color:var(--project); }
.col-head .path { font-family:var(--mono); font-size:10.5px; color:var(--fg-dim); margin-left:auto; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.col-rows { padding:4px; }
.col-row { display:grid; grid-template-columns:28px 1fr auto auto; align-items:center; gap:10px; padding:9px 10px; border-radius:var(--r); cursor:pointer; transition:background .1s; }
.col-row:hover { background:var(--bg-2); }
.col-row .icn { width:28px; height:28px; border-radius:var(--r-sm); background:var(--bg-2); color:var(--fg-mute); display:grid; place-items:center; }
.col-row .icn svg { width:14px; height:14px; }
.col-row .lbl { font-size:12px; font-weight:500; color:var(--fg); }
.col-row .lbl small { display:block; font-weight:400; color:var(--fg-dim); font-size:10.5px; margin-top:1px; }
.col-row .num { font-size:18px; font-weight:600; color:var(--fg); font-variant-numeric:tabular-nums; letter-spacing:-.02em; }
.col-row .arrow { color:var(--fg-faint); transition:color .12s,transform .12s; }
.col-row:hover .arrow { color:var(--fg-mute); transform:translateX(2px); }
.health-card { margin-top:12px; background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-lg); padding:12px 16px; font-size:12px; }
.health-card .h-title { font-weight:600; margin-bottom:6px; }
.health-card .h-ok { color:var(--fg-dim); }
.health-card .h-item { padding:3px 0; line-height:1.5; word-break:break-word; }
.health-card .h-item.error { color:var(--err); }
.health-card .h-item.warn { color:var(--warn); }
.btn:disabled { opacity:.5; cursor:default; }
.modal-back { position:fixed; inset:0; background:rgba(0,0,0,.55); display:flex; align-items:flex-start; justify-content:center; padding:5vh 16px; z-index:50; overflow:auto; }
.modal { background:var(--bg-1); border:1px solid var(--line-2); border-radius:var(--r-lg); width:100%; max-width:720px; padding:16px 18px; }
.modal-title { font-weight:600; font-size:13px; margin-bottom:10px; }
.modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:12px; }
.modal-note { font-size:11.5px; color:var(--warn); margin-bottom:8px; line-height:1.5; }
.diff { margin:0; padding:8px 0; background:var(--bg-input); border:1px solid var(--line); border-radius:var(--r-sm); font-family:var(--mono); font-size:11.5px; max-height:55vh; overflow:auto; }
.dl { padding:0 10px; white-space:pre-wrap; word-break:break-all; }
.dl.add { background:rgba(74,222,128,.12); color:var(--ok); }
.dl.del { background:rgba(248,113,113,.12); color:var(--err); }
.dl.gap { color:var(--fg-dim); text-align:center; }
.empty-col { padding:24px 18px; text-align:center; color:var(--fg-dim); font-size:12px; line-height:1.7; }
.empty-col code { font-family:var(--mono); background:var(--bg-2); padding:1px 6px; border-radius:3px; font-size:11px; }

/* Architecture */
.arch { background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-lg); padding:16px 18px 18px; }
.arch-h { display:flex; align-items:baseline; justify-content:space-between; margin-bottom:14px; }
.arch-h h3 { font-size:12px; font-weight:600; letter-spacing:.02em; text-transform:uppercase; color:var(--fg-mute); }
.arch-h .legend { display:flex; gap:12px; font-size:10.5px; color:var(--fg-dim); }
.arch-h .legend i { display:inline-block; width:8px; height:8px; border-radius:2px; margin-right:5px; vertical-align:-1px; }
.arch-h .legend .lg-g { background:var(--global); }
.arch-h .legend .lg-p { background:var(--project); }
.arch-stack { display:flex; flex-direction:column; gap:6px; position:relative; }
.arch-stack::before { content:""; position:absolute; left:28px; top:18px; bottom:18px; width:1px; background:linear-gradient(to bottom,var(--line) 0%,var(--line-2) 50%,var(--line) 100%); z-index:0; }
.arch-row { display:grid; grid-template-columns:32px 1fr auto; align-items:center; gap:12px; padding:11px 14px; background:var(--bg); border:1px solid var(--line); border-radius:var(--r); position:relative; z-index:1; }
.arch-row::before { content:""; position:absolute; left:28px; top:50%; width:14px; height:1px; background:var(--line); transform:translateY(-50%); }
.arch-row .icn { width:28px; height:28px; border-radius:var(--r-sm); background:var(--bg-2); display:grid; place-items:center; color:var(--fg-mute); }
.arch-row .icn svg { width:14px; height:14px; }
.arch-row .name { font-size:12px; font-weight:600; color:var(--fg); }
.arch-row .desc { font-size:10.5px; color:var(--fg-dim); margin-top:1px; }
.arch-row .pills { display:flex; gap:6px; }
.arch-row.live .icn { color:var(--accent); background:var(--accent-bg); }

/* Pills */
.pill { display:inline-flex; align-items:center; gap:5px; font-size:10.5px; font-weight:500; padding:2px 8px; border-radius:11px; background:var(--bg-2); color:var(--fg-mute); line-height:1.6; white-space:nowrap; }
.pill .dot { width:5px; height:5px; border-radius:50%; }
.pill.global  { background:var(--global-bg);  color:var(--global);  box-shadow:inset 0 0 0 1px var(--global-ln); }
.pill.global .dot  { background:var(--global); }
.pill.project { background:var(--project-bg); color:var(--project); box-shadow:inset 0 0 0 1px var(--project-ln); }
.pill.project .dot { background:var(--project); }
.pill.live    { background:rgba(74,222,128,.12); color:var(--ok); box-shadow:inset 0 0 0 1px rgba(74,222,128,.25); }
.pill.muted   { color:var(--fg-faint); }
.pill.accent  { background:var(--accent-bg); color:var(--accent); box-shadow:inset 0 0 0 1px var(--accent-line); }

/* Scope banner */
.scope-banner { display:flex; align-items:center; gap:8px; padding:8px 12px; border-radius:var(--r); margin-bottom:14px; font-size:11.5px; font-weight:500; }
.scope-banner.global  { background:var(--global-bg);  color:var(--global);  box-shadow:inset 0 0 0 1px var(--global-ln); }
.scope-banner.project { background:var(--project-bg); color:var(--project); box-shadow:inset 0 0 0 1px var(--project-ln); }
.scope-banner svg { width:14px; height:14px; }
.scope-banner .path { margin-left:auto; font-family:var(--mono); font-size:10.5px; opacity:.85; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* Subtabs */
.subtabs { display:inline-flex; background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r); padding:2px; gap:2px; margin-bottom:14px; }
.subtab { border:0; background:transparent; color:var(--fg-mute); font:inherit; font-size:11px; font-weight:500; padding:4px 10px; border-radius:4px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; }
.subtab.active { background:var(--bg-2); color:var(--fg); }
.subtab .count { font-size:10px; color:var(--fg-faint); }
.subtab.active .count { color:var(--fg-mute); }

/* Search */
.search { position:relative; margin-bottom:10px; }
.search input { width:100%; background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r); padding:7px 10px 7px 32px; font:inherit; font-size:12px; color:var(--fg); outline:none; transition:border-color .12s; }
.search input:focus { border-color:var(--accent-line); box-shadow:0 0 0 3px var(--accent-bg); }
.search input::placeholder { color:var(--fg-faint); }
.search svg { position:absolute; left:10px; top:50%; transform:translateY(-50%); width:14px; height:14px; color:var(--fg-faint); }

/* Chips */
.chips { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:12px; }
.chip { border:1px solid var(--line); background:transparent; color:var(--fg-mute); font:inherit; font-size:11px; font-weight:500; padding:3px 10px; border-radius:12px; cursor:pointer; display:inline-flex; align-items:center; gap:5px; transition:all .1s; }
.chip:hover { color:var(--fg); border-color:var(--line-2); }
.chip.active { background:var(--fg); color:var(--bg); border-color:var(--fg); }
.chip .icn { width:12px; height:12px; }

/* List / Items */
.list { display:flex; flex-direction:column; gap:6px; }
.item { display:grid; grid-template-columns:32px 1fr auto; align-items:center; gap:12px; padding:11px 14px; background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r); transition:border-color .12s; }
.item.cfg-open { align-items:start; }
.mcp-cfg { grid-column:1/-1; display:none; flex-direction:column; gap:8px; border-top:1px solid var(--line); margin-top:4px; padding-top:12px; }
.mcp-cfg.open { display:flex; }
.mcp-cfg-title { font-size:10.5px; font-weight:600; color:var(--fg-mute); text-transform:uppercase; letter-spacing:.06em; }
.mcp-cfg-field { display:flex; flex-direction:column; gap:3px; }
.mcp-cfg-label { font-size:11px; color:var(--fg-mute); font-weight:500; display:flex; align-items:center; gap:4px; font-family:var(--mono); }
.mcp-cfg-req { color:var(--err); font-size:9.5px; font-family:var(--sans); font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
.mcp-cfg-opt { color:var(--fg-faint); font-size:9.5px; font-family:var(--sans); text-transform:uppercase; letter-spacing:.04em; }
.mcp-cfg-input { width:100%; background:var(--bg-input); border:1px solid var(--line); border-radius:var(--r-sm); padding:5px 9px; font-family:var(--mono); font-size:11.5px; color:var(--fg); outline:none; transition:border-color .12s,box-shadow .12s; }
.mcp-cfg-input:focus { border-color:var(--accent-line); box-shadow:0 0 0 2px var(--accent-bg); }
.mcp-cfg-hint { font-size:10.5px; color:var(--fg-faint); line-height:1.4; }
.mcp-cfg-actions { display:flex; gap:6px; padding-top:4px; }
.item:hover { border-color:var(--line-2); }
.item .icn { width:32px; height:32px; border-radius:var(--r-sm); background:var(--bg-2); display:grid; place-items:center; color:var(--fg-mute); flex-shrink:0; }
.item .icn svg { width:15px; height:15px; }
.item .body { min-width:0; }
.item .title { font-family:var(--mono); font-size:12px; font-weight:500; color:var(--fg); display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.item .title .sname { color:var(--accent); }
.item .desc { font-size:11.5px; color:var(--fg-dim); margin-top:3px; line-height:1.45; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.item .meta { display:flex; gap:5px; margin-top:6px; flex-wrap:wrap; }
.tag { font-size:10px; font-weight:500; padding:1px 7px; border-radius:3px; background:var(--bg-2); color:var(--fg-mute); text-transform:lowercase; letter-spacing:.02em; }
.tag.anthropic { background:rgba(217,119,87,.14); color:var(--accent); }
.tag.popular   { background:rgba(251,191,36,.12);  color:var(--warn); }
.tag.community { background:rgba(74,222,128,.12);  color:var(--ok); }

/* Buttons */
.btn { border:1px solid var(--line); background:var(--bg-1); color:var(--fg); font:inherit; font-size:11.5px; font-weight:500; padding:5px 12px; border-radius:var(--r-sm); cursor:pointer; transition:all .1s; display:inline-flex; align-items:center; gap:5px; white-space:nowrap; }
.btn:hover { background:var(--bg-2); border-color:var(--line-2); }
.btn svg { width:12px; height:12px; }
.btn-primary { background:var(--accent); border-color:var(--accent); color:#fff; }
.btn-primary:hover { background:var(--accent-hi); border-color:var(--accent-hi); }
.btn-installed { background:transparent; border-color:rgba(74,222,128,.3); color:var(--ok); cursor:default; }
.btn-installed:hover { background:transparent; }
.btn-installed-rm { background:transparent; border-color:rgba(74,222,128,.3); color:var(--ok); cursor:pointer; transition:all .15s; }
.btn-installed-rm:hover { border-color:rgba(248,113,113,.4); background:rgba(248,113,113,.08); color:var(--err); }
.btn-danger { background:transparent; color:var(--err); border-color:rgba(248,113,113,.3); }
.btn-danger:hover { background:rgba(248,113,113,.08); border-color:var(--err); }
.btn-sm { padding:3px 9px; font-size:11px; }

/* Section headers */
.section-h { display:flex; align-items:baseline; justify-content:space-between; margin:22px 0 10px; }
.section-h:first-child { margin-top:0; }
.section-h h3 { font-size:11px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:var(--fg-mute); }
.empty { text-align:center; color:var(--fg-dim); font-size:12px; padding:24px 0; background:var(--bg-1); border:1px dashed var(--line); border-radius:var(--r); }

/* Forms */
.form-group { margin-bottom:14px; }
.form-label { display:block; font-size:11px; font-weight:500; color:var(--fg-mute); margin-bottom:5px; letter-spacing:.04em; text-transform:uppercase; }
.form-input,.form-select,.form-textarea { width:100%; background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r); padding:7px 10px; font:inherit; font-size:12px; color:var(--fg); outline:none; transition:border-color .12s; }
.form-input:focus,.form-select:focus,.form-textarea:focus { border-color:var(--accent-line); box-shadow:0 0 0 3px var(--accent-bg); }
.form-textarea { font-family:var(--mono); font-size:11px; resize:vertical; min-height:120px; }
.form-select { cursor:pointer; }
.status { font-size:11.5px; padding:8px 12px; border-radius:var(--r); margin-top:10px; }
.status.ok  { background:rgba(74,222,128,.1);  color:var(--ok);  border:1px solid rgba(74,222,128,.25); }
.status.err { background:rgba(248,113,113,.1); color:var(--err); border:1px solid rgba(248,113,113,.25); }

/* Scrollbar */
::-webkit-scrollbar { width:8px; height:8px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:var(--line); border-radius:4px; }
::-webkit-scrollbar-thumb:hover { background:var(--line-2); }`;
