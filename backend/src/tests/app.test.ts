import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { buildApp } from "../app.js";
import type { AppConfig } from "../config.js";

// The URL guard resolves DNS before fetching; stub it so tests stay offline.
vi.mock("node:dns/promises", () => ({
  lookup: async () => [{ address: "93.184.216.34", family: 4 }],
}));

const PRODUCT_URL = "https://m.media-amazon.com/images/I/test.png";

const config: AppConfig = {
  host: "127.0.0.1",
  port: 8000,
  provider: "mock",
  geminiModel: "gemini-2.5-flash-image",
  hfSpace: "yisol/IDM-VTON",
  hfDenoiseSteps: 30,
  useMockProvider: true,
  allowedOrigins: ["*"],
  allowedImageHosts: ["m.media-amazon.com"],
  maxImageBytes: 8 * 1024 * 1024,
  maxImageSide: 1024,
  fetchTimeoutMs: 15_000,
  cacheMaxEntries: 32,
  cacheTtlMs: 60 * 60 * 1000,
};

async function makePng(color: string): Promise<Buffer> {
  return sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: color,
    },
  })
    .png()
    .toBuffer();
}

function stubImageFetch(productImage: Buffer) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "image/png" }),
    arrayBuffer: async () =>
      productImage.buffer.slice(
        productImage.byteOffset,
        productImage.byteOffset + productImage.byteLength,
      ),
  }));

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function tryOnPayload(userImage: Buffer, productUrl = PRODUCT_URL) {
  return {
    user_image_b64: userImage.toString("base64"),
    product_image_url: productUrl,
    product: {
      title: "Blue cotton shirt",
      category: "top",
      brand: "Example",
      marketplace: "amazon",
    },
  };
}

describe("backend app", () => {
  it("reports health", async () => {
    const app = buildApp(config);
    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", provider: "mock" });
  });

  it("generates a mock try-on image", async () => {
    stubImageFetch(await makePng("#22aa66"));

    const app = buildApp(config);
    const userImage = await makePng("#3355aa");
    const response = await app.inject({
      method: "POST",
      url: "/api/tryon",
      payload: tryOnPayload(userImage),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ provider: "mock", cached: false });
    expect(Buffer.from(response.json().image_b64, "base64").length).toBeGreaterThan(100);
  });

  it("serves a repeated request from cache without refetching the product", async () => {
    const fetchMock = stubImageFetch(await makePng("#22aa66"));

    const app = buildApp(config);
    const userImage = await makePng("#3355aa");
    const payload = tryOnPayload(userImage);

    const first = await app.inject({ method: "POST", url: "/api/tryon", payload });
    const second = await app.inject({ method: "POST", url: "/api/tryon", payload });

    expect(first.json().cached).toBe(false);
    expect(second.json().cached).toBe(true);
    expect(second.json().image_b64).toBe(first.json().image_b64);
    // The second request must not spend another upstream call.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a product image host that is not allowlisted", async () => {
    stubImageFetch(await makePng("#22aa66"));

    const app = buildApp(config);
    const userImage = await makePng("#3355aa");
    const response = await app.inject({
      method: "POST",
      url: "/api/tryon",
      payload: tryOnPayload(userImage, "https://evil.example.com/product.png"),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().detail).toContain("not allowed");
  });

  it("rejects a request that targets a loopback address", async () => {
    stubImageFetch(await makePng("#22aa66"));

    const app = buildApp({ ...config, allowedImageHosts: [] });
    const userImage = await makePng("#3355aa");
    const response = await app.inject({
      method: "POST",
      url: "/api/tryon",
      payload: tryOnPayload(userImage, "https://127.0.0.1/product.png"),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().detail).toContain("non-public");
  });
});

