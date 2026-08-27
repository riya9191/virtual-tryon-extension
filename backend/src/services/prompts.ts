import type { ProductMeta } from "../schemas/tryon.js";

/**
 * Bump whenever the prompt text changes. It is part of the cache key, so an
 * edit here invalidates previously cached generations instead of serving
 * results that were produced by an older prompt.
 */
export const PROMPT_VERSION = "2";

export type GarmentCategory = "top" | "bottom" | "dress" | "outerwear" | "footwear" | "unknown";

const CATEGORY_PATTERNS: Array<[GarmentCategory, RegExp]> = [
  ["outerwear", /\b(jacket|blazer|coat|hoodie|sweatshirt|cardigan|parka|windcheater)\b/i],
  ["dress", /\b(dress|gown|frock|kurti|saree|sari|jumpsuit|romper)\b/i],
  ["bottom", /\b(jeans|trousers?|pants?|shorts?|skirt|leggings?|chinos?|joggers|py?jamas?)\b/i],
  ["footwear", /\b(shoes?|sneakers?|boots?|sandals?|heels?|loafers?|slippers?|flip[- ]?flops?)\b/i],
  ["top", /\b(shirt|t-?shirt|tee|top|blouse|kurta|sweater|pullover|polo|tank)\b/i],
];

export function resolveCategory(product: ProductMeta): GarmentCategory {
  const declared = product.category?.trim().toLowerCase();
  if (declared && isGarmentCategory(declared)) {
    return declared;
  }

  const haystack = `${product.title} ${declared ?? ""}`;
  for (const [category, pattern] of CATEGORY_PATTERNS) {
    if (pattern.test(haystack)) return category;
  }

  return "unknown";
}

/**
 * Per-category guidance. A single generic instruction produced obvious failures
 * (trousers rendered onto the torso, footwear pasted onto the chest), so the
 * fit instruction is selected from the resolved category instead.
 */
const CATEGORY_GUIDANCE: Record<GarmentCategory, string> = {
  top: "Fit the garment to the torso and arms. Keep the person's lower body, legs, and existing bottoms completely unchanged.",
  bottom:
    "Fit the garment to the waist, hips, and legs. Keep the person's upper body, face, and existing top completely unchanged.",
  dress:
    "Fit the garment as a single full-length piece from shoulders to hem. Keep the person's face, arms, and legs natural and unchanged in shape.",
  outerwear:
    "Layer the garment over the person's existing clothing. Keep the inner layer partially visible at the collar and cuffs so the result reads as outerwear.",
  footwear:
    "Fit the product to the feet only. Keep the person's clothing, pose, and body completely unchanged.",
  unknown:
    "Infer the correct body region from the product image and fit the garment there. Leave every other region of the person unchanged.",
};

export function buildTryOnPrompt(product: ProductMeta): string {
  const category = resolveCategory(product);

  const details = [
    `Product title: ${product.title}`,
    `Category: ${category}`,
    `Brand: ${product.brand ?? "unknown"}`,
    `Marketplace: ${product.marketplace ?? "unknown"}`,
  ].join("\n");

  return [
    "Generate a photorealistic virtual try-on image using the person in the first image and the garment/product in the second image.",
    "Preserve the person's face, hair, body proportions, skin tone, pose, and overall identity.",
    "Adapt the garment naturally to the person's body while preserving the product's color, pattern, fabric texture, silhouette, and visible design details.",
    CATEGORY_GUIDANCE[category],
    "Keep the composition clean, realistic, and free of added text, watermarks, or logos not present on the original product.",
    "",
    details,
  ].join("\n");
}

function isGarmentCategory(value: string): value is GarmentCategory {
  return ["top", "bottom", "dress", "outerwear", "footwear", "unknown"].includes(value);
}

