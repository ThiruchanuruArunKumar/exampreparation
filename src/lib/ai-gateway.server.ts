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
 * Maps models to Groq's top 70B models (llama-3.3-70b-versatile and deepseek-r1-distill-llama-70b).
 * supportsStructuredOutputs is set to false so Vercel AI SDK uses prompt-injected JSON mode
 * ({ type: 'json_object' }), which Groq fully supports.
 */
export function createGroqAiGatewayProvider(
  apiKey?: string,
  options?: { structuredOutputs?: boolean },
) {
  const key = apiKey && apiKey.trim().length > 0 ? apiKey : getAiApiKey();
  const groq = createOpenAICompatible({
    name: "groq",
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: key,
    supportsStructuredOutputs: false,
  });

  const flagshipModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const reasoningModel = process.env.GROQ_REASONING_MODEL || "deepseek-r1-distill-llama-70b";

  return (modelId: string) => {
    // If explicit Groq model ID is provided, use it directly
    if (
      modelId === "llama-3.3-70b-versatile" ||
      modelId === "deepseek-r1-distill-llama-70b" ||
      modelId === "qwen-2.5-coder-32b" ||
      modelId === "llama-3.1-8b-instant" ||
      modelId === "mixtral-8x7b-32768"
    ) {
      return groq(modelId);
    }

    // Map legacy or generic model requests to Groq's top 70B parameter models:
    let resolvedModel = flagshipModel;
    if (!options?.structuredOutputs && (modelId.includes("sol") || modelId.includes("reasoning"))) {
      resolvedModel = reasoningModel;
    }

    return groq(resolvedModel);
  };
}

export const createLovableAiGatewayProvider = createGroqAiGatewayProvider;

/**
 * Vision / document understanding (PDF, DOCX, images).
 */
export function getVisionApiKey(): string {
  return process.env.LOVABLE_API_KEY || getAiApiKey();
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
