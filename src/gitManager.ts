import { execFile } from 'child_process';

export interface GitFileChange {
  path: string;
  status: string;
}

export interface GitStatus {
  branch: string;
  files: GitFileChange[];
  error?: string;
}

export interface GitCommitResult {
  ok: boolean;
  output: string;
}

function run(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd }, (err, stdout, stderr) => {
      if (err) { reject(new Error(stderr?.trim() || err.message)); return; }
      resolve(stdout);
    });
  });
}

export async function getStatus(cwd: string): Promise<GitStatus> {
  try {
    const stdout = await run(cwd, ['status', '--porcelain=v1', '-b']);
    const lines = stdout.split('\n').filter(l => l.length > 0);
    const branchLine = lines.find(l => l.startsWith('##'));
    const branch = branchLine ? branchLine.slice(3).split('...')[0].trim() : '';
    const files = lines
      .filter(l => !l.startsWith('##'))
      .map(l => ({ status: l.slice(0, 2).trim(), path: l.slice(3).trim() }));
    return { branch, files };
  } catch (e) {
    return { branch: '', files: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export async function commit(cwd: string, files: string[], message: string): Promise<GitCommitResult> {
  try {
    if (files.length > 0) {
      await run(cwd, ['add', '--', ...files]);
    }
    const stdout = await run(cwd, ['commit', '-m', message]);
    return { ok: true, output: stdout.trim() };
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) };
  }
}
