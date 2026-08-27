import type { ProductMeta } from "../schemas/tryon.js";

export function buildTryOnPrompt(product: ProductMeta): string {
  const details = [
    `Product title: ${product.title}`,
    `Category: ${product.category ?? "unknown"}`,
    `Brand: ${product.brand ?? "unknown"}`,
    `Marketplace: ${product.marketplace ?? "unknown"}`,
  ].join("\n");

  return [
    "Generate a photorealistic virtual try-on image using the person in the first image and the garment/product in the second image.",
    "Preserve the person's face, hair, body proportions, skin tone, pose, and overall identity.",
    "Adapt the garment naturally to the person's body while preserving the product's color, pattern, fabric texture, silhouette, and visible design details.",
    "Keep the composition clean, realistic, and free of added text, watermarks, or logos not present on the original product.",
    "",
    details,
  ].join("\n");
}

