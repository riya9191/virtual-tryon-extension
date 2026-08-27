import sharp from "sharp";

import type { TryOnGeneration, TryOnProvider } from "./base.js";
import { buildTryOnPrompt } from "../services/prompts.js";

export class MockTryOnProvider implements TryOnProvider {
  async generate(input: Parameters<TryOnProvider["generate"]>[0]): Promise<TryOnGeneration> {
    const user = await sharp(input.userImage)
      .resize({ width: 430, height: 590, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    const product = await sharp(input.productImage)
      .resize({ width: 330, height: 360, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();

    const title = escapeXml(input.product.title.slice(0, 70));
    const svg = Buffer.from(`
      <svg width="1024" height="768" xmlns="http://www.w3.org/2000/svg">
        <rect width="1024" height="768" fill="#f7f4ee"/>
        <text x="70" y="60" font-family="Arial" font-size="28" font-weight="700" fill="#1f2937">Mock virtual try-on preview</text>
        <text x="610" y="115" font-family="Arial" font-size="18" font-weight="700" fill="#374151">Product image</text>
        <rect x="498" y="306" width="78" height="56" rx="14" fill="#111827"/>
        <text x="525" y="346" font-family="Arial" font-size="34" font-weight="700" fill="#ffffff">+</text>
        <text x="70" y="724" font-family="Arial" font-size="18" fill="#4b5563">${title}</text>
      </svg>
    `);

    const imageBytes = await sharp(svg)
      .composite([
        { input: user, left: 70, top: 112 },
        { input: product, left: 610, top: 150 },
      ])
      .png()
      .toBuffer();

    return {
      imageBytes,
      promptUsed: buildTryOnPrompt(input.product),
      provider: "mock",
    };
  }
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (char) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;",
    };
    return entities[char] ?? char;
  });
}

