import { readFileSync } from 'node:fs';
import pg from 'pg';

export function postgresPool(url: string, max: number): pg.Pool {
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) throw new Error('Postgres connection URL required');
  // node-postgres replaces an explicit SSL config when sslmode is in the URL.
  // Own TLS verification here so a copied connection string cannot turn it off.
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) parsed.searchParams.delete(key);
  const caPath = process.env.SUPABASE_DB_CA_PATH;
  const caBase64 = process.env.SUPABASE_DB_CA_BASE64;
  const ca = caPath ? readFileSync(caPath, 'utf8') : caBase64 ? Buffer.from(caBase64, 'base64').toString('utf8') : undefined;
  return new pg.Pool({
    connectionString: parsed.toString(),
    max,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
  });
}

export async function initPostgresSchema(pool: pg.Pool): Promise<void> {
  await pool.query('CREATE SCHEMA IF NOT EXISTS jev_private');
  await pool.query('REVOKE ALL ON SCHEMA jev_private FROM PUBLIC, anon, authenticated');
  await pool.query('CREATE TABLE IF NOT EXISTS jev_private.jev_terminal_state (id integer PRIMARY KEY, data text NOT NULL)');
}
