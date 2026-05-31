// WebView ↔ Extension Host postMessage protocol

export type Role = "user" | "assistant" | "system";

export interface ChatMessage {
  role: Role;
  content: string;
}

// WebView → Extension
export type WebviewToExtension =
  | { type: "chat"; text: string }
  | { type: "queryDb"; sql: string }
  | { type: "ready" };

// Extension → WebView
export type ExtensionToWebview =
  | { type: "reply"; text: string; done: boolean }
  | { type: "dbResult"; columns: string[]; rows: unknown[][] }
  | { type: "error"; message: string }
  | { type: "status"; text: string };
