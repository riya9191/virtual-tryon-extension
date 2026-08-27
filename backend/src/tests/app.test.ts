import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

import { buildApp } from "../app.js";
import type { AppConfig } from "../config.js";

const config: AppConfig = {
  host: "127.0.0.1",
  port: 8000,
  provider: "mock",
  geminiModel: "gemini-2.5-flash-image",
  hfSpace: "yisol/IDM-VTON",
  hfDenoiseSteps: 30,
  useMockProvider: true,
  allowedOrigins: ["*"],
  maxImageBytes: 8 * 1024 * 1024,
  maxImageSide: 1024,
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

describe("backend app", () => {
  it("reports health", async () => {
    const app = buildApp(config);
    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", provider: "mock" });
  });

  it("generates a mock try-on image", async () => {
    const productImage = await makePng("#22aa66");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: new Headers({ "content-type": "image/png" }),
        arrayBuffer: async () => productImage.buffer.slice(
          productImage.byteOffset,
          productImage.byteOffset + productImage.byteLength,
        ),
      })),
    );

    const app = buildApp(config);
    const userImage = await makePng("#3355aa");
    const response = await app.inject({
      method: "POST",
      url: "/api/tryon",
      payload: {
        user_image_b64: userImage.toString("base64"),
        product_image_url: "https://example.com/product.png",
        product: {
          title: "Blue cotton shirt",
          category: "top",
          brand: "Example",
          marketplace: "amazon",
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ provider: "mock" });
    expect(Buffer.from(response.json().image_b64, "base64").length).toBeGreaterThan(100);
  });
});

