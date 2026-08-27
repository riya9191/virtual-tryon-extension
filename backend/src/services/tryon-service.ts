import { createHash } from "node:crypto";

import type { AppConfig } from "../config.js";
import { GeminiTryOnProvider } from "../providers/gemini.js";
import { HuggingFaceTryOnProvider } from "../providers/huggingface.js";
import { MockTryOnProvider } from "../providers/mock.js";
import type { TryOnGeneration, TryOnProvider } from "../providers/base.js";
import type { TryOnRequest, TryOnResponse } from "../schemas/tryon.js";
import { ResultCache } from "./cache.js";
import { decodeBase64Image, encodeBase64Image, normalizeImage } from "./images.js";
import { PROMPT_VERSION, resolveCategory } from "./prompts.js";
import { assertUrlIsFetchable, BlockedUrlError } from "./url-guard.js";

const MAX_REDIRECTS = 3;

export class TryOnService {
  private readonly cache: ResultCache<TryOnGeneration>;

  constructor(
    private readonly config: AppConfig,
    private readonly provider: TryOnProvider = buildProvider(config),
    cache?: ResultCache<TryOnGeneration>,
  ) {
    this.cache = cache ?? new ResultCache<TryOnGeneration>(config.cacheMaxEntries, config.cacheTtlMs);
  }

  async generate(request: TryOnRequest): Promise<TryOnResponse> {
    const started = performance.now();

    const url = await assertUrlIsFetchable(request.product_image_url, this.config.allowedImageHosts);

    const userImage = await normalizeImage(
      decodeBase64Image(request.user_image_b64, this.config.maxImageBytes),
      this.config.maxImageSide,
    );

    // Hashing the *normalized* bytes keeps the key stable even when the client
    // re-encodes the same photo between requests.
    const key = this.cacheKey(userImage, url, request);

    const { value: result, source } = await this.cache.resolve(key, async () => {
      const productImage = await this.fetchProductImage(url);
      return this.provider.generate({
        userImage,
        productImage,
        product: request.product,
      });
    });

    return {
      image_b64: encodeBase64Image(result.imageBytes),
      prompt_used: result.promptUsed,
      latency_ms: Math.round(performance.now() - started),
      provider: result.provider,
      cached: source !== "generated",
    };
  }

  private cacheKey(userImage: Buffer, url: URL, request: TryOnRequest): string {
    return createHash("sha256")
      .update(userImage)
      .update("\u0000")
      .update(url.toString())
      .update("\u0000")
      .update(resolveCategory(request.product))
      .update("\u0000")
      .update(request.product.title)
      .update("\u0000")
      .update(PROMPT_VERSION)
      .update("\u0000")
      .update(this.config.provider)
      .update("\u0000")
      .update(String(this.config.hfDenoiseSteps))
      .digest("hex");
  }

  /**
   * Redirects are followed manually so that every hop is re-validated. Letting
   * `fetch` follow them automatically would allow an allowlisted host to bounce
   * the request to an internal address.
   */
  private async fetchProductImage(startUrl: URL): Promise<Buffer> {
    let url = startUrl;
    let response: Response | undefined;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(this.config.fetchTimeoutMs),
        headers: { accept: "image/*" },
      });

      if (!isRedirect(response.status)) break;

      const location = response.headers.get("location");
      if (!location) {
        throw new BlockedUrlError("product image redirect was missing a location header");
      }

      url = await assertUrlIsFetchable(
        new URL(location, url).toString(),
        this.config.allowedImageHosts,
      );

      if (hop === MAX_REDIRECTS) {
        throw new BlockedUrlError("product image exceeded the redirect limit");
      }
    }

    if (!response) {
      throw new Error("product image fetch produced no response");
    }

    if (!response.ok) {
      throw new Error(`product image fetch failed with ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("image")) {
      throw new Error("product_image_url did not return an image");
    }

    const declaredLength = Number(response.headers.get("content-length") ?? Number.NaN);
    if (Number.isFinite(declaredLength) && declaredLength > this.config.maxImageBytes) {
      throw new Error("product image is too large");
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > this.config.maxImageBytes) {
      throw new Error("product image is too large");
    }

    return normalizeImage(bytes, this.config.maxImageSide);
  }
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
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

