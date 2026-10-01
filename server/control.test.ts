import {describe,it,expect} from "vitest";
import {initialState} from "./store.js";
import {paperControl,restorePaperSession} from "./control.js";
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

it('arms a release once, resumes running sessions and preserves manual pause/stop',()=>{
 const s=initialState();restorePaperSession(s,'release-2',true,'first');expect(s.running).toBe(true);
 restorePaperSession(s,'release-2',true,'restart');expect(s.running).toBe(true);expect(s.paperSession).toBe('restart');
 paperControl(s,'pause',true,'');restorePaperSession(s,'release-2',true,'again');expect(s.running).toBe(false);
 restorePaperSession(s,'release-3',true,'new');expect(s.running).toBe(true);
 paperControl(s,'stop',true,'');restorePaperSession(s,'release-4',true,'stopped');expect(s.running).toBe(false);expect(s.halted).toBe(true);
});
it('requires release opt-in and active monitoring and keeps capital intact',()=>{
 const s=initialState(),ledger=structuredClone(s.ledger);restorePaperSession(s,undefined,true,'a');expect(s.running).toBe(false);
 restorePaperSession(s,'release',false,'b');expect(s.running).toBe(false);expect(s.paperArmRelease).toBeUndefined();expect(s.ledger).toEqual(ledger);
});
