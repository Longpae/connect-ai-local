import Database from "better-sqlite3";
import * as path from "path";

export interface QueryResult {
  columns: string[];
  rows: unknown[][];
}

export class SqliteClient {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { readonly: true, fileMustExist: true });
  }

  query(sql: string): QueryResult {
    const stmt = this.db.prepare(sql);
    const rows = stmt.all() as Record<string, unknown>[];
    if (rows.length === 0) {
      return { columns: [], rows: [] };
    }
    const columns = Object.keys(rows[0]);
    return {
      columns,
      rows: rows.map((r) => columns.map((c) => r[c])),
    };
  }

  listTables(): string[] {
    const rows = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    return rows.map((r) => r.name);
  }

  close(): void {
    this.db.close();
  }

  static tryOpen(dbPath: string): SqliteClient | null {
    try {
      return new SqliteClient(dbPath);
    } catch {
      return null;
    }
  }
}

export function resolveDbPath(
  workspaceFolders: readonly { uri: { fsPath: string } }[],
  configPath: string | undefined
): string | null {
  if (configPath) return configPath;
  for (const folder of workspaceFolders) {
    const candidates = ["고객관리.db", "customers.db", "data.db"];
    for (const name of candidates) {
      const full = path.join(folder.uri.fsPath, name);
      try {
        new Database(full, { readonly: true, fileMustExist: true }).close();
        return full;
      } catch {
        /* skip */
      }
    }
  }
  return null;
}
