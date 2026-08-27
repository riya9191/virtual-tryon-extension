import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";

import { getConfig, isOriginAllowed, type AppConfig } from "./config.js";
import { tryOnRequestSchema } from "./schemas/tryon.js";
import { TryOnService } from "./services/tryon-service.js";

export function buildApp(config: AppConfig = getConfig()): FastifyInstance {
  const app = Fastify({ logger: process.env.NODE_ENV !== "test" });
  const service = new TryOnService(config);

  app.register(cors, {
    origin(origin, callback) {
      callback(null, isOriginAllowed(origin, config.allowedOrigins));
    },
    credentials: true,
  });

  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof ZodError) {
      reply.status(400).send({ detail: error.issues.map((issue) => issue.message).join("; ") });
      return;
    }

    request.log.error({ err: error }, "try-on request failed");

    // Errors that carry their own status (e.g. a rejected product image URL)
    // are client mistakes; anything else is treated as an upstream failure.
    const explicit = (error as { statusCode?: unknown })?.statusCode;
    if (typeof explicit === "number" && explicit >= 400 && explicit < 500) {
      reply.status(explicit).send({ detail: toMessage(error) });
      return;
    }

    if (error instanceof Error && error.name === "TimeoutError") {
      reply.status(504).send({ detail: "product image fetch timed out" });
      return;
    }

    const message = toMessage(error);
    const statusCode = message.includes("image") || message.includes("base64") ? 400 : 502;
    reply.status(statusCode).send({ detail: message });
  });

  app.get("/api/health", async () => ({
    status: "ok",
    provider: config.provider,
    gemini_configured: Boolean(config.geminiApiKey),
    hf_configured: Boolean(config.hfToken),
  }));

  app.post("/api/tryon", async (request) => {
    const payload = tryOnRequestSchema.parse(request.body);
    return service.generate(payload);
  });

  return app;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown backend error";
}
