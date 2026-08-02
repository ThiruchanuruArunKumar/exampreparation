import { generateText, Output } from "ai";
import { z } from "zod";
import { createGroqAiGatewayProvider } from "../src/lib/ai-gateway.server";
const g = createGroqAiGatewayProvider(process.env.GROQ_API_KEY, { structuredOutputs: true });
try {
const { output } = await generateText({
  model: g("openai/gpt-5.4-mini"),
  providerOptions: { lovable: { service_tier: "priority" } },
  output: Output.object({ schema: z.object({ questions: z.array(z.object({ prompt: z.string(), options: z.array(z.string()) })) }) }),
  prompt: "Generate 2 NEET physics MCQs.",
});
console.log(JSON.stringify(output).slice(0,400));
} catch(e:any){ console.log("ERR", e.message, JSON.stringify(e.responseBody||e.cause||"").slice(0,500)); }
