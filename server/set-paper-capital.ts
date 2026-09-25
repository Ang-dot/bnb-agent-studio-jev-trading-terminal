import { writeFile, mkdir } from "node:fs/promises";
import { SqliteStore, TiDBStore } from "./store.js";
import { setEmptyPaperCapital } from "./capital.js";

if (process.argv[2] !== "--confirm-empty-ledger-2000")
  throw new Error("Explicit empty-ledger $2,000 adjustment confirmation required");
const store = process.env.TIDB_DATABASE_URL
  ? await new TiDBStore(process.env.TIDB_DATABASE_URL).init() : new SqliteStore();
try {
  const before = await store.read();
  setEmptyPaperCapital(structuredClone(before), 2000); // Validate before any write.
  await mkdir(".data/capital-backups", { recursive: true, mode: 0o700 });
  const backup = `.data/capital-backups/before-2000-${Date.now()}.json`;
  await writeFile(backup, JSON.stringify(before), { mode: 0o600, flag: "wx" });
  const after = await store.mutate(s => setEmptyPaperCapital(s, 2000));
  console.log(JSON.stringify({ cashUsd: after.ledger.cashUsd, initialCashUsd: after.ledger.initialCashUsd,
    decisionsPreserved: after.decisions.length, fills: after.ledger.fills.length,
    positions: after.ledger.positions.length, running: after.running, backup }));
} finally { await store.close(); }
