// Operator-run provisioning only. Never imported by the trading runtime.
// Uses the documented Starter API; no secrets in argv or printed responses.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, chmodSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { isIP } from 'node:net';
import mysql from 'mysql2/promise';

process.umask(0o077);
const name = 'jevterminal-phase1';
function save(file, key, value) {
  if (/\r|\n/.test(value)) throw new Error('Multiline secret refused');
  const old = existsSync(file) ? readFileSync(file, 'utf8').trimEnd().split('\n') : [];
  const next = [...old];
  const index = next.findIndex(line => line.startsWith(`${key}=`));
  if (index < 0) next.push(`${key}=${value}`); else next[index] = `${key}=${value}`;
  const patch = old.length
    ? `*** Begin Patch\n*** Update File: ${file}\n@@\n${old.map(x=>'-'+x).join('\n')}\n${next.map(x=>'+'+x).join('\n')}\n*** End Patch\n`
    : `*** Begin Patch\n*** Add File: ${file}\n${next.map(x=>'+'+x).join('\n')}\n*** End Patch\n`;
  const result = spawnSync('apply_patch', [], {input: patch, encoding:'utf8'});
  if (result.status !== 0) throw new Error('Private configuration write failed');
  chmodSync(file, 0o600);
  process.env[key] = value;
}
function api(path, body) {
  const pub = process.env.TIDB_PUBLIC_KEY, priv = process.env.TIDB_PRIVATE_KEY;
  if (!pub || !priv) throw new Error('TiDB management credentials missing');
  const config = [
    `url = ${JSON.stringify(`https://serverless.tidbapi.com/v1beta1${path}`)}`,
    `user = ${JSON.stringify(pub+':'+priv)}`,
    'digest', 'silent', 'show-error', 'max-time = 25',
    'header = "Content-Type: application/json"', 'write-out = "\\n%{http_code}"',
    ...(body ? [`data = ${JSON.stringify(JSON.stringify(body))}`] : []),
  ].join('\n');
  const result = spawnSync('curl', ['--config','-'], {input:config,encoding:'utf8',maxBuffer:1000000});
  const split = result.stdout.lastIndexOf('\n');
  const status = Number(result.stdout.slice(split+1));
  let data; try { data=JSON.parse(result.stdout.slice(0,split)); } catch { throw new Error('TiDB API response unavailable'); }
  if (status < 200 || status >= 300) throw new Error(`TiDB API HTTP ${status}; code ${Number(data.code)||'unknown'}`);
  return data;
}

try {
  const listing=api('/clusters');
  let cluster=listing.clusters.find(c=>c.displayName===name);
  if (!cluster) {
    if (!process.argv.includes('--create')) throw new Error('Dedicated cluster absent; use --create to provision it');
    const region='regions/aws-ap-southeast-1';
    if (!api('/regions').regions.some(r=>r.name===region && r.servicePlans.includes('Starter'))) throw new Error('Requested Starter region unavailable');
    const ip=(await (await fetch('https://checkip.amazonaws.com', {signal:AbortSignal.timeout(10000),redirect:'error'})).text()).trim();
    if (isIP(ip)!==4) throw new Error('Could not determine an IPv4 allowlist address');
    const workerIp=process.env.JEV_WORKER_EGRESS_IP;
    if (workerIp && isIP(workerIp)!==4) throw new Error('Invalid worker IPv4 address');
    if (!process.env.TIDB_ROOT_PASSWORD) save('.env.infrastructure.local','TIDB_ROOT_PASSWORD',randomBytes(32).toString('base64url'));
    save('.env.infrastructure.local','TIDB_PUBLIC_KEY',process.env.TIDB_PUBLIC_KEY);
    save('.env.infrastructure.local','TIDB_PRIVATE_KEY',process.env.TIDB_PRIVATE_KEY);
    cluster=api('/clusters',{
      displayName:name,region:{name:region},spendingLimit:{monthly:0},
      rootPassword:process.env.TIDB_ROOT_PASSWORD,
      endpoints:{public:{disabled:false,authorizedNetworks:[{startIpAddress:ip,endIpAddress:ip,displayName:'JEV migration operator'},...(workerIp?[{startIpAddress:workerIp,endIpAddress:workerIp,displayName:'JEV observed NodeOps egress'}]:[])]}},
    });
    save('.env.infrastructure.local','TIDB_CLUSTER_ID',cluster.clusterId);
    console.log(JSON.stringify({created:true,clusterId:cluster.clusterId,state:cluster.state,region,monthlySpendingLimitUsd:0,network:'Exact observed IPv4 addresses only; no public wildcard'}));
  }
  cluster=api(`/clusters/${encodeURIComponent(cluster.clusterId)}`);
  if (cluster.state!=='ACTIVE') {
    console.log(JSON.stringify({state:cluster.state,next:'Rerun after the cluster becomes active; no duplicate cluster will be created.'}));
    process.exit(0);
  }
  const endpoint=cluster.endpoints?.public;
  if (!endpoint?.host || !endpoint?.port || !cluster.userPrefix || !process.env.TIDB_ROOT_PASSWORD) throw new Error('SQL connection metadata or saved root credential missing');
  if (!process.env.TIDB_APP_PASSWORD) save('.env.infrastructure.local','TIDB_APP_PASSWORD',randomBytes(32).toString('base64url'));
  const user=`${cluster.userPrefix}.jevterminal`;
  const connection=await mysql.createConnection({host:endpoint.host,port:endpoint.port,user:`${cluster.userPrefix}.root`,password:process.env.TIDB_ROOT_PASSWORD,ssl:{rejectUnauthorized:true},connectTimeout:15000});
  try {
    await connection.query('CREATE DATABASE IF NOT EXISTS jev_terminal');
    await connection.query('CREATE USER IF NOT EXISTS ? IDENTIFIED BY ? REQUIRE SSL',[user,process.env.TIDB_APP_PASSWORD]);
    await connection.query('GRANT SELECT, INSERT, UPDATE, CREATE ON jev_terminal.* TO ?',[user]);
  } finally {await connection.end();}
  const url=new URL(`mysql://${endpoint.host}:${endpoint.port}/jev_terminal`);
  url.username=user;url.password=process.env.TIDB_APP_PASSWORD;
  const probe=await mysql.createConnection({uri:url.toString(),ssl:{rejectUnauthorized:true},connectTimeout:15000});
  try {await probe.query('SELECT 1');} finally {await probe.end();}
  save('.env.local','TIDB_DATABASE_URL',url.toString());
  console.log(JSON.stringify({database:'jev_terminal',sqlConnection:'Verified with TLS',applicationUser:'Database-scoped, no root credentials in the connection URL',clusterId:cluster.clusterId}));
} catch (error) {
  // Driver errors may contain SQL and passwords. Only known application messages are printed.
  const msg=error instanceof Error?error.message:'';
  console.error(JSON.stringify({setup:'incomplete',error:/^(TiDB API HTTP|Dedicated cluster absent|Requested Starter region unavailable|Could not determine|SQL connection metadata|Private configuration write failed)/.test(msg)?msg:'Provisioning or SQL check failed; inspect sanitized provider/driver code',code:typeof error?.code==='string'?error.code:undefined}));
  process.exitCode=1;
}
