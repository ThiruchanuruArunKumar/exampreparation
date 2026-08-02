import { generateText, Output } from "ai";
import { z } from "zod";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
const p = createOpenAICompatible({ name:"groq", baseURL:"https://api.groq.com/openai/v1", apiKey: process.env.GROQ_API_KEY!, supportsStructuredOutputs: true });
for (const m of ["llama-3.3-70b-versatile","openai/gpt-oss-120b"]) {
try {
const t0=Date.now();
const { output } = await generateText({ model: p(m), output: Output.object({ schema: z.object({ questions: z.array(z.object({ prompt: z.string(), options: z.array(z.string()) })) }) }), prompt: "Generate 2 NEET physics MCQs." });
console.log(m, Date.now()-t0+"ms", JSON.stringify(output).slice(0,200));
} catch(e:any){ console.log("ERR",m, e.message?.slice(0,300)); }
}
