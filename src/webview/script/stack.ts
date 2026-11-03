// Stack tab, health card and icon constants.
import { S, CAT_ICONS } from '../icons';

export const STACK_JS = `// ── Stack ─────────────────────────────────────────────────────
var CMD_SVG     = ${JSON.stringify(S.command)};
var PLUG_SVG    = ${JSON.stringify(S.plug)};
var HOOK_SVG    = ${JSON.stringify(S.hook)};
var ARROW_SVG   = ${JSON.stringify(S.arrow)};
var TRASH_SVG   = ${JSON.stringify(S.trash)};
var PLUS_SVG    = ${JSON.stringify(S.plus)};
var CHECK_SVG   = ${JSON.stringify(S.check)};
var BRAIN_SVG   = ${JSON.stringify(S.brain)};
var CLOCK_SVG   = ${JSON.stringify(S.clock)};
var LIGHT_SVG   = ${JSON.stringify(S.lightning)};
var EXT_SVG     = ${JSON.stringify(S.external)};
var CAT_ICONS_MAP = ${JSON.stringify(CAT_ICONS)};
var ICON_SVG_MAP = {
  code:     ${JSON.stringify(S.code)},
  flask:    ${JSON.stringify(S.flask)},
  doc:      ${JSON.stringify(S.doc)},
  branch:   ${JSON.stringify(S.branch)},
  shield:   ${JSON.stringify(S.shield)},
  rocket:   ${JSON.stringify(S.rocket)},
  database: ${JSON.stringify(S.database)},
  command:  ${JSON.stringify(S.command)},
};

function getSkillIcon(category) {
  var key = CAT_ICONS_MAP[category];
  return ICON_SVG_MAP[key] || ICON_SVG_MAP.command;
}

function goToTab(tabId, scp) {
  if (scp && scp !== scope) {
    scope = scp;
    document.getElementById(scp === 'global' ? 'scopeGlobal' : 'scopeProject').click();
  }
  document.querySelector('.tab[data-tab="' + tabId + '"]').click();
}

function renderHealth(issues) {
  var body = issues.length
    ? issues.map(function(i) { return '<div class="h-item ' + i.level + '">' + (i.level === 'error' ? 'x ' : '! ') + e(i.message) + '</div>'; }).join('')
    : '<div class="h-ok">No problems found in settings, MCP servers or hooks.</div>';
  return '<div class="health-card"><div class="h-title">Health check</div>' + body + '</div>';
}

function renderStack() {
  var el = document.getElementById('stack-overview-card');
  if (!el) return;

  var isGlobal = scope === 'global';
  var scopeClass = isGlobal ? 'global' : 'project';
  var title = isGlobal ? 'Global' : PROJECT_NAME;
  var path  = isGlobal ? '~/.claude/' : PROJECT_PATH + '/.claude/';

  if (!isGlobal && !HAS_PROJECT) {
    el.innerHTML = '<div class="col-card">' +
      '<div class="col-head project"><i class="dot"></i><span class="title">' + e(PROJECT_NAME) + '</span></div>' +
      '<div class="empty-col">Open a workspace folder<br>to manage project-level config.<br><br>Settings live in <code>.claude/</code></div>' +
    '</div>';
    return;
  }

  if (!stackData) {
    el.innerHTML = '<div class="col-card"><div class="col-head ' + scopeClass + '"><i class="dot"></i><span class="title">' + e(title) + '</span><span class="path">' + e(path) + '</span></div><div class="empty-col">Loading…</div></div>';
    return;
  }

  var d = isGlobal ? stackData.global : stackData.project;
  var skills = d.skills;
  var mcps   = d.mcps.length;
  var hooks  = d.hooks.length;
  var total  = skills + mcps + hooks;

  el.innerHTML = '<div class="col-card">' +
    '<div class="col-head ' + scopeClass + '"><i class="dot"></i><span class="title">' + e(title) + '</span><span class="path">' + e(path) + '</span></div>' +
    '<div class="col-rows">' +
      '<div class="col-row" data-goto="skills" data-scp="' + scope + '">' +
        '<div class="icn">' + CMD_SVG + '</div>' +
        '<div class="lbl">Skills<small>slash commands</small></div>' +
        '<div class="num">' + skills + '</div>' +
        '<div class="arrow">' + ARROW_SVG + '</div>' +
      '</div>' +
      '<div class="col-row" data-goto="mcp" data-scp="' + scope + '">' +
        '<div class="icn">' + PLUG_SVG + '</div>' +
        '<div class="lbl">MCP servers<small>external tools</small></div>' +
        '<div class="num">' + mcps + '</div>' +
        '<div class="arrow">' + ARROW_SVG + '</div>' +
      '</div>' +
      '<div class="col-row" data-goto="hooks" data-scp="' + scope + '">' +
        '<div class="icn">' + HOOK_SVG + '</div>' +
        '<div class="lbl">Hooks<small>pre/post tool events</small></div>' +
        '<div class="num">' + hooks + '</div>' +
        '<div class="arrow">' + ARROW_SVG + '</div>' +
      '</div>' +
    '</div>' +
  '</div>' + renderHealth(d.health || []);

  // Update arch pills to reflect current scope
  var pill1 = document.getElementById('arch-skills-pill');
  var pill2 = document.getElementById('arch-total-pill');
  if (pill1) pill1.className = 'pill ' + scopeClass;
  if (pill2) pill2.className = 'pill ' + scopeClass;
  setInner('arch-skills', skills);
  setInner('arch-total',  total);

  updateCounts();
}
`;
