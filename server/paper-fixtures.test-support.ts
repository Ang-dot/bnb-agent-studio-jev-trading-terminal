import type {NarrativeResearch} from '../src/narrative.js';
import type {MonitorTrigger} from '../src/monitoring.js';
export function coherentNarrative(token:string,now:number):NarrativeResearch {
 const unknown={verdict:'unknown' as const,summary:'Not established',evidenceIds:[]};
 return {version:'narrative-v1',status:'ready',metadata:{token,name:'Moon',symbol:'MOON',description:null,reportedXHandle:null,source:'GMGN',requestedAt:now,receivedAt:now},
 angle:'Moon travel joke',themeSources:[],findings:{fit:{verdict:'supports',summary:'Name expresses the moon joke',evidenceIds:['TOKEN']},catalyst:unknown,timing:unknown,originality:unknown,community:unknown,kol:unknown,promotion:unknown},spreadSample:{posts:1,authors:0,unknownAuthors:1,largestAuthorShare:null},issues:[]};
}
export function positiveMonitoring(token:string,now:number):MonitorTrigger {
 return {kind:'auto-monitor',admittedAt:now,checkedAt:now,reason:'Fixture',disclaimer:'Fixture',admission:{eligible:true,checks:[]},
 activity:{token,observedAt:now,volume5mUsd:500,swaps5m:12,buys5m:8,sells5m:4,riskFlags:[]}};
}
