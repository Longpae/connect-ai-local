import * as vscode from "vscode";
import { OllamaClient, OllamaError } from "./ollamaClient";
import { SqliteClient, resolveDbPath } from "./sqliteClient";
import { ChatMessage, WebviewToExtension, ExtensionToWebview } from "./types";
import { getWebviewContent } from "./webviewContent";

export class ChatPanel {
  private static instance: ChatPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly ollama: OllamaClient;
  private history: ChatMessage[] = [];
  private abortController: AbortController | undefined;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    ollama: OllamaClient,
    private readonly context: vscode.ExtensionContext
  ) {
    this.panel = panel;
    this.ollama = ollama;

    this.panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg: WebviewToExtension) => this.handleMessage(msg),
      null,
      this.disposables
    );
  }

  static create(
    context: vscode.ExtensionContext,
    ollama: OllamaClient
  ): ChatPanel {
    if (ChatPanel.instance) {
      ChatPanel.instance.panel.reveal();
      return ChatPanel.instance;
    }
    const panel = vscode.window.createWebviewPanel(
      "connectAiChat",
      "Connect AI",
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    ChatPanel.instance = new ChatPanel(panel, ollama, context);
    return ChatPanel.instance;
  }

  private send(msg: ExtensionToWebview) {
    this.panel.webview.postMessage(msg);
  }

  async handleMessage(msg: WebviewToExtension) {
    switch (msg.type) {
      case "ready":
        this.send({ type: "status", text: "Ollama 연결 확인 중…" });
        const models = await this.ollama.listModels();
        if (models.length === 0) {
          this.send({
            type: "error",
            message:
              "Ollama 서버를 찾을 수 없어요. 터미널에서 `ollama serve`를 실행해 주세요.",
          });
        } else {
          this.send({ type: "status", text: `준비 완료 (모델: ${models[0]})` });
        }
        break;

      case "chat":
        await this.handleChat(msg.text);
        break;

      case "queryDb":
        await this.handleDbQuery(msg.sql);
        break;
    }
  }

  private async handleChat(text: string) {
    this.abortController?.abort();
    this.abortController = new AbortController();

    this.history.push({ role: "user", content: text });

    try {
      let full = "";
      for await (const token of this.ollama.chat(
        this.history,
        this.abortController.signal
      )) {
        full += token;
        this.send({ type: "reply", text: token, done: false });
      }
      this.send({ type: "reply", text: "", done: true });
      this.history.push({ role: "assistant", content: full });
    } catch (err) {
      const message =
        err instanceof OllamaError ? err.message : String(err);
      this.send({ type: "error", message });
    }
  }

  private async handleDbQuery(sql: string) {
    const cfg = vscode.workspace
      .getConfiguration("connectAi")
      .get<string>("dbPath");
    const dbPath = resolveDbPath(
      vscode.workspace.workspaceFolders ?? [],
      cfg
    );
    if (!dbPath) {
      this.send({
        type: "error",
        message:
          "DB 파일을 찾을 수 없어요. 설정에서 connectAi.dbPath를 지정해 주세요.",
      });
      return;
    }
    const client = SqliteClient.tryOpen(dbPath);
    if (!client) {
      this.send({ type: "error", message: `DB 열기 실패: ${dbPath}` });
      return;
    }
    try {
      const result = client.query(sql);
      this.send({ type: "dbResult", ...result });
    } catch (err) {
      this.send({ type: "error", message: String(err) });
    } finally {
      client.close();
    }
  }

  private dispose() {
    ChatPanel.instance = undefined;
    this.abortController?.abort();
    this.disposables.forEach((d) => d.dispose());
    this.panel.dispose();
  }
}
