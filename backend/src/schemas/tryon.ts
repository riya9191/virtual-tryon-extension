import { z } from "zod";

export const productMetaSchema = z.object({
  title: z.string().min(1).max(500),
  category: z.string().max(120).nullable().optional(),
  brand: z.string().max(120).nullable().optional(),
  marketplace: z.string().max(80).nullable().optional(),
  page_url: z.string().url().nullable().optional(),
});

export const tryOnRequestSchema = z.object({
  user_image_b64: z.string().min(64),
  product_image_url: z.string().url(),
  product: productMetaSchema,
});

export type ProductMeta = z.infer<typeof productMetaSchema>;
export type TryOnRequest = z.infer<typeof tryOnRequestSchema>;

export type TryOnResponse = {
  image_b64: string;
  prompt_used: string;
  latency_ms: number;
  provider: string;
};

