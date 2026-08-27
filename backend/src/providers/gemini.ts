import { GoogleGenAI, Modality } from "@google/genai";

import type { TryOnGeneration, TryOnProvider } from "./base.js";
import { buildTryOnPrompt } from "../services/prompts.js";

export class GeminiTryOnProvider implements TryOnProvider {
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(input: Parameters<TryOnProvider["generate"]>[0]): Promise<TryOnGeneration> {
    const prompt = buildTryOnPrompt(input.product);
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/png", data: input.userImage.toString("base64") } },
            { inlineData: { mimeType: "image/png", data: input.productImage.toString("base64") } },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    for (const candidate of response.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.inlineData?.data) {
          return {
            imageBytes: Buffer.from(part.inlineData.data, "base64"),
            promptUsed: prompt,
            provider: "gemini",
          };
        }
      }
    }

    throw new Error("Gemini did not return an image");
  }
}

