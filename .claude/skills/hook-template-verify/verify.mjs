import { buildSync } from 'esbuild';
import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, symlinkSync } from 'fs';
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

// ---- quality / workflow templates: run in throwaway projects, skip when the tool is missing ----
const repo = process.cwd();
const NL = String.fromCharCode(10);
const tpl = id => HOOK_TEMPLATES.find(x => x.id === id).command;
const hasBin = b => spawnSync(process.platform === 'win32' ? 'where' : 'which', [b]).status === 0;
const proj = () => mkdtempSync(join(tmpdir(), 'hook-proj-'));
const call = (id, file, cwd, extra = {}) => spawnSync('bash', ['-c', tpl(id)], {
  input: JSON.stringify({ tool_input: file ? { file_path: file } : extra }), encoding: 'utf8', cwd,
  env: { ...process.env, ...(extra.env || {}) },
});
const note = (label, ok, detail = '') => { if (!ok) failed++; console.log(ok ? 'PASS' : 'FAIL', label, detail); };
const skip = label => console.log('SKIP', label, '(tool not available)');

{ // auto-stage
  const d = proj(); spawnSync('git', ['init'], { cwd: d }); writeFileSync(join(d, 'a.txt'), 'x');
  const r = call('auto-stage', join(d, 'a.txt'), d);
  note('auto-stage stages the file', r.status === 0 && spawnSync('git', ['diff', '--cached', '--name-only'], { cwd: d, encoding: 'utf8' }).stdout.includes('a.txt'));
}
{ // backup-before-edit
  const d = proj(); writeFileSync(join(d, 'a.txt'), 'orig');
  const r = call('backup-before-edit', join(d, 'a.txt'), d);
  note('backup-before-edit writes .bak', r.status === 0 && existsSync(join(d, 'a.txt.bak')) && readFileSync(join(d, 'a.txt.bak'), 'utf8') === 'orig');
}
{ // log-bash (HOME redirected so the real ~/.claude is untouched)
  const d = proj(); const home = proj(); spawnSync('node', ['-e', 'require("fs").mkdirSync(process.argv[1]+"/.claude")', home]);
  const r = spawnSync('bash', ['-c', tpl('log-bash')], { input: JSON.stringify({ tool_input: { command: 'echo hi' } }), encoding: 'utf8', cwd: d, env: { ...process.env, HOME: home, USERPROFILE: home } });
  note('log-bash appends to bash.log', r.status === 0 && existsSync(join(home, '.claude', 'bash.log')) && readFileSync(join(home, '.claude', 'bash.log'), 'utf8').includes('echo hi'));
}
{ // wrong extension and bad JSON must be harmless (exit 0)
  const d = proj(); writeFileSync(join(d, 'a.txt'), 'x');
  for (const id of ['eslint-after-edit', 'pytest-after-edit', 'typecheck-after-ts', 'prettier-after-edit', 'gofmt-after-edit', 'ruff-after-edit'])
    note(`${id} ignores unrelated file`, call(id, join(d, 'a.txt'), d).status === 0);
  note('quality hook tolerates bad JSON', spawnSync('bash', ['-c', tpl('ruff-after-edit')], { input: 'not json', encoding: 'utf8', cwd: d }).status === 0);
}
if (hasBin('gofmt')) {
  const d = proj(); const f = join(d, 'a.go'); writeFileSync(f, ['package main', 'func  main( ) {  }', ''].join(NL));
  const r = call('gofmt-after-edit', f, d);
  note('gofmt formats a Go file', r.status === 0 && readFileSync(f, 'utf8').includes('func main() {}'));
  writeFileSync(f, ['package main', 'func main( {', ''].join(NL));
  note('gofmt reports a syntax error (exit 2)', call('gofmt-after-edit', f, d).status === 2);
} else skip('gofmt');
if (hasBin('ruff')) {
  const d = proj(); const f = join(d, 'a.py'); writeFileSync(f, 'x   =  1' + NL);
  const r = call('ruff-after-edit', f, d);
  note('ruff formats a Python file', r.status === 0 && readFileSync(f, 'utf8').trim() === 'x = 1');
  writeFileSync(f, 'print(undefined_name)' + NL);
  note('ruff reports a lint error (exit 2)', call('ruff-after-edit', f, d).status === 2);
} else skip('ruff');
if (spawnSync(process.platform === 'win32' ? 'python' : 'python3', ['-m', 'pytest', '--version']).status === 0) {
  const d = proj(); const f = join(d, 'test_a.py');
  note('pytest with no tests is not an error', call('pytest-after-edit', f, d).status === 0);
  writeFileSync(f, ['def test_ok():', '    assert True', ''].join(NL));
  note('pytest passes', call('pytest-after-edit', f, d).status === 0);
  writeFileSync(f, ['def test_bad():', '    assert False', ''].join(NL));
  note('pytest failure reported (exit 2)', call('pytest-after-edit', f, d).status === 2);
} else skip('pytest');
if (existsSync(join(repo, 'node_modules', '.bin', 'tsc'))) {
  const d = proj(); symlinkSync(join(repo, 'node_modules'), join(d, 'node_modules'), 'junction');
  writeFileSync(join(d, 'tsconfig.json'), '{"compilerOptions":{"strict":true,"noEmit":true},"include":["*.ts"]}');
  const f = join(d, 'a.ts'); writeFileSync(f, 'export const n: number = 1;' + NL);
  note('tsc passes on valid TypeScript', call('typecheck-after-ts', f, d).status === 0);
  writeFileSync(f, 'export const n: number = "x";' + NL);
  note('tsc type error reported (exit 2)', call('typecheck-after-ts', f, d).status === 2);
} else skip('tsc');
for (const b of ['eslint', 'prettier']) if (!existsSync(join(repo, 'node_modules', '.bin', b))) skip(`${b} (positive case not run)`);

console.log(failed ? `${failed} FAILED` : 'all passed');
process.exit(failed ? 1 : 0);
