import { describe, expect, it } from "vitest";
import { serialReadLane } from "./read-lane.js";
describe("shared GMGN request lane",()=>{
  it("serializes reads, spaces completed requests, and recovers after failure",async()=>{
    let now=10000,inflight=0,peak=0;const waits:number[]=[];
    const read=serialReadLane(async (v:number)=>{inflight++;peak=Math.max(peak,inflight);await Promise.resolve();inflight--;if(v===2)throw new Error("failed");return v;},
      ()=>now,async ms=>{waits.push(ms);now+=ms;});
    const results=await Promise.allSettled([read(1),read(2),read(3)]);
    expect(peak).toBe(1);expect(waits).toEqual([1200,1200]);
    expect(results.map(r=>r.status)).toEqual(["fulfilled","rejected","fulfilled"]);
  });
});
