import * as vscode from "vscode";

export function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join("; ");

  return /* html */ `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Connect AI</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      display: flex; flex-direction: column; height: 100vh; overflow: hidden;
    }
    #status {
      padding: 4px 12px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    #messages {
      flex: 1; overflow-y: auto; padding: 12px;
      display: flex; flex-direction: column; gap: 10px;
    }
    .msg { padding: 8px 12px; border-radius: 8px; max-width: 85%; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
    .msg.user { background: var(--vscode-button-background); color: var(--vscode-button-foreground); align-self: flex-end; }
    .msg.assistant { background: var(--vscode-editorWidget-background); align-self: flex-start; }
    .msg.error { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-inputValidation-errorForeground); align-self: flex-start; border: 1px solid var(--vscode-inputValidation-errorBorder); }
    table { border-collapse: collapse; font-size: 12px; margin-top: 4px; }
    th, td { border: 1px solid var(--vscode-panel-border); padding: 4px 8px; text-align: left; }
    th { background: var(--vscode-editorGroupHeader-tabsBackground); }
    #input-row { display: flex; gap: 8px; padding: 8px; border-top: 1px solid var(--vscode-panel-border); }
    #input-row textarea {
      flex: 1; resize: none; height: 60px; padding: 6px;
      background: var(--vscode-input-background); color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border); border-radius: 4px;
      font-family: inherit; font-size: inherit;
    }
    #input-row textarea:focus { outline: 1px solid var(--vscode-focusBorder); }
    button {
      padding: 6px 14px; border: none; border-radius: 4px; cursor: pointer;
      background: var(--vscode-button-background); color: var(--vscode-button-foreground);
      font-size: inherit;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    #db-row { display: flex; gap: 8px; padding: 0 8px 8px; }
    #db-row input {
      flex: 1; padding: 4px 8px; font-size: 12px;
      background: var(--vscode-input-background); color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border); border-radius: 4px;
    }
  </style>
</head>
<body>
  <div id="status">연결 확인 중…</div>
  <div id="messages"></div>
  <div id="db-row">
    <input id="sql-input" type="text" placeholder="SELECT * FROM 고객 LIMIT 10" />
    <button id="sql-btn">DB 조회</button>
  </div>
  <div id="input-row">
    <textarea id="chat-input" placeholder="메시지를 입력하세요… (Shift+Enter로 줄바꿈, Enter로 전송)"></textarea>
    <button id="send-btn">전송</button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const messages = document.getElementById('messages');
    const chatInput = document.getElementById('chat-input');
    const sqlInput = document.getElementById('sql-input');
    const status = document.getElementById('status');
    let currentAssistantEl = null;

    function appendMsg(cls, text) {
      const el = document.createElement('div');
      el.className = 'msg ' + cls;
      el.textContent = text;
      messages.appendChild(el);
      messages.scrollTop = messages.scrollHeight;
      return el;
    }

    window.addEventListener('message', ({ data }) => {
      switch (data.type) {
        case 'status':
          status.textContent = data.text;
          break;
        case 'error':
          currentAssistantEl = null;
          appendMsg('error', '⚠️ ' + data.message);
          break;
        case 'reply':
          if (!currentAssistantEl) {
            currentAssistantEl = appendMsg('assistant', '');
          }
          currentAssistantEl.textContent += data.text;
          messages.scrollTop = messages.scrollHeight;
          if (data.done) currentAssistantEl = null;
          break;
        case 'dbResult': {
          const wrap = document.createElement('div');
          wrap.className = 'msg assistant';
          if (data.rows.length === 0) {
            wrap.textContent = '결과 없음';
          } else {
            const tbl = document.createElement('table');
            const thead = tbl.createTHead();
            const hr = thead.insertRow();
            data.columns.forEach(c => { const th = document.createElement('th'); th.textContent = c; hr.appendChild(th); });
            const tbody = tbl.createTBody();
            data.rows.forEach(row => {
              const tr = tbody.insertRow();
              row.forEach(cell => { const td = tr.insertCell(); td.textContent = String(cell ?? ''); });
            });
            wrap.appendChild(tbl);
          }
          messages.appendChild(wrap);
          messages.scrollTop = messages.scrollHeight;
          break;
        }
      }
    });

    document.getElementById('send-btn').addEventListener('click', sendChat);
    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });

    function sendChat() {
      const text = chatInput.value.trim();
      if (!text) return;
      appendMsg('user', text);
      vscode.postMessage({ type: 'chat', text });
      chatInput.value = '';
    }

    document.getElementById('sql-btn').addEventListener('click', () => {
      const sql = sqlInput.value.trim();
      if (!sql) return;
      vscode.postMessage({ type: 'queryDb', sql });
    });

    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}
