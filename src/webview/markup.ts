import { S } from './icons';

export interface MarkupParams {
  hasProject: boolean;
  projectName?: string;
  activeModel: string;
  catChips: string;
  mcpCatChips: string;
  createCatOptions: string;
}

// Panel body markup (everything between <body> and the inline <script>).
export function bodyMarkup(p: MarkupParams): string {
  const { hasProject, projectName, activeModel, catChips, mcpCatChips, createCatOptions } = p;
  return /* html */`<div class="app">

  <!-- Header -->
  <div class="hdr">
    <div class="hdr-mark">${S.logo}</div>
    <div class="hdr-text">
      <div class="hdr-title">Claude Deck</div>
      <div class="hdr-sub">Skills · MCP · Hooks · Memory</div>
    </div>
    <button class="undo-btn" id="undoBtn" style="display:none" onclick="undoLast()"><span id="undoLabel">Undo</span></button>
    <div class="scope">
      <button class="scope-btn global${hasProject ? '' : ' active'}" id="scopeGlobal" onclick="setScope('global')">
        <i class="dot"></i><span class="label">Global</span>
      </button>
      <button class="scope-btn project${hasProject ? ' active' : ' disabled'}" id="scopeProject"
        onclick="${hasProject ? "setScope('project')" : ''}">
        <i class="dot"></i><span class="label">${projectName ?? 'Project'}</span>
      </button>
    </div>
  </div>

  <!-- Tabs -->
  <div class="tabs">
    <button class="tab active" data-tab="stack">${S.layers}<span>Stack</span></button>
    <button class="tab" data-tab="skills">${S.command}<span>Skills</span><span class="count" id="cnt-skills">0</span></button>
    <button class="tab" data-tab="mcp">${S.plug}<span>MCP</span><span class="count" id="cnt-mcp">0</span></button>
    <button class="tab" data-tab="hooks">${S.hook}<span>Hooks</span><span class="count" id="cnt-hooks">0</span></button>
    <button class="tab" data-tab="perms">${S.shield}<span>Permissions</span><span class="count" id="cnt-perms">0</span></button>
    <button class="tab" data-tab="memory">${S.brain}<span>Memory</span><span class="count" id="cnt-memory">0</span></button>
    <button class="tab" data-tab="git">${S.branch}<span>Git</span></button>
    <button class="tab" data-tab="sessions">${S.clock}<span>Sessions</span></button>
    <button class="tab" data-tab="chat">${S.chat}<span>Chat</span></button>
  </div>

  <div class="panels">

    <!-- STACK -->
    <div class="panel active" id="panel-stack">
      <div id="stack-overview-card" style="margin-bottom:22px"></div>
      <div class="arch">
        <div class="arch-h">
          <h3>Architecture</h3>
        </div>
        <div class="arch-stack">
          <div class="arch-row">
            <div class="icn">${S.doc}</div>
            <div><div class="name">System Prompt</div><div class="desc">Skills + Memory injected at session start</div></div>
            <div class="pills"><span class="pill" id="arch-skills-pill"><i class="dot"></i><span id="arch-skills">0</span> skills</span></div>
          </div>
          <div class="arch-row live">
            <div class="icn">${S.bot}</div>
            <div><div class="name">Orchestrator</div><div class="desc" id="orchestrator-model">${activeModel}</div></div>
            <div class="pills"><span class="pill live">active</span></div>
          </div>
          <div class="arch-row">
            <div class="icn">${S.layers}</div>
            <div><div class="name">Capabilities</div><div class="desc">Skills · MCP · Hooks · Native tools</div></div>
            <div class="pills"><span class="pill" id="arch-total-pill"><i class="dot"></i><span id="arch-total">0</span> active</span></div>
          </div>
          <div class="arch-row">
            <div class="icn">${S.cube}</div>
            <div><div class="name">Artifacts</div><div class="desc">DOCX · PPTX · Code · SVG</div></div>
            <div class="pills"><span class="pill muted">5 formats</span></div>
          </div>
          <div class="arch-row">
            <div class="icn">${S.monitor}</div>
            <div><div class="name">Delivery</div><div class="desc">Claude Code · API · Claude.ai</div></div>
            <div class="pills"><span class="pill accent">Claude Code</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- SKILLS -->
    <div class="panel" id="panel-skills">
      <div class="scope-banner global" id="skills-banner">
        <span id="skills-banner-icon">${S.globe}</span>
        <span id="skills-banner-label">Global</span>
        <span class="path" id="skills-banner-path">~/.claude/commands/</span>
      </div>
      <div class="subtabs">
        <button class="subtab active" data-ssub="browse">Browse</button>
        <button class="subtab" data-ssub="installed">Installed <span class="count" id="ssub-inst-count">0</span></button>
        <button class="subtab" data-ssub="create">${S.plus}<span>Create</span></button>
      </div>
      <div id="skills-browse">

        <div class="chips">
          <button class="chip active" data-scat="all"><span>All</span></button>
          ${catChips}
        </div>
        <div class="list" id="skill-list"></div>
      </div>
      <div id="skills-installed" style="display:none">
        <div class="section-h">
          <h3 id="inst-path">~/.claude/commands/</h3>
          <button class="btn btn-sm" onclick="openCommandsDir()">${S.external}<span>Open</span></button>
        </div>
        <div class="list" id="installed-list"></div>
      </div>
      <div id="skills-create" style="display:none">
        <div class="form-group">
          <label class="form-label">Skill name (slug)</label>
          <input class="form-input" id="create-name" placeholder="my-skill" oninput="previewCreateTemplate()">
        </div>
        <div class="form-group">
          <label class="form-label">Title</label>
          <input class="form-input" id="create-title" placeholder="My Skill" oninput="previewCreateTemplate()">
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input class="form-input" id="create-desc" placeholder="What this skill does" oninput="previewCreateTemplate()">
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-select" id="create-cat" onchange="previewCreateTemplate()">
            ${createCatOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Content (Markdown)</label>
          <textarea class="form-textarea" id="create-content"></textarea>
        </div>
        <button class="btn btn-primary" id="create-submit-btn" onclick="createSkill()">${S.plus}<span>Create Skill</span></button>
        <div id="create-status"></div>
      </div>
    </div>

    <!-- MCP -->
    <div class="panel" id="panel-mcp">
      <div class="scope-banner global" id="mcp-banner">
        <span id="mcp-banner-icon">${S.globe}</span>
        <span id="mcp-banner-label">Global</span>
        <span class="path" id="mcp-banner-path">~/.claude/settings.json</span>
      </div>
      <div class="section-h">
        <h3>Active MCP servers</h3>
        <button class="btn btn-sm" onclick="openSettings()">${S.external}<span>settings.json</span></button>
      </div>
      <div class="list" id="mcp-active-list"></div>
      <div class="section-h"><h3>Add from catalog</h3></div>
      <div class="chips" id="mcp-cat-chips">
        <button class="chip active" data-mcat="all"><span>All</span></button>
        ${mcpCatChips}
      </div>
      <div class="list" id="mcp-catalog-list"></div>
      <div class="section-h" style="margin-top:22px"><h3>Add custom server</h3></div>
      <div class="form-group">
        <label class="form-label">Server key</label>
        <input class="form-input" id="mcp-name" placeholder="my-server">
      </div>
      <div class="form-group">
        <label class="form-label">Command</label>
        <input class="form-input" id="mcp-cmd" placeholder="npx">
      </div>
      <div class="form-group">
        <label class="form-label">Args (space-separated)</label>
        <input class="form-input" id="mcp-args" placeholder="-y @scope/mcp-server">
      </div>
      <button class="btn btn-primary" onclick="addCustomMCP()">${S.plus}<span>Add Server</span></button>
      <div id="mcp-status"></div>
    </div>

    <!-- HOOKS -->
    <div class="panel" id="panel-hooks">
      <div class="scope-banner global" id="hooks-banner">
        <span id="hooks-banner-icon">${S.globe}</span>
        <span id="hooks-banner-label">Global</span>
        <span class="path" id="hooks-banner-path">~/.claude/settings.json</span>
      </div>
      <div class="section-h">
        <h3>Active hooks</h3>
        <button class="btn btn-sm" onclick="openSettings()">${S.external}<span>settings.json</span></button>
      </div>
      <div class="list" id="hooks-active-list"></div>
      <div class="section-h" style="margin-top:22px"><h3>Disabled hooks</h3></div>
      <div class="list" id="hooks-disabled-list"></div>
      <div class="section-h"><h3>Add from templates</h3></div>
      <div class="list" id="hooks-templates-list"></div>
      <div class="section-h" style="margin-top:22px"><h3>Add custom hook</h3></div>
      <div class="form-group">
        <label class="form-label">Event</label>
        <select class="form-select" id="hook-event">
          <option value="PreToolUse">PreToolUse</option>
          <option value="PostToolUse">PostToolUse</option>
          <option value="Stop">Stop</option>
          <option value="Notification">Notification</option>
          <option value="UserPromptSubmit">UserPromptSubmit</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Matcher (tool name or *)</label>
        <input class="form-input" id="hook-matcher" placeholder="*">
      </div>
      <div class="form-group">
        <label class="form-label">Command</label>
        <input class="form-input" id="hook-cmd" placeholder="echo hook fired">
      </div>
      <button class="btn btn-primary" onclick="addCustomHook()">${S.plus}<span>Add Hook</span></button>
      <div id="hooks-status"></div>
    </div>

    <!-- PERMISSIONS -->
    <div class="panel" id="panel-perms">
      <div class="scope-banner global" id="perms-banner">
        <span id="perms-banner-icon">${S.globe}</span>
        <span id="perms-banner-label">Global</span>
        <span class="path" id="perms-banner-path">~/.claude/settings.json</span>
      </div>
      <div class="section-h">
        <h3>Default mode</h3>
        <button class="btn btn-sm" onclick="openSettings()">${S.external}<span>settings.json</span></button>
      </div>
      <div class="form-group">
        <select class="form-select" id="perm-mode" onchange="changeDefaultMode()">
          <option value="">(not set)</option>
          <option value="default">default — ask before most actions</option>
          <option value="acceptEdits">acceptEdits — auto-accept file edits</option>
          <option value="plan">plan — read-only planning</option>
          <option value="auto">auto — classifier decides (global only)</option>
          <option value="dontAsk">dontAsk — deny anything not allowed</option>
          <option value="bypassPermissions">bypassPermissions — no prompts (dangerous)</option>
        </select>
        <div class="desc" id="perm-mode-note" style="margin-top:6px"></div>
      </div>
      <div class="section-h" style="margin-top:22px"><h3>Allow</h3></div>
      <div class="list" id="perm-list-allow"></div>
      <div class="section-h" style="margin-top:22px"><h3>Ask</h3></div>
      <div class="list" id="perm-list-ask"></div>
      <div class="section-h" style="margin-top:22px"><h3>Deny</h3></div>
      <div class="list" id="perm-list-deny"></div>
      <div class="section-h" style="margin-top:22px"><h3>Add rule</h3></div>
      <div class="form-group">
        <label class="form-label">List</label>
        <select class="form-select" id="perm-add-list">
          <option value="allow">allow</option>
          <option value="ask">ask</option>
          <option value="deny">deny</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Rule (e.g. Bash(git status), Read(./src/**), mcp__server__tool)</label>
        <input class="form-input" id="perm-add-rule" placeholder="Bash(git status)">
      </div>
      <button class="btn btn-primary" onclick="addPermission()">${S.plus}<span>Add Rule</span></button>
      <div id="perm-status"></div>
    </div>

    <!-- MEMORY -->
    <div class="panel" id="panel-memory">
      <div class="section-h">
        <h3>Memory files</h3>
        <span style="font-family:var(--mono);font-size:11px;color:var(--fg-dim)">~/.claude/projects/*/memory/</span>
      </div>
      <div class="list" id="memory-list"></div>
      <div id="memory-viewer" style="display:none;margin-top:16px">
        <div class="section-h" style="margin-top:0">
          <h3 id="memory-viewer-name"></h3>
          <button class="btn btn-sm" onclick="closeMemoryViewer()">Close</button>
        </div>
        <pre id="memory-viewer-content" style="background:var(--bg-1);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;font-family:var(--mono);font-size:11px;color:var(--fg-mute);overflow:auto;max-height:400px;white-space:pre-wrap;word-break:break-word"></pre>
      </div>
    </div>

    <!-- GIT -->
    <div class="panel" id="panel-git">
      <div id="git-no-project" style="display:none" class="empty">Open a project folder to use Git.</div>
      <div id="git-content">
        <div class="section-h">
          <h3>Changes <span id="git-branch" class="tag" style="margin-left:8px"></span></h3>
          <button class="btn btn-sm" onclick="requestGitStatus()">Refresh</button>
        </div>
        <div class="list" id="git-files-list"></div>
        <div class="form-group" style="margin-top:16px">
          <label class="form-label">Commit message</label>
          <textarea class="form-textarea" id="git-commit-msg" placeholder="Describe the change"></textarea>
        </div>
        <button class="btn btn-primary" onclick="doGitCommit()">${S.check}<span>Commit</span></button>
        <div id="git-status"></div>
      </div>
    </div>

    <!-- SESSIONS -->
    <div class="panel" id="panel-sessions">
      <div class="section-h">
        <h3>Claude sessions</h3>
        <span style="font-family:var(--mono);font-size:11px;color:var(--fg-dim)">~/.claude/projects/*/*.jsonl</span>
      </div>
      <div class="list" id="sessions-list"></div>
    </div>

    <!-- CHAT -->
    <div class="panel" id="panel-chat">
      <div class="section-h">
        <h3>Chat</h3>
        <button class="btn btn-sm" onclick="checkChatCli()">Test connection</button>
      </div>
      <div id="chat-cli-status" class="empty">Click "Test connection" to check the claude CLI.</div>
      <div id="chat-messages" style="margin-top:14px;display:flex;flex-direction:column;gap:10px;max-height:420px;overflow:auto"></div>
      <div class="form-group" style="margin-top:14px">
        <textarea class="form-textarea" id="chat-input" placeholder="Message Claude…" rows="3"></textarea>
      </div>
      <button class="btn btn-primary" id="chat-send-btn" onclick="sendChat()">${S.chat}<span>Send</span></button>
      <div id="chat-status"></div>
    </div>

  </div>
</div>
<div class="modal-back" id="modal" style="display:none">
  <div class="modal">
    <div class="modal-title" id="modal-title"></div>
    <div id="modal-edit" style="display:none">
      <div class="form-group"><label class="form-label">Server</label><input class="form-input" id="med-name" disabled></div>
      <div class="form-group"><label class="form-label">Command</label><input class="form-input" id="med-cmd"></div>
      <div class="form-group"><label class="form-label">Args (one per line)</label><textarea class="form-textarea" id="med-args" rows="4"></textarea></div>
      <div class="form-group"><label class="form-label">Env (KEY=VALUE per line)</label><textarea class="form-textarea" id="med-env" rows="4"></textarea></div>
      <div id="med-status"></div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()"><span>Cancel</span></button>
        <button class="btn btn-primary" onclick="reviewMCPEdit()"><span>Review changes</span></button>
      </div>
    </div>
    <div id="modal-diff" style="display:none">
      <div class="modal-note" id="diff-note"></div>
      <div class="diff" id="diff-body"></div>
      <div class="modal-actions">
        <button class="btn" onclick="diffBack()"><span id="diff-back-label">Back</span></button>
        <button class="btn btn-primary" id="diff-apply" onclick="applyDiff()"><span>Apply</span></button>
      </div>
    </div>
  </div>
</div>`;
}
