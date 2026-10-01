import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AgentState } from "../src/types.js";
import type { EpisodeJournal } from './journal-store.js';
import { emptyLedger } from "./policy.js";
export const initialState = (): AgentState => ({
  revision: 0,
  approvedPools: [],
  running: false,
  halted: false,
  ledger: emptyLedger(),
  decisions: [],
  lastCycleAt: null,
});
export interface Store {
  label: string;
  journal?: EpisodeJournal;
  read(): Promise<AgentState>;
  mutate(fn: (s: AgentState) => void): Promise<AgentState>;
  close(): void | Promise<void>;
}
export class SqliteStore implements Store {
  label = "Local SQLite · development";
  private db: DatabaseSync;
  constructor(path = ".data/terminal.sqlite") {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS terminal_state (id INTEGER PRIMARY KEY CHECK (id=1), data TEXT NOT NULL)",
    );
    this.db
      .prepare("INSERT OR IGNORE INTO terminal_state (id,data) VALUES (1,?)")
      .run(JSON.stringify(initialState()));
  }
  async read() {
    const row = this.db
      .prepare("SELECT data FROM terminal_state WHERE id=1")
      .get()!;
    return JSON.parse(row.data as string) as AgentState;
  }
  async mutate(fn: (s: AgentState) => void) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db
        .prepare("SELECT data FROM terminal_state WHERE id=1")
        .get()!;
      const state = JSON.parse(row.data as string) as AgentState;
      fn(state);
      state.revision++;
      this.db
        .prepare("UPDATE terminal_state SET data=? WHERE id=1")
        .run(JSON.stringify(state));
      this.db.exec("COMMIT");
      return state;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  close() {
    this.db.close();
  }
}
