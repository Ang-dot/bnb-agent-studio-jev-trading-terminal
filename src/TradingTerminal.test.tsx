import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TradingTerminal } from "./TradingTerminal.js";

describe("approved terminal layout", () => {
  it("uses one JEV logo before the title with no trailing brand badge", () => {
    const html = renderToStaticMarkup(<TradingTerminal onReplay={() => {}} />);
    const header = html.match(/<header[^>]*>([\s\S]*?)<\/header>/)?.[1] ?? "";
    expect(header).not.toContain('alt="BNB Chain"');
    expect(header.indexOf('alt="TypeSafe — JEV"')).toBeLessThan(header.indexOf("JEV Trading Terminal"));
    expect(header.match(/alt="TypeSafe — JEV"/g)).toHaveLength(1);
    expect(header).toMatch(/alt="TypeSafe — JEV"[^>]*width="40"[^>]*height="40"/);
    expect(header).not.toContain('class="tt-network"');
    expect(header).not.toContain(" BSC");
  });

  it("renders the radar, vertical stream, honest loading states and official logos", () => {
    const html = renderToStaticMarkup(<TradingTerminal onReplay={() => {}} />);
    expect(html).toContain("JEV Trading Terminal");
    expect(html).toContain('aria-label="Launch radar"');
    expect(html).toContain('aria-label="Decision stream"');
    expect(html).toContain('aria-label="Decision evidence stages"');
    expect(html).toContain('alt="Living Brain"');
    expect(html).toContain('alt="TypeSafe — JEV"');
    expect(html).toContain("Connecting to terminal");
    expect(html).not.toContain("Motion on");
    expect(html).not.toContain("Pause agent");
    expect(html).not.toContain("Stop all");
    expect(html).not.toContain("JEV LIVE");
    expect(html).not.toContain("Sample data");
    expect(html).not.toContain("FLARE");
  });
});
