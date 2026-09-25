import {describe,it,expect} from "vitest";
import {initialState} from "./store.js";
import {paperControl} from "./control.js";
describe("paper session controls",()=>{
  it("requires an explicit start and refuses a latched stop",()=>{
    const s=initialState();
    paperControl(s,"start",true,"session-1");expect(s.running).toBe(true);expect(s.paperSession).toBe("session-1");
    paperControl(s,"stop",true,"");expect(s.running).toBe(false);expect(s.halted).toBe(true);
    expect(()=>paperControl(s,"start",true,"2")).toThrow("Reset");
    paperControl(s,"reset_stop",true,"");expect(s.running).toBe(false);
  });
  it("will not arm when monitoring/feed is paused; pause retains ledger",()=>{
    const s=initialState(),ledger=structuredClone(s.ledger);
    expect(()=>paperControl(s,"start",false,"1")).toThrow("Resume");
    paperControl(s,"pause",false,"");
    expect(s.ledger).toEqual(ledger);
  });
});
