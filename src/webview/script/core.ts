// Constants injected from the extension and shared state variables.
import { S } from '../icons';

export interface CoreParams {
  skills: unknown;
  mcpCatalog: unknown;
  hookTemplates: unknown;
  hasProject: boolean;
  projectPath?: string;
  projectName?: string;
}

export function coreJs(p: CoreParams): string {
  const { skills, mcpCatalog, hookTemplates, hasProject, projectPath, projectName } = p;
  return `const vscode = acquireVsCodeApi();
const SKILLS_DATA = ${JSON.stringify(skills)};
const MCP_CATALOG_DATA = ${JSON.stringify(mcpCatalog)};
const HOOK_TEMPLATES_DATA = ${JSON.stringify(hookTemplates)};
const HAS_PROJECT = ${JSON.stringify(hasProject)};
const PROJECT_PATH = ${JSON.stringify(projectPath ?? '')};
const PROJECT_NAME = ${JSON.stringify(projectName ?? 'Project')};
const GLOBE_SVG = ${JSON.stringify(S.globe)};
const FOLDER_SVG = ${JSON.stringify(S.folder)};
const SHIELD_SVG = ${JSON.stringify(S.shield)};

let scope = HAS_PROJECT ? 'project' : 'global';
let stackData = null;
let installedGlobal = [];
let installedProject = [];
let skillCatFilter = 'all';
let mcpCatFilter = 'all';
let activeHooks = [];
let disabledHooks = [];
let editingSkillName = null;
let removePending = {};
`;
}
