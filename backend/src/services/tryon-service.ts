import type { AppConfig } from "../config.js";
import { GeminiTryOnProvider } from "../providers/gemini.js";
import { HuggingFaceTryOnProvider } from "../providers/huggingface.js";
import { MockTryOnProvider } from "../providers/mock.js";
import type { TryOnProvider } from "../providers/base.js";
import type { TryOnRequest, TryOnResponse } from "../schemas/tryon.js";
import { decodeBase64Image, encodeBase64Image, normalizeImage } from "./images.js";

export class TryOnService {
  constructor(
    private readonly config: AppConfig,
    private readonly provider: TryOnProvider = buildProvider(config),
  ) {}

  async generate(request: TryOnRequest): Promise<TryOnResponse> {
    const started = performance.now();
    const userImage = await normalizeImage(
      decodeBase64Image(request.user_image_b64, this.config.maxImageBytes),
      this.config.maxImageSide,
    );
    const productImage = await this.fetchProductImage(request.product_image_url);

    const result = await this.provider.generate({
      userImage,
      productImage,
      product: request.product,
    });

    return {
      image_b64: encodeBase64Image(result.imageBytes),
      prompt_used: result.promptUsed,
      latency_ms: Math.round(performance.now() - started),
      provider: result.provider,
    };
  }

  private async fetchProductImage(url: string): Promise<Buffer> {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) {
      throw new Error(`product image fetch failed with ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("image")) {
      throw new Error("product_image_url did not return an image");
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > this.config.maxImageBytes) {
      throw new Error("product image is too large");
    }

    return normalizeImage(bytes, this.config.maxImageSide);
  }
}

export function buildProvider(config: AppConfig): TryOnProvider {
  switch (config.provider) {
    case "huggingface":
      return new HuggingFaceTryOnProvider(config.hfToken, config.hfSpace, config.hfDenoiseSteps);
    case "gemini":
      if (!config.geminiApiKey) {
        return new MockTryOnProvider();
      }
      return new GeminiTryOnProvider(config.geminiApiKey, config.geminiModel);
    default:
      return new MockTryOnProvider();
  }
}

