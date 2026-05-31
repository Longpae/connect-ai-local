import * as vscode from "vscode";
import { OllamaClient } from "./ollamaClient";
import { ChatPanel } from "./chatPanel";

export function activate(context: vscode.ExtensionContext) {
  const getCfg = () => vscode.workspace.getConfiguration("connectAi");

  const makeClient = () =>
    new OllamaClient({
      baseUrl: getCfg().get<string>("ollamaUrl") ?? "http://127.0.0.1:11434",
      model: getCfg().get<string>("model") ?? "llama3",
      timeoutMs: (getCfg().get<number>("timeoutSec") ?? 30) * 1000,
    });

  context.subscriptions.push(
    vscode.commands.registerCommand("connectAi.openChat", () => {
      ChatPanel.create(context, makeClient());
    }),

    vscode.commands.registerCommand("connectAi.queryDb", async () => {
      const sql = await vscode.window.showInputBox({
        prompt: "실행할 SQL을 입력하세요",
        placeHolder: "SELECT * FROM 고객 LIMIT 20",
      });
      if (!sql) return;
      const panel = ChatPanel.create(context, makeClient());
      // DB 조회 결과를 채팅 패널에 표시
      (panel as any).handleMessage?.({ type: "queryDb", sql });
    })
  );
}

export function deactivate() {}
