import { setTimeout } from "node:timers/promises";
// GMGN Free has a five-weight bucket. Space all existing <=5-weight reads
// by more than one second, including charts, discovery and research.
export function serialReadLane<A,T>(read:(arg:A)=>Promise<T>,clock=Date.now,wait:(ms:number)=>Promise<unknown>=setTimeout) {
  let tail:Promise<unknown>=Promise.resolve(),lastFinished=0;
  return (arg:A):Promise<T>=>{
    const task=tail.then(async()=>{
      const remaining=lastFinished+1200-clock();
      if(remaining>0)await wait(remaining);
      try{return await read(arg);}finally{lastFinished=clock();}
    });
    tail=task.catch(()=>{});
    return task;
  };
}
