import * as settings from './settingsManager';
import { CURATED_SKILLS, CATEGORIES } from './data/curatedSkills';
import { MCP_CATALOG, MCP_CATEGORIES } from './data/mcpCatalog';
import { HOOK_TEMPLATES } from './data/hookTemplates';
import { S, CAT_ICONS } from './webview/icons';
import { CSS } from './webview/styles';
import { bodyMarkup } from './webview/markup';
import { buildScript } from './webview/script';

export { WebviewContext, handleMessage, sendInstalled, sendStack } from './webview/messages';

export function buildWebviewHtml(projectPath?: string, projectName?: string): string {
  const hasProject = !!projectPath;
  const activeModel = settings.getActiveModel(projectPath);
  const skills = CURATED_SKILLS.map(s => ({
    id: s.id, name: s.name, title: s.title,
    description: s.description, category: s.category, source: s.source,
  }));
  const mcpCatalog = MCP_CATALOG.map(m => ({
    id: m.id, name: m.name, serverKey: m.serverKey,
    description: m.description, category: m.category, icon: m.icon,
    npm: m.npm ?? '', configTemplate: m.configTemplate, envVars: m.envVars ?? [],
  }));
  const hookTemplates = HOOK_TEMPLATES.map(t => ({
    id: t.id, name: t.name, description: t.description,
    event: t.event, matcher: t.matcher, command: t.command,
  }));

  const catChips = CATEGORIES.map(c =>
    `<button class="chip" data-scat="${c.id}"><span class="icn">${S[CAT_ICONS[c.id] ?? 'command']}</span><span>${c.label}</span></button>`
  ).join('');

  const mcpCatChips = MCP_CATEGORIES.map(c =>
    `<button class="chip" data-mcat="${c.id}">${c.label}</button>`
  ).join('');

  const createCatOptions = CATEGORIES.map(c =>
    `<option value="${c.id}">${c.label}</option>`
  ).join('');

  return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>
${CSS}
</style>
</head>
<body>
${bodyMarkup({ hasProject, projectName, activeModel, catChips, mcpCatChips, createCatOptions })}
<script>
${buildScript({ skills, mcpCatalog, hookTemplates, hasProject, projectPath, projectName })}
</script>
</body>
</html>`;
}
