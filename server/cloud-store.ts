import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { initialState, type Store } from './store.js';
import type { AgentState } from '../src/types.js';
import type { SupportingEvidence } from '../src/enrichment.js';
import type { RawObservation } from './enrichment.js';

interface Lease {owner:string|null;epoch:number;expires:number}
export function ownsLease(l:Lease,owner:string,epoch:number,now:number){return l.owner===owner&&l.epoch===epoch&&l.expires>now;}
export function claimLease(l:Lease,owner:string,now:number,ttl:number):Lease|null {
  if(l.owner!==owner&&l.expires>now)return null;
  return {owner,epoch:l.owner===owner&&l.expires>now?l.epoch:l.epoch+1,expires:now+ttl};
}
export interface JsonPersistence {read():Promise<string|undefined>;write(value:string):Promise<void>}

export class CloudStore implements Store {
  label='TiDB Cloud · TLS · fenced single worker';
  private pool:mysql.Pool;
  private owner=randomUUID();
  private epoch=0;
  private expires=0;
  constructor(url:string){this.pool=mysql.createPool({uri:url,ssl:{rejectUnauthorized:true},connectionLimit:6,connectTimeout:10000});}
  async init(){
    await this.pool.execute('CREATE TABLE IF NOT EXISTS jev_terminal_state (id INT PRIMARY KEY, data LONGTEXT NOT NULL)');
    await this.pool.execute('INSERT IGNORE INTO jev_terminal_state (id,data) VALUES (1,?)',[JSON.stringify(initialState())]);
    await this.pool.execute('CREATE TABLE IF NOT EXISTS jev_worker_lease (id INT PRIMARY KEY, owner VARCHAR(64), epoch BIGINT NOT NULL, expires BIGINT NOT NULL)');
    await this.pool.execute('INSERT IGNORE INTO jev_worker_lease VALUES (1,NULL,0,0)');
    await this.pool.execute('CREATE TABLE IF NOT EXISTS jev_runtime_records (name VARCHAR(64) PRIMARY KEY, data LONGTEXT NOT NULL)');
    await this.pool.execute('CREATE TABLE IF NOT EXISTS jev_evidence (id VARCHAR(64) PRIMARY KEY, token VARCHAR(42) NOT NULL, observed_at BIGINT NOT NULL, data LONGTEXT NOT NULL, raw LONGTEXT NOT NULL, INDEX token_time(token,observed_at))');
    return this;
  }
  private async lease(connection:mysql.PoolConnection){
    const [rows]=await connection.query<mysql.RowDataPacket[]>('SELECT owner,epoch,expires,UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3))*1000 AS now_ms FROM jev_worker_lease WHERE id=1 FOR UPDATE');
    const r=rows[0];return {row:{owner:r.owner as string|null,epoch:Number(r.epoch),expires:Number(r.expires)},now:Number(r.now_ms)};
  }
  async acquire(){
    const c=await this.pool.getConnection();
    try {await c.beginTransaction();const {row,now}=await this.lease(c);const next=claimLease(row,this.owner,now,45000);
      if(!next){await c.rollback();return false;}
      await c.execute('UPDATE jev_worker_lease SET owner=?,epoch=?,expires=? WHERE id=1',[this.owner,next.epoch,next.expires]);
      await c.commit();this.epoch=next.epoch;this.expires=Date.now()+40000;return true;
    }catch(e){await c.rollback();throw e;}finally{c.release();}
  }
  get active(){return this.epoch>0&&Date.now()<this.expires;}
  async renew(){
    await this.fenced(async c=>{
      const {now}=await this.lease(c);
      await c.execute('UPDATE jev_worker_lease SET expires=? WHERE id=1',[now+45000]);
    });this.expires=Date.now()+40000;
  }
  async assertLease(){await this.fenced(async()=>{});}
  private async fenced<T>(work:(c:mysql.PoolConnection)=>Promise<T>):Promise<T>{
    const c=await this.pool.getConnection();
    try {await c.beginTransaction();const {row,now}=await this.lease(c);
      if(!ownsLease(row,this.owner,this.epoch,now))throw new Error('Worker lease unavailable');
      const result=await work(c);
      const after=await this.lease(c);
      if(!ownsLease(after.row,this.owner,this.epoch,after.now))throw new Error('Worker lease expired');
      await c.commit();return result;
    }catch(e){await c.rollback();this.expires=0;throw e;}finally{c.release();}
  }
  async read(){const [rows]=await this.pool.query<mysql.RowDataPacket[]>('SELECT data FROM jev_terminal_state WHERE id=1');return JSON.parse(rows[0].data) as AgentState;}
  async mutate(fn:(s:AgentState)=>void){return this.fenced(async c=>{
    const [rows]=await c.query<mysql.RowDataPacket[]>('SELECT data FROM jev_terminal_state WHERE id=1 FOR UPDATE');
    const state=JSON.parse(rows[0].data) as AgentState;fn(state);state.revision++;
    await c.execute('UPDATE jev_terminal_state SET data=? WHERE id=1',[JSON.stringify(state)]);return state;
  });}
  record(name:string):JsonPersistence {
    if(!/^[a-z0-9-]{1,64}$/.test(name))throw new Error('Invalid record');
    return {read:async()=>{const [rows]=await this.pool.query<mysql.RowDataPacket[]>('SELECT data FROM jev_runtime_records WHERE name=?',[name]);return rows[0]?.data;},
      write:async value=>{await this.fenced(async c=>{await c.execute('INSERT INTO jev_runtime_records (name,data) VALUES (?,?) ON DUPLICATE KEY UPDATE data=VALUES(data)',[name,value]);});}};
  }
  async save(e:SupportingEvidence,raw:RawObservation[]){await this.fenced(async c=>{await c.execute('INSERT IGNORE INTO jev_evidence (id,token,observed_at,data,raw) VALUES (?,?,?,?,?)',[e.id,e.token,e.completedAt,JSON.stringify(e),JSON.stringify(raw)]);});}
  async latest(token:string,at=Date.now(),maxAge=300000):Promise<SupportingEvidence|undefined>{
    const [rows]=await this.pool.query<mysql.RowDataPacket[]>('SELECT data FROM jev_evidence WHERE token=? AND observed_at<=? AND observed_at>=? ORDER BY observed_at DESC LIMIT 1',[token,at,at-maxAge]);return rows[0]?JSON.parse(rows[0].data):undefined;
  }
  // Never release before in-flight work has drained; on a forced shutdown TTL expires naturally.
  async release(){
    await this.pool.execute('UPDATE jev_worker_lease SET expires=0 WHERE id=1 AND owner=? AND epoch=?',[this.owner,this.epoch]);
    this.expires=0;
  }
  async close(){await this.pool.end();}
}
