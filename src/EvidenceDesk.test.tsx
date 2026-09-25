import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EvidenceDesk } from "./EvidenceDesk.js";

describe("focused terminal navigation", () => {
  it("keeps trading controls without a provider-connections panel", () => {
    const html = renderToStaticMarkup(<EvidenceDesk />);
    expect(html).toContain('aria-label="Execution policy"');
    expect(html).toContain('aria-label="Paper positions"');
    expect(html).not.toContain("Provider connections");
    expect(html).not.toContain("Real inputs. Visible provenance.");
  });
});
