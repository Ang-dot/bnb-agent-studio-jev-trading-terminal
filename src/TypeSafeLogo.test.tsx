import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TypeSafeLogo } from "./TypeSafeLogo.js";

describe("TypeSafe model identity", () => {
  it("uses the official local asset with an accessible provider label", () => {
    const html = renderToStaticMarkup(<TypeSafeLogo size={24} />);
    expect(html).toContain("typesafe-logo.png");
    expect(html).toContain('alt="TypeSafe — JEV"');
    expect(html).toContain('width="24"');
    expect(html).toContain('height="24"');
    expect(html).not.toContain("https://");
  });
});
