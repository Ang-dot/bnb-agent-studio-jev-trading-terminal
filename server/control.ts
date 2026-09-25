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
