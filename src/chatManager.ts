import { execFile, spawn } from 'child_process';
import * as readline from 'readline';

export interface ChatCliCheck {
  ok: boolean;
  version: string;
}

export function checkCli(): Promise<ChatCliCheck> {
  return new Promise(resolve => {
    execFile('claude', ['--version'], (err, stdout, stderr) => {
      if (err) { resolve({ ok: false, version: stderr?.trim() || err.message }); return; }
      resolve({ ok: true, version: stdout.trim() });
    });
  });
}

export interface ChatHandlers {
  onChunk: (text: string) => void;
  onDone: (sessionId: string) => void;
  onError: (message: string) => void;
}

// NDJSON line shapes confirmed against docs (code.claude.com/docs/en/headless):
// stream_event lines carry token deltas at event.delta.text (delta.type === 'text_delta');
// the closing result line carries session_id and, on failure, a non-'success' subtype.
export function sendMessage(cwd: string, text: string, resumeSessionId: string | undefined, handlers: ChatHandlers): void {
  const args = ['-p', text, '--output-format', 'stream-json', '--verbose', '--include-partial-messages'];
  if (resumeSessionId) { args.push('--resume', resumeSessionId); }

  const child = spawn('claude', args, { cwd });
  let sessionId = '';
  let gotAnyText = false;
  let stderrText = '';

  const rl = readline.createInterface({ input: child.stdout });
  rl.on('line', line => {
    if (!line.trim()) { return; }
    let msg: any;
    try { msg = JSON.parse(line); } catch { return; }

    if (msg.type === 'stream_event' && msg.event?.delta?.type === 'text_delta') {
      gotAnyText = true;
      handlers.onChunk(msg.event.delta.text);
    } else if (msg.type === 'result') {
      if (typeof msg.session_id === 'string') { sessionId = msg.session_id; }
      if (msg.subtype && msg.subtype !== 'success') {
        handlers.onError(typeof msg.result === 'string' ? msg.result : `claude reported "${msg.subtype}"`);
      }
    }
  });

  child.stderr.on('data', d => { stderrText += d.toString(); });

  child.on('close', code => {
    if (code !== 0 && !gotAnyText) {
      handlers.onError(stderrText.trim() || `claude exited with code ${code}`);
      return;
    }
    handlers.onDone(sessionId);
  });

  child.on('error', err => {
    handlers.onError(err.message);
  });
}
