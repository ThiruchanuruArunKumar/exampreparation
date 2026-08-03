import { createGroq } from "@ai-sdk/groq";
import fs from "fs";
import path from "path";

let cachedEnvKey: string | null = null;

/** Groq API key powers all text and vision generation. */
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

/** Groq text generation with native structured-output support. */
export function createGroqAiGatewayProvider(
  apiKey?: string,
  _options?: { structuredOutputs?: boolean },
) {
  const key = apiKey && apiKey.trim().length > 0 ? apiKey : getAiApiKey();
  const groq = createGroq({
    apiKey: key,
  });

  return (modelId: string) => {
    const resolvedModel = modelId.startsWith("openai/gpt-oss-")
      ? modelId
      : process.env.GROQ_MODEL || "openai/gpt-oss-20b";
    return groq(resolvedModel);
  };
}

export const createLovableAiGatewayProvider = createGroqAiGatewayProvider;

/**
 * All vision & document understanding operations route to Groq API ONLY.
 */
export function getVisionApiKey(): string {
  return getAiApiKey();
}

export function createVisionProvider(apiKey?: string) {
  const key = apiKey && apiKey.trim().length > 0 ? apiKey : getAiApiKey();
  const groq = createGroqAiGatewayProvider(key);
  return (modelId: string) => groq(modelId || "llama-3.3-70b-versatile");
}
