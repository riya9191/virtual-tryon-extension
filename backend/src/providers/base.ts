import type { ProductMeta } from "../schemas/tryon.js";

export type TryOnGeneration = {
  imageBytes: Buffer;
  promptUsed: string;
  provider: string;
};

export interface TryOnProvider {
  generate(input: {
    userImage: Buffer;
    productImage: Buffer;
    product: ProductMeta;
  }): Promise<TryOnGeneration>;
}

