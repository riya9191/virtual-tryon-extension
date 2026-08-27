import { Client, handle_file } from "@gradio/client";

import type { TryOnGeneration, TryOnProvider } from "./base.js";
import type { ProductMeta } from "../schemas/tryon.js";

type FileDataLike = { url?: string | null; path?: string | null };

export class HuggingFaceTryOnProvider implements TryOnProvider {
  constructor(
    private readonly hfToken: string | undefined,
    private readonly space: string,
    private readonly denoiseSteps: number,
  ) {}

  async generate(input: Parameters<TryOnProvider["generate"]>[0]): Promise<TryOnGeneration> {
    const prompt = buildGarmentDescription(input.product);

    if (this.hfToken) {
      try {
        return await this.run(input, prompt, this.hfToken);
      } catch (error) {
        if (!isQuotaError(error)) {
          throw error;
        }
      }
    }

    return this.run(input, prompt, undefined);
  }

  private async run(
    input: Parameters<TryOnProvider["generate"]>[0],
    prompt: string,
    token: string | undefined,
  ): Promise<TryOnGeneration> {
    const client = await Client.connect(
      this.space,
      token ? { hf_token: token as `hf_${string}` } : {},
    );

    const humanBlob = new Blob([input.userImage], { type: "image/png" });
    const garmentBlob = new Blob([input.productImage], { type: "image/png" });

    let result: Awaited<ReturnType<typeof client.predict>>;
    try {
      result = await client.predict("/tryon", [
        { background: handle_file(humanBlob), layers: [], composite: null },
        handle_file(garmentBlob),
        prompt,
        true, // is_checked: auto-generate the mask
        false, // is_checked_crop: keep original framing
        this.denoiseSteps,
        42, // seed
      ]);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error);
      if (detail.includes("IndexError")) {
        throw new Error(
          "IDM-VTON could not detect a person in the uploaded photo. Use a clear, full/upper-body photo of a person.",
        );
      }
      throw new Error(`Hugging Face try-on failed: ${detail}`);
    }

    const output = Array.isArray(result.data) ? (result.data[0] as FileDataLike) : undefined;
    const imageUrl = output?.url;
    if (!imageUrl) {
      throw new Error("Hugging Face try-on Space did not return an image");
    }

    const imageResponse = await fetch(
      imageUrl,
      token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    );
    if (!imageResponse.ok) {
      throw new Error(`failed to download try-on image (${imageResponse.status})`);
    }

    const imageBytes = Buffer.from(await imageResponse.arrayBuffer());
    return {
      imageBytes,
      promptUsed: prompt,
      provider: "huggingface",
    };
  }
}

function isQuotaError(error: unknown): boolean {
  const detail = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    detail.includes("quota") || detail.includes("exceeded") || detail.includes("gpu task aborted")
  );
}

function buildGarmentDescription(product: ProductMeta): string {
  return [product.category, product.brand, product.title]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .slice(0, 250);
}
