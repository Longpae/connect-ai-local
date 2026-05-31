import { ChatMessage } from "./types";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3";

export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
}

export class OllamaClient {
  private baseUrl: string;
  private model: string;
  private timeoutMs: number;

  constructor(config: OllamaConfig = {}) {
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.model = config.model ?? DEFAULT_MODEL;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  async *chat(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): AsyncGenerator<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const combinedSignal = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, messages, stream: true }),
        signal: combinedSignal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if ((err as Error).name === "AbortError") {
        throw new OllamaError("요청 시간이 초과됐어요 (Ollama 응답 없음).");
      }
      throw new OllamaError(
        `Ollama 서버에 연결할 수 없어요 (${this.baseUrl}).\n` +
          "터미널에서 'ollama serve' 가 실행 중인지 확인해 주세요."
      );
    }

    if (!res.ok) {
      clearTimeout(timeout);
      const body = await res.text().catch(() => "");
      throw new OllamaError(`Ollama 오류 ${res.status}: ${body}`);
    }

    try {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop()!;
        for (const line of lines) {
          if (!line.trim()) continue;
          const json = JSON.parse(line);
          const token: string = json?.message?.content ?? "";
          if (token) yield token;
          if (json?.done) return;
        }
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return [];
      const json: any = await res.json();
      return (json?.models ?? []).map((m: any) => m.name as string);
    } catch {
      return [];
    }
  }
}

export class OllamaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OllamaError";
  }
}
