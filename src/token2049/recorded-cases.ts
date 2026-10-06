import archive from './recorded-evaluations.json?raw';
export { sourceSummary } from './source-presentation.js';

/** Redacted presentation evidence; original research is kept outside published assets. */
export type HistoricalFact = {id:string;title:string;attribution:string;url:string;publishedAt:string;availableAt:string;content:string};
export type RecordedEvaluation = {
  caseId:string;candidateId:string;cutoff:string;model:string;policyVersion:string;repeatCount:number;receiptUrl:string;
  withoutAction:string;withAction:string;withoutEntryProbability:number;withEntryProbability:number;
  candidate:{token:{symbol:string;chain:string;assetId:string};currentEvidence:HistoricalFact[];memoryEvidence:HistoricalFact[];limitations:string[]};
};
export const recordedEvaluations = JSON.parse(archive) as RecordedEvaluation[];
type Story = {name:string;event:string;link:string;summary:string;without:string;with:string;sourceLimit?:string;relationships:Record<string,string>};
const stories:Record<string,Story> = {
  "coin1": {
    "name": "The project story behind a returning tutorial",
    "event": "A token-creation tutorial resurfaces",
    "link": "Tutorial → project narrative → token identity",
    "summary": "Living Brain recalls how the BNB-COIN1 project had linked its token to this tutorial. That earlier project narrative gives JEV context for the new discussion about AI-assisted building.",
    "without": "The new post discusses building with AI; the earlier project narrative is missing.",
    "with": "The project’s earlier video-to-BNB-COIN1 claim gives JEV a token-specific narrative to assess.",
    "sourceLimit": "The identity link is the project’s claim. Sharing a tutorial does not endorse its example token.",
    "relationships": {
      "coin1-source-1": "Retrieves the project’s own earlier claim connecting this video to mainnet BNB-COIN1.",
      "coin1-source-2": "Preserves the earlier clarification that a tutorial reference does not establish official token backing."
    }
  },
  "coin2": {
    "name": "A community proposal changes the discussion",
    "event": "A donation discussion is clarified",
    "link": "Community proposal → fee mechanism → revised assessment",
    "summary": "Living Brain recalls the community proposal behind BNB-COIN2 and the claim that donation fees arrive as BNB. JEV can connect the new clarification to the earlier selling-pressure concern.",
    "without": "The short reply is missing the community proposal that explains what is being corrected.",
    "with": "The earlier community exchange links BNB-COIN2 to the proposed mechanism and explains the clarification.",
    "sourceLimit": "The mechanism is the proponent’s claim. A donation discussion provides no contract audit or token endorsement.",
    "relationships": {
      "coin2-source-3": "Records the stated policy for converting donated meme tokens.",
      "coin2-source-4": "Retains the proponent’s claim that fees arrive as BNB, which requires contract verification.",
      "coin2-source-5": "Connects the discussion to the market named by the proponent."
    }
  },
  "coin3": {
    "name": "The community association behind a greeting",
    "event": "A photo and greeting enter the discussion",
    "link": "Community imagery → shared association → event context",
    "summary": "Living Brain recalls a community-created meme association around BNB-COIN3, alongside earlier greetings and regional news. JEV can place the new photo within that existing narrative.",
    "without": "The photo and greeting arrive without the earlier community association.",
    "with": "The remembered community imagery connects the new photo to an existing BNB-COIN3 narrative.",
    "sourceLimit": "The association comes from community imagery. A greeting or photo does not verify a token link or endorse a purchase.",
    "relationships": {
      "coin3-source-3": "Recalls the community-authored meme and the public reply while preserving who made the association.",
      "coin3-source-2": "Retains the earlier greeting as cultural context.",
      "coin3-source-1": "Separates the investment in the ecosystem company from any claim about the BNB-COIN3 token."
    }
  },
  "coin4": {
    "name": "How a community phrase became a token",
    "event": "A community phrase reappears in conversation",
    "link": "Community phrase → token creation → contract record",
    "summary": "Living Brain follows BNB-COIN4 from a community phrase to a community-created token and its contract references. JEV can place the new reply within that existing narrative.",
    "without": "The phrase reappears, but its community history and token connection are missing.",
    "with": "The remembered community posts and creation record connect the phrase to this token.",
    "sourceLimit": "Shared wording does not establish affiliation with, or endorsement by, any ecosystem organization or its representatives.",
    "relationships": {
      "coin4-source-1": "Establishes the phrase’s origin in a community post.",
      "coin4-source-2": "Records an earlier public reply about the phrase, without token endorsement.",
      "coin4-source-3": "Links the underlying token’s name to its creation record.",
      "coin4-source-4": "Records the community’s contract reference together with the author’s warning that the token could go to zero."
    }
  }
};
export function storyFor(id:string):Story {return stories[id]??{name:'Prior context informs the assessment',event:'A new public event',link:'Past context connects the event',summary:'Earlier context connects the event to this example.',without:'The current event leaves the relationship unresolved.',with:'Prior evidence supplies the missing relationship.',relationships:{}};}
const facts=recordedEvaluations.flatMap(record=>[...record.candidate.memoryEvidence,...record.candidate.currentEvidence]);
export function sourceTitle(id:string) {return facts.find(fact=>fact.id===id)?.title??'Example context';}
export function sourceAttribution(url:string):string {return facts.find(fact=>fact.url===url)?.attribution??'Redacted presentation record';}
