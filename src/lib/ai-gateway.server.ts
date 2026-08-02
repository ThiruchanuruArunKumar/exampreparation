import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function getAiApiKey(): string {
  return process.env.GROQ_API_KEY || process.env.LOVABLE_API_KEY || "";
}

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
    // If modelId is a specific Groq model (doesn't start with legacy prefixes like openai/ or gpt-), use it directly
    if (modelId && !modelId.startsWith("openai/") && !modelId.startsWith("gpt-") && !modelId.includes("lovable")) {
      return groq(modelId);
    }

    // Map legacy / generic requests to Groq's top 70B parameter models:
    let resolvedModel = flagshipModel;
    if (!options?.structuredOutputs && (modelId.includes("sol") || modelId.includes("reasoning"))) {
      resolvedModel = reasoningModel;
    }

    return groq(resolvedModel);
  };
}

export const createLovableAiGatewayProvider = createGroqAiGatewayProvider;
