import type {AgentState} from "../src/types.js";
export function paperControl(s:AgentState,action:"start"|"pause"|"stop"|"reset_stop",monitoringReady:boolean,session:string) {
  if(action==="start") {
    if(s.halted) throw new Error("Reset the stop latch first");
    if(!monitoringReady) throw new Error("Resume launch observation and JEV monitoring first");
    s.paperSession=session;s.running=true;
  } else if(action==="stop") {s.running=false;s.halted=true;}
  else if(action==="reset_stop") {s.halted=false;s.running=false;}
  else s.running=false;
}

// A new operator-configured release arms PAPER once. Subsequent restarts preserve
// manual pause/stop; absence of the opt-in always starts paused.
export function restorePaperSession(s:AgentState,release:string|undefined,ready:boolean,session:string) {
  if(!release || !ready || s.halted) {s.running=false;return;}
  if(!/^[a-zA-Z0-9._-]{1,80}$/.test(release))throw new Error('Invalid paper release');
  if(s.paperArmRelease!==release) {s.paperArmRelease=release;s.running=true;}
  if(s.running)s.paperSession=session;
}
