import {describe,it,expect} from "vitest";
import {huntCandidates} from "./hunt.js";
import type {Launch} from "./launches.js";
import type {MonitorItem} from "./monitoring.js";
const now=100000000;
const l=(address:string,patch:Partial<Launch>={}):Launch=>({address,symbol:address,stage:"graduated_reported",observedAt:now,reportedGraduatedAt:now-1000,liquidityUsd:10000,holders:25,...patch}) as Launch;
const item=(token:string,volume:number|null,swaps:number|null)=>({token,status:"screening",admission:{eligible:false,checks:[{label:"Activity",pass:false,detail:"Waiting"}]},activity:{observedAt:now,volume5mUsd:volume,swaps5m:swaps}} as MonitorItem);
describe("launch opportunity queue",()=>{
  it("ranks measurable near-qualifiers without inventing an alpha or win score",()=>{
    const result=huntCandidates([l("a"),l("b")],[item("a",270,4.5),item("b",100,1)],now);
    expect(result[0].launch.address).toBe("a");
    expect(result[0].readiness).toBe(95);
  });
  it("keeps missing activity unknown and excludes stale/pre-graduation/old rows",()=>{
    const result=huntCandidates([l("a"),l("stale",{observedAt:now-90001}),l("bond",{stage:"bonding"}),l("old",{reportedGraduatedAt:now-86400001})],[item("a",null,null)],now);
    expect(result).toHaveLength(1);expect(result[0].readiness).toBeNull();
  });
});
