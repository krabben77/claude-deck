import { coreJs, CoreParams } from './core';
import { SCOPE_JS } from './scope';
import { NAV_JS } from './nav';
import { STACK_JS } from './stack';
import { SKILLS_JS } from './skills';
import { MODAL_JS } from './modal';
import { MCP_JS } from './mcp';
import { HOOKS_JS } from './hooks';
import { PERMISSIONS_JS } from './permissions';
import { MEMORY_JS } from './memory';
import { GIT_JS } from './git';
import { SESSIONS_JS } from './sessions';
import { CHAT_JS } from './chat';
import { UTILS_JS } from './utils';
import { EVENTS_JS } from './events';
import { INIT_JS } from './init';

// Concatenates the panel's inline script in its original order.
export function buildScript(p: CoreParams): string {
  return [
    coreJs(p),
    SCOPE_JS,
    NAV_JS,
    STACK_JS,
    SKILLS_JS,
    MODAL_JS,
    MCP_JS,
    HOOKS_JS,
    PERMISSIONS_JS,
    MEMORY_JS,
    GIT_JS,
    SESSIONS_JS,
    CHAT_JS,
    UTILS_JS,
    EVENTS_JS,
    INIT_JS,
  ].join('\n');
}
