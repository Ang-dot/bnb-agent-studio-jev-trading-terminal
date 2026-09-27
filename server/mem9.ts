import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Memory } from '../src/types.js';
import type { CaptureReceipt, MemoryEpisode } from '../src/memory.js';

// Contract: mem9-ai/mem9 docs/api/openapi.json and openclaw-plugin/server-backend.ts.
// Explicit pinned content has a synchronous receipt. It does not use the
// conversation-ingest pipeline or pretend to offer Living Brain compilation.
const rowSchema = z.object({
  id: z.string().min(1), content: z.string().min(1).max(50000), appId: z.string(),
  memory_type: z.string(), state: z.string(), agent_id: z.string(),
  tags: z.array(z.string()), metadata: z.object({
    episodeId: z.string(), contentHash: z.string(), title: z.string(),
  }),
  created_at: z.string().datetime({offset:true}), updated_at: z.string().datetime({offset:true}),
  score: z.number().finite().nullish(),
});
const listSchema = z.object({memories:z.array(rowSchema), partial:z.boolean().optional()});
type Row = z.infer<typeof rowSchema>;
const digest = (value:string) => createHash('sha256').update(value).digest('hex');
const agentId = 'jev-kbw';
const journalTag = 'jev-paper';

class Mem9HttpError extends Error {
  constructor(readonly status:number) { super(`Provider returned HTTP ${status}`); }
}
// Only these failures prove no write was dispatched/accepted. All other
// post-dispatch failures must stay in reconciliation, including local I/O.
export class Mem9RetryableError extends Error {
  readonly safeToRetry = true;
}

export class Mem9Memory {
  private readonly origin:string;
  private readonly appId:string;
  constructor(private env:NodeJS.ProcessEnv, private fetchImpl:typeof fetch=fetch) {
    const url = new URL(env.MEM9_API_URL || 'https://api.mem9.ai');
    if (url.protocol!=='https:' || url.username || url.password || url.search || url.hash || url.pathname!=='/')
      throw new Error('MEM9_API_URL must be an HTTPS origin');
    this.origin=url.origin;
    this.appId=z.string().trim().min(1).max(100).parse(env.MEM9_APP_ID || 'jev-kbw');
  }
  private async request(path:string, body?:unknown):Promise<unknown> {
    if (!this.env.MEM9_API_KEY?.trim()) throw new Error('MEM9 is not configured');
    const response = await this.fetchImpl(`${this.origin}/v1alpha2/mem9s/memories${path}`, {
      method:body===undefined?'GET':'POST', redirect:'error', signal:AbortSignal.timeout(15000),
      headers:{'Content-Type':'application/json','X-API-Key':this.env.MEM9_API_KEY,
        'X-Mnemo-Agent-Id':agentId,'User-Agent':'jev-terminal/0.1.0'},
      ...(body===undefined?{}:{body:JSON.stringify(body)}),
    });
    if (!response.ok) throw new Mem9HttpError(response.status);
    try { return await response.json(); } catch { throw new Error('MEM9 response is not valid JSON'); }
  }
  private params(extra:Record<string,string>={}) {
    return new URLSearchParams({appId:this.appId,agent_id:agentId,memory_type:'pinned',state:'active',tags:journalTag,...extra});
  }
  private validate(row:Row) {
    if (row.appId!==this.appId || row.agent_id!==agentId || row.memory_type!=='pinned' || row.state!=='active' ||
        !row.tags.includes(journalTag) || digest(row.content)!==row.metadata.contentHash)
      throw new Error('MEM9 memory scope or content integrity mismatch');
    return row;
  }
  async search(query:string):Promise<Memory[]> {
    const list=listSchema.parse(await this.request('?'+this.params({q:query,limit:'4',offset:'0'})));
    // A truncated provider search must not become a successful empty cold start.
    if (list.partial) throw new Error('MEM9 returned an incomplete search');
    return list.memories.map(row=>this.validate(row)).slice(0,4).map(row=>({
      pageId:row.id,slug:row.id,title:row.metadata.title.slice(0,160),summary:row.content.slice(0,1500),
      status:row.state,provider:'mem9',similarity:null,searchScore:row.score??undefined,
      sourceHash:row.metadata.contentHash,
    }));
  }
  private async findEpisode(episodeId:string, contentHash:string):Promise<Row|null> {
    const rows=listSchema.parse(await this.request('?'+this.params({tags:`jev-episode-${episodeId}`,limit:'2',offset:'0'})));
    if (rows.partial) throw new Error('MEM9 episode lookup incomplete');
    const matches=rows.memories.map(row=>this.validate(row));
    if (matches.some(row=>row.metadata.episodeId!==episodeId || row.metadata.contentHash!==contentHash) || matches.length>1)
      throw new Error('MEM9 episode reference requires reconciliation');
    return matches[0]??null;
  }
  private receipt(sourceId:string,row:Row):CaptureReceipt {
    return {id:sourceId,status:'stored',affectedPageIds:[row.id],availableAt:row.updated_at,contentHash:row.metadata.contentHash};
  }
  private describe(episode:MemoryEpisode) {
    const content=JSON.stringify({episodeId:episode.id,kind:episode.kind,name:episode.name,token:episode.token,
      createdAt:episode.createdAt,summary:episode.summary,...episode.content});
    if (Buffer.byteLength(content)>50000) throw new Error('MEM9 episode exceeds the provider content limit; local evidence retained');
    const contentHash=digest(content),sourceId=`mem9:${encodeURIComponent(episode.id)}:${contentHash}`;
    return {content,contentHash,sourceId};
  }
  captureIntent(episode:MemoryEpisode):CaptureReceipt {
    const {sourceId,contentHash}=this.describe(episode);
    return {id:sourceId,status:'unconfirmed',affectedPageIds:[],contentHash,
      detail:'MEM9 capture intent saved; remote receipt not yet confirmed.'};
  }
  async capture(episode:MemoryEpisode):Promise<CaptureReceipt> {
    const {content,contentHash,sourceId}=this.describe(episode);
    let prior:Row|null;
    try { prior=await this.findEpisode(episode.id,contentHash); }
    catch(error) { throw new Mem9RetryableError(error instanceof Mem9HttpError?error.message:'MEM9 pre-write lookup failed'); }
    if (prior) return this.receipt(sourceId,prior);
    try {
      const row=this.validate(rowSchema.parse(await this.request('',{
        content,memory_type:'pinned',agent_id:agentId,appId:this.appId,
        tags:[journalTag,`jev-episode-${episode.id}`,episode.kind],
        metadata:{episodeId:episode.id,contentHash,title:`PAPER ${episode.kind} · ${episode.name.slice(0,80)}`},
      })));
      if(row.metadata.episodeId!==episode.id || row.metadata.contentHash!==contentHash) throw new Error('MEM9 receipt mismatch');
      return this.receipt(sourceId,row);
    } catch(error) {
      // The API has no documented idempotency key. After an ambiguous POST,
      // reconcile by exact episode reference; never blindly issue a second POST.
      if(error instanceof Mem9HttpError && error.status>=400 && error.status<500 && error.status!==408)
        throw new Mem9RetryableError(error.message);
      return {id:sourceId,status:'unconfirmed',affectedPageIds:[],contentHash,
        detail:'MEM9 write response was not confirmed. Checking the episode reference before any further write.'};
    }
  }
  async statuses(ids:string[]):Promise<CaptureReceipt[]> {
    const receipts:CaptureReceipt[]=[];
    for (const id of ids.slice(0,20)) {
      const parts=id.match(/^mem9:([^:]+):([a-f0-9]{64})$/);
      if (!parts) throw new Error('Invalid MEM9 source reference');
      const row=await this.findEpisode(decodeURIComponent(parts[1]),parts[2]);
      receipts.push(row?this.receipt(id,row):{id,status:'unconfirmed',affectedPageIds:[],contentHash:parts[2],
        detail:'No matching MEM9 write is visible yet. The local episode is retained; no duplicate write was sent.'});
    }
    return receipts;
  }
  // Read-only connection check; does not expose private memories or create data.
  async verify():Promise<void> {
    const result=listSchema.parse(await this.request('?'+this.params({limit:'1',offset:'0'})));
    if(result.partial)throw new Error('MEM9 verification incomplete');
    result.memories.forEach(row=>this.validate(row));
  }
}
