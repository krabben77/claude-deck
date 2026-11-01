// Chat tab.
export const CHAT_JS = `// ── Chat ──────────────────────────────────────────────────────
let chatSessionId = null;
let chatBusy = false;
let currentAssistantEl = null;

function checkChatCli() {
  var el = document.getElementById('chat-cli-status');
  if (el) el.textContent = 'Checking…';
  vscode.postMessage({ type: 'checkChatCli' });
}

function setChatSendEnabled(enabled) {
  var btn = document.getElementById('chat-send-btn');
  if (btn) btn.disabled = !enabled;
}

function appendChatMessage(role, text) {
  var list = document.getElementById('chat-messages');
  if (!list) return null;
  var row = document.createElement('div');
  row.className = 'item';
  row.style.flexDirection = 'column';
  row.style.alignItems = 'flex-start';
  var label = document.createElement('div');
  label.className = 'meta';
  label.innerHTML = '<span class="tag">' + (role === 'user' ? 'You' : 'Claude') + '</span>';
  var body = document.createElement('div');
  body.style.whiteSpace = 'pre-wrap';
  body.style.fontSize = '12.5px';
  body.style.marginTop = '4px';
  body.textContent = text;
  row.appendChild(label);
  row.appendChild(body);
  list.appendChild(row);
  list.scrollTop = list.scrollHeight;
  return body;
}

function sendChat() {
  if (chatBusy) return;
  var ta = document.getElementById('chat-input');
  var text = ta ? ta.value.trim() : '';
  if (!text) return;
  appendChatMessage('user', text);
  ta.value = '';
  chatBusy = true;
  setChatSendEnabled(false);
  currentAssistantEl = appendChatMessage('assistant', '');
  vscode.postMessage({ type: 'sendChatMessage', text: text, resumeSessionId: chatSessionId || undefined });
}

function resumeSession(id) {
  chatSessionId = id;
  var chatTab = document.querySelector('.tab[data-tab="chat"]');
  if (chatTab) chatTab.click();
  showStatus('chat-status', 'Resuming session ' + id + ' — send a message to continue.', true);
}
`;
