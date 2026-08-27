import "dotenv/config";

export type ProviderName = "mock" | "gemini" | "huggingface";

export type AppConfig = {
  host: string;
  port: number;
  provider: ProviderName;
  geminiApiKey?: string;
  geminiModel: string;
  hfToken?: string;
  hfSpace: string;
  hfDenoiseSteps: number;
  useMockProvider: boolean;
  allowedOrigins: string[];
  maxImageBytes: number;
  maxImageSide: number;
};

export function getConfig(): AppConfig {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const hfToken = process.env.HF_TOKEN;
  const useMockProvider = readBoolean(process.env.USE_MOCK_PROVIDER, true);

  return {
    host: process.env.BACKEND_HOST ?? "127.0.0.1",
    port: Number(process.env.BACKEND_PORT ?? 8000),
    provider: resolveProvider(process.env.PROVIDER, { useMockProvider, geminiApiKey, hfToken }),
    geminiApiKey,
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash-image",
    hfToken,
    hfSpace: process.env.HF_SPACE ?? "yisol/IDM-VTON",
    hfDenoiseSteps: Number(process.env.HF_DENOISE_STEPS ?? 30),
    useMockProvider,
    allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "chrome-extension://*,http://localhost:*,http://127.0.0.1:*")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    maxImageBytes: Number(process.env.MAX_IMAGE_BYTES ?? 8 * 1024 * 1024),
    maxImageSide: Number(process.env.MAX_IMAGE_SIDE ?? 1024),
  };
}

function resolveProvider(
  explicit: string | undefined,
  ctx: { useMockProvider: boolean; geminiApiKey?: string; hfToken?: string },
): ProviderName {
  const value = explicit?.trim().toLowerCase();
  if (value === "mock" || value === "gemini" || value === "huggingface") {
    return value;
  }
  if (ctx.useMockProvider) return "mock";
  if (ctx.geminiApiKey) return "gemini";
  if (ctx.hfToken) return "huggingface";
  return "mock";
}

export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return true;
  return allowedOrigins.some((pattern) => {
    const regex = new RegExp(`^${escapeRegex(pattern).replace(/\*/g, ".*")}$`);
    return regex.test(origin);
  });
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function escapeRegex(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

