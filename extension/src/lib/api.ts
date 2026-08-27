import type { ProductSnapshot, TryOnResponse } from "./types";

export async function requestTryOn(
  backendUrl: string,
  userImageB64: string,
  snapshot: ProductSnapshot,
): Promise<TryOnResponse> {
  const response = await fetch(`${backendUrl.replace(/\/$/, "")}/api/tryon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_image_b64: userImageB64,
      product_image_url: snapshot.productImageUrl,
      product: snapshot.product,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Try-on request failed with ${response.status}`);
  }

  return response.json() as Promise<TryOnResponse>;
}

