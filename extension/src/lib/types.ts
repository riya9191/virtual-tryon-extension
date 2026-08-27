export type ProductMeta = {
  title: string;
  category?: string | null;
  brand?: string | null;
  marketplace?: string | null;
  page_url?: string | null;
};

export type ProductSnapshot = {
  productImageUrl: string;
  product: ProductMeta;
};

export type TryOnResponse = {
  image_b64: string;
  prompt_used: string;
  latency_ms: number;
  provider: string;
};

export type ExtensionSettings = {
  backendUrl: string;
  userImageB64?: string;
};

export type TryOnMessage = {
  type: "TRY_ON";
  payload: ProductSnapshot;
};

export type TryOnSuccess = {
  ok: true;
  data: TryOnResponse;
};

export type TryOnFailure = {
  ok: false;
  error: string;
};

export type TryOnMessageResponse = TryOnSuccess | TryOnFailure;

