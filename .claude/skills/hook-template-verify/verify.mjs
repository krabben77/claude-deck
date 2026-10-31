import { buildSync } from 'esbuild';
import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createRequire } from 'module';

const out = join(mkdtempSync(join(tmpdir(), 'hook-verify-')), 'ht.cjs');
buildSync({ entryPoints: ['src/data/hookTemplates.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: out, external: ['../settingsManager'] });
const { HOOK_TEMPLATES } = createRequire(import.meta.url)(out);

const bs = String.fromCharCode(92);
const cases = {
  'block-rm-rf': [[{ command: 'rm -rf /tmp/x' }, 2], [{ command: 'ls' }, 0]],
  'block-force-push': [[{ command: 'git push --force origin main' }, 2], [{ command: 'git push -f' }, 2], [{ command: 'git push origin feature-fix' }, 0]],
  'block-env-write': [[{ file_path: 'C:' + bs + 'p' + bs + '.env' }, 2], [{ file_path: '/a/b.ts' }, 0]],
  'block-drop-table': [[{ command: 'psql -c "DROP TABLE x"' }, 2], [{ command: 'ls' }, 0]],
  'block-prod-env': [[{ file_path: 'C:' + bs + 'a' + bs + 'prod' + bs + 'c.json' }, 2], [{ file_path: '/a/x.prod.yml' }, 2], [{ file_path: '/a/dev.ts' }, 0]],
  'block-secret-commit': [[{ command: 'git status' }, 0]],
};

const run = (cmd, input, cwd) => spawnSync('bash', ['-c', cmd], { input, encoding: 'utf8', cwd });
let failed = 0;
const check = (label, r, expected) => {
  const ok = r.status === expected;
  if (!ok) failed++;
  console.log(ok ? 'PASS' : 'FAIL', label, 'exit', r.status, (r.stderr || '').trim());
};

for (const [id, cs] of Object.entries(cases)) {
  const t = HOOK_TEMPLATES.find(x => x.id === id);
  if (!t) { failed++; console.log('FAIL missing template', id); continue; }
  for (const [inp, exp] of cs) check(`${id} ${JSON.stringify(inp)}`, run(t.command, JSON.stringify({ tool_input: inp })), exp);
  check(`${id} bad-json (fail closed)`, run(t.command, 'not json'), 2);
}

// block-secret-commit needs a real staged secret
const d = mkdtempSync(join(tmpdir(), 'hook-secret-'));
spawnSync('git', ['init'], { cwd: d });
writeFileSync(join(d, 'k.txt'), 'key=ghp_abcdefghijklmnop');
spawnSync('git', ['add', '.'], { cwd: d });
const sc = HOOK_TEMPLATES.find(x => x.id === 'block-secret-commit');
check('block-secret-commit staged secret', run(sc.command, JSON.stringify({ tool_input: { command: 'git commit -m x' } }), d), 2);

console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
