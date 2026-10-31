import { build } from 'esbuild';
import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createRequire } from 'module';

const dir = mkdtempSync(join(tmpdir(), 'webview-guard-'));
const out = join(dir, 'w.cjs');
const stub = {
  name: 'vscode-stub',
  setup(b) {
    b.onResolve({ filter: /^vscode$/ }, () => ({ path: 'vscode', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: 'module.exports = new Proxy(function(){}, { get: () => new Proxy(function(){}, { get: () => () => {} }) });',
      loader: 'js',
    }));
  },
};
await build({ entryPoints: ['src/webviewShared.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: out, plugins: [stub], logLevel: 'silent' });
const { buildWebviewHtml } = createRequire(import.meta.url)(out);
const html = buildWebviewHtml('/proj', 'proj');
const scripts = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (!scripts.length) { console.error('FAIL no inline <script> found'); process.exit(1); }

let failed = 0;
scripts.forEach((js, i) => {
  const f = join(dir, `s${i}.js`);
  writeFileSync(f, js);
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) { failed++; console.error(`FAIL script ${i}\n${r.stderr}`); }
  else console.log(`PASS script ${i} (${js.split('\n').length} lines)`);
});
process.exit(failed ? 1 : 0);
