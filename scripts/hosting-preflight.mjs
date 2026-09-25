// Temporary, secret-free deployment probe. No market calls, agent or trading.
import { createServer } from 'node:http';
import { isIP } from 'node:net';

export function reply(method, path) {
  if (method !== 'GET' && method !== 'HEAD') return [405, { error: 'Read only' }];
  if (path !== '/api/health') return [404, { error: 'Terminal deployment is being prepared' }];
  return [200, { ok: true, phase: 'hosting-preflight', agentRunning: false, liveExecution: false }];
}

if (process.argv[1]?.endsWith('/hosting-preflight.mjs')) {
  const port = Number(process.env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port');
  const server = createServer((req, res) => {
    const [status, body] = reply(req.method, req.url);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(body));
  });
  server.listen(port, '0.0.0.0', () => console.log('JEV hosting probe ready; agent disabled'));
  // Private platform log only, to allowlist this backend's observed database egress.
  fetch('https://checkip.amazonaws.com', { signal: AbortSignal.timeout(10000), redirect: 'error' })
    .then(r => r.ok ? r.text() : Promise.reject())
    .then(raw => { const ip = raw.trim(); if (isIP(ip)) console.log(JSON.stringify({ observedEgress: ip })); })
    .catch(() => console.log('Egress probe unavailable'));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}
