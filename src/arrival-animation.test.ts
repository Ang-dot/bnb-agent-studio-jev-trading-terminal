import { afterEach, describe, expect, it, vi } from "vitest";
import { animateArrival } from "./EvidenceDesk.js";
afterEach(() => vi.unstubAllGlobals());
describe("arrival movement accessibility", () => {
  it("uses a one-shot slide and highlight when motion is allowed", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
    const animate = vi.fn();
    animateArrival({ animate } as unknown as HTMLElement);
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.calls[0][1]).toMatchObject({ duration: 680 });
    expect(animate.mock.calls[1][1]).toMatchObject({ duration: 3800 });
  });
  it("never starts movement with reduced motion, or for a filtered-out row", () => {
    const media = vi.fn(() => ({ matches: true }));
    vi.stubGlobal("window", { matchMedia: media });
    const animate = vi.fn();
    animateArrival({ animate } as unknown as HTMLElement);
    animateArrival(null);
    expect(media).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(animate).not.toHaveBeenCalled();
  });
});
