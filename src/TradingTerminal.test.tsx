import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TradingTerminal } from "./TradingTerminal.js";

describe("approved terminal layout", () => {
  it("shows BNB Chain, one divider, then the JEV logo and Trading Terminal", () => {
    const html = renderToStaticMarkup(<TradingTerminal onReplay={() => {}} />);
    const header = html.match(/<header[^>]*>([\s\S]*?)<\/header>/)?.[1] ?? "";
    expect(header).toContain('alt="BNB Chain"');
    expect(header.indexOf('alt="BNB Chain"')).toBeLessThan(header.indexOf('class="tt-brand-divider"'));
    expect(header.indexOf('class="tt-brand-divider"')).toBeLessThan(header.indexOf('alt="TypeSafe — JEV"'));
    expect(header.indexOf('alt="TypeSafe — JEV"')).toBeLessThan(header.indexOf('<h1>Trading Terminal</h1>'));
    expect(header.match(/class="tt-brand-divider"/g)).toHaveLength(1);
    expect(header.match(/alt="TypeSafe — JEV"/g)).toHaveLength(1);
    expect(header).toMatch(/alt="TypeSafe — JEV"[^>]*width="32"[^>]*height="32"/);
    expect(header).not.toContain('JEV Trading Terminal');
    expect(header).not.toContain('class="tt-network"');
    expect(header).not.toContain(" BSC");
  });

  it("renders the radar, vertical stream, honest loading states and official logos", () => {
    const html = renderToStaticMarkup(<TradingTerminal onReplay={() => {}} />);
    expect(html).toContain('<h1>Trading Terminal</h1>');
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
