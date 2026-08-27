import { describe, expect, it } from "vitest";

import { buildTryOnPrompt, PROMPT_VERSION, resolveCategory } from "../services/prompts.js";

describe("prompt orchestration", () => {
  it("trusts an explicit category", () => {
    expect(resolveCategory({ title: "anything at all", category: "dress" })).toBe("dress");
  });

  it("infers a category from the product title", () => {
    const cases: Array<[string, string]> = [
      ["Levis Mens Slim Fit Jeans", "bottom"],
      ["Nike Air Zoom Running Shoes", "footwear"],
      ["Zara Oversized Denim Jacket", "outerwear"],
      ["Floral Maxi Dress for Women", "dress"],
      ["Allen Solly Cotton Polo T-Shirt", "top"],
    ];

    for (const [title, expected] of cases) {
      expect(resolveCategory({ title })).toBe(expected);
    }
  });

  it("falls back to unknown when nothing matches", () => {
    expect(resolveCategory({ title: "Stainless steel water bottle" })).toBe("unknown");
  });

  it("emits category-specific fit guidance", () => {
    const top = buildTryOnPrompt({ title: "Cotton shirt", category: "top" });
    const bottom = buildTryOnPrompt({ title: "Slim fit jeans", category: "bottom" });

    expect(top).toContain("torso and arms");
    expect(top).toContain("Category: top");
    expect(bottom).toContain("waist, hips, and legs");
    expect(bottom).not.toContain("torso and arms");
  });

  it("exposes a prompt version for cache invalidation", () => {
    expect(PROMPT_VERSION).toMatch(/^\d+$/);
  });
});
