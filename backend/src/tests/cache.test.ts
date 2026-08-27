import { describe, expect, it, vi } from "vitest";

import { ResultCache } from "../services/cache.js";

describe("ResultCache", () => {
  it("returns a cached value on the second lookup", async () => {
    const cache = new ResultCache<string>(4, 1000);
    const produce = vi.fn(async () => "value");

    expect(await cache.resolve("k", produce)).toEqual({ value: "value", source: "generated" });
    expect(await cache.resolve("k", produce)).toEqual({ value: "value", source: "cache" });
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent requests for the same key into one call", async () => {
    const cache = new ResultCache<string>(4, 1000);
    let release: (value: string) => void = () => {};
    const produce = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );

    const first = cache.resolve("k", produce);
    const second = cache.resolve("k", produce);
    const third = cache.resolve("k", produce);

    release("generated-once");
    const results = await Promise.all([first, second, third]);

    // This is the quota protection: three clicks, one upstream generation.
    expect(produce).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.value)).toEqual([
      "generated-once",
      "generated-once",
      "generated-once",
    ]);
    expect(results.filter((r) => r.source === "coalesced")).toHaveLength(2);
  });

  it("does not cache a rejected generation", async () => {
    const cache = new ResultCache<string>(4, 1000);
    const produce = vi
      .fn(async (): Promise<string> => "unused")
      .mockRejectedValueOnce(new Error("upstream down"))
      .mockResolvedValueOnce("recovered");

    await expect(cache.resolve("k", produce)).rejects.toThrow("upstream down");
    expect(await cache.resolve("k", produce)).toMatchObject({ value: "recovered" });
    expect(produce).toHaveBeenCalledTimes(2);
  });

  it("expires entries once the ttl has passed", async () => {
    let now = 0;
    const cache = new ResultCache<string>(4, 100, () => now);

    await cache.resolve("k", async () => "value");
    now = 99;
    expect(cache.get("k")).toBe("value");

    now = 101;
    expect(cache.get("k")).toBeUndefined();
  });

  it("evicts the least recently used entry when full", async () => {
    const cache = new ResultCache<string>(2, 1000);

    await cache.resolve("a", async () => "A");
    await cache.resolve("b", async () => "B");
    cache.get("a"); // refresh "a" so "b" becomes the eviction target
    await cache.resolve("c", async () => "C");

    expect(cache.size).toBe(2);
    expect(cache.get("a")).toBe("A");
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe("C");
  });

  it("is a no-op when disabled", async () => {
    const cache = new ResultCache<string>(0, 1000);
    const produce = vi.fn(async () => "value");

    await cache.resolve("k", produce);
    await cache.resolve("k", produce);

    expect(produce).toHaveBeenCalledTimes(2);
  });
});
