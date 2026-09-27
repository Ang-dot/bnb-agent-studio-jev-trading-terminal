import { expect, it } from 'vitest';
import { postgresPool } from './postgres.js';

it('requires Postgres and TLS certificate verification even when a URL requests weaker SSL', async () => {
  expect(() => postgresPool('mysql://example.test/db', 1)).toThrow('Postgres');
  const pool = postgresPool('postgresql://example.test/db?sslmode=disable', 1);
  expect(pool.options.ssl).toMatchObject({ rejectUnauthorized: true });
  expect(pool.options.connectionString).not.toContain('sslmode=disable');
  await pool.end();
});
