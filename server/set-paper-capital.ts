import { writeFile, mkdir } from "node:fs/promises";
import { SqliteStore } from "./store.js";
import { CloudStore } from './cloud-store.js';
import { setEmptyPaperCapital } from "./capital.js";

if (process.argv[2] !== "--confirm-empty-ledger-2000")
  throw new Error("Explicit empty-ledger $2,000 adjustment confirmation required");
const cloud = process.env.SUPABASE_DATABASE_URL
  ? await new CloudStore(process.env.SUPABASE_DATABASE_URL).init() : null;
const store = cloud ?? new SqliteStore();
try {
  if (cloud && !await cloud.acquire()) throw new Error('Another worker owns the cloud lease');
  const before = await store.read();
  setEmptyPaperCapital(structuredClone(before), 2000); // Validate before any write.
  await mkdir(".data/capital-backups", { recursive: true, mode: 0o700 });
  const backup = `.data/capital-backups/before-2000-${Date.now()}.json`;
  await writeFile(backup, JSON.stringify(before), { mode: 0o600, flag: "wx" });
  const after = await store.mutate(s => setEmptyPaperCapital(s, 2000));
  console.log(JSON.stringify({ cashUsd: after.ledger.cashUsd, initialCashUsd: after.ledger.initialCashUsd,
    decisionsPreserved: after.decisions.length, fills: after.ledger.fills.length,
    positions: after.ledger.positions.length, running: after.running, backup }));
} finally { if (cloud) await cloud.release(); await store.close(); }
