import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResearchEvidenceView } from "./SupportingResearch.js";
import { normalizeEvidence } from "../server/enrichment.js";
const token="0x"+"1".repeat(40);
describe("supporting research presentation",()=>{
  it("labels shadow evidence, missing values and sampled coverage without claiming a model input",()=>{
    const e=normalizeEvidence(token,[{key:"info",requestedAt:1000,receivedAt:2000,raw:{address:token,price:{buy_volume_5m:"0",sell_volume_5m:"10"}}}],2000);
    const html=renderToStaticMarkup(<ResearchEvidenceView evidence={e} now={3000} frozen={false}/>);
    expect(html).toContain("Not used by JEV or entry rules");
    expect(html).toContain("Creator history");
    expect(html).toContain("Wallet behavior");
    expect(html).toContain("Short-window flow");
    expect(html).toContain("Pool depth");
    expect(html).toContain("Unavailable");
    expect(html).toContain("Latest observation");
    expect(html).toContain("Field availability");
    expect(html).toContain("Partial data");
    expect(html).toContain("missing evidence, not zero activity");
  });
});
