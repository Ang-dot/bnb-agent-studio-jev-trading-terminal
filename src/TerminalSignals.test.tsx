import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AgentTape, PerformanceStrip } from "./TerminalSignals.js";
import type { Decision, TerminalState } from "./types.js";

describe("terminal truth labels", () => {
  it("does not display fabricated zero P&L while the ledger is loading", () => {
    const html = renderToStaticMarkup(<PerformanceStrip state={null} launches={[]} now={100} onPositions={()=>{}}/>);
    expect(html).toContain("Loading ledger");
    expect(html).not.toContain("$0.00");
    expect(html).toContain("Execution paused");
  });
  it("labels an unexecuted model buy as a call, not a fill or win", () => {
    const decision = {id:"d",name:"TEST",time:100,action:"hold",status:"held",judgment:{action:"buy",confidence:.81,quality:2},memories:[],reasons:["Inspection only"]} as unknown as Decision;
    const state = {decisions:[decision],revision:1} as TerminalState;
    const html = renderToStaticMarkup(<AgentTape state={state} monitor={null} onRecord={()=>{}} onReplay={()=>{}} motion={true} disconnected={false}/>);
    expect(html).toContain("JEV BUY");
    expect(html).toContain("No fill · inspect code policy");
    expect(html).toContain("Stored inspection");
    expect(html).not.toContain("Paper fill recorded");
    expect(html).not.toContain("event-pop");
    expect(html).toContain("0 memories");
  });
  it("does not claim the agent is watching on a disconnected terminal", () => {
    const html = renderToStaticMarkup(<AgentTape state={null} monitor={null} onRecord={()=>{}} onReplay={()=>{}} motion={false} disconnected={true}/>);
    expect(html).toContain("Connection lost · showing saved activity");
    expect(html).not.toContain("Watching for the next");
  });
});
