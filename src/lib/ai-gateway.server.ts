import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import fs from "fs";
import path from "path";

let cachedEnvKey: string | null = null;

/** Groq key powers all text generation. */
export function getAiApiKey(): string {
  const envKey =
    process.env.GROQ_API_KEY ||
    process.env.VITE_GROQ_API_KEY ||
    process.env.LOVABLE_API_KEY ||
    process.env.VITE_LOVABLE_API_KEY;
  if (envKey) return envKey;

  if (cachedEnvKey) return cachedEnvKey;

  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const idx = trimmed.indexOf("=");
          if (idx > 0) {
            const k = trimmed.substring(0, idx).trim();
            const v = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, "");
            if ((k === "GROQ_API_KEY" || k === "VITE_GROQ_API_KEY" || k === "LOVABLE_API_KEY") && v) {
              cachedEnvKey = v;
              return v;
            }
          }
        }
      }
    }
  } catch {}

  return "";
}

/**
 * Text/JSON generation via Groq.
 * Every legacy model id (openai/gpt-*, lovable ids) is mapped to a real Groq model.
 * Groq only supports `json_schema` structured outputs on the gpt-oss models, so
 * that is the default flagship — llama-3.3 would fail on structured requests.
 */
export function createGroqAiGatewayProvider(
  apiKey?: string,
  _options?: { structuredOutputs?: boolean },
) {
  const key = apiKey && apiKey.trim().length > 0 ? apiKey : getAiApiKey();
  const groq = createOpenAICompatible({
    name: "groq",
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: key,
    supportsStructuredOutputs: true,
  });

  const flagshipModel = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const fastModel = process.env.GROQ_FAST_MODEL || "openai/gpt-oss-20b";

  const isGroqNative = (id: string) =>
    id.startsWith("llama-") ||
    id.startsWith("groq/") ||
    id.startsWith("qwen/") ||
    id.startsWith("meta-llama/") ||
    id === "openai/gpt-oss-120b" ||
    id === "openai/gpt-oss-20b" ||
    id === "openai/gpt-oss-safeguard-20b";

  return (modelId: string) => {
    if (modelId && isGroqNative(modelId)) return groq(modelId);
    if (modelId && (modelId.includes("nano") || modelId.includes("lite"))) return groq(fastModel);
    return groq(flagshipModel);
  };
}

export const createLovableAiGatewayProvider = createGroqAiGatewayProvider;

/**
 * Vision / document understanding (PDF, DOCX, images).
 * Groq exposes no multimodal chat model, so these calls go through the
 * Lovable AI Gateway, which does.
 */
export function getVisionApiKey(): string {
  return process.env.LOVABLE_API_KEY || "";
}

export function createVisionProvider(apiKey?: string) {
  const key = apiKey && apiKey.trim().length > 0 ? apiKey : getVisionApiKey();
  const gateway = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: key,
    headers: { "Lovable-API-Key": key },
    supportsStructuredOutputs: true,
  });
  return (modelId: string) => gateway(modelId || "google/gemini-3.5-flash");
}
