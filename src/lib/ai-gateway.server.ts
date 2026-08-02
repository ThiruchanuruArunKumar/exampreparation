import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/** Groq key powers all text generation. */
export function getAiApiKey(): string {
  return process.env.GROQ_API_KEY || process.env.LOVABLE_API_KEY || "";
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
