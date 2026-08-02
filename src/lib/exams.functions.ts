import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, getAiApiKey, createVisionProvider, getVisionApiKey } from "./ai-gateway.server";
import { repairQuestionLatex } from "./latex-repair";


const QuestionSchema = z.object({
  type: z.enum(["mcq", "multi", "tf", "short"]),
  prompt: z.string(),
  options: z.array(z.string()).nullable(),
  correct_answer: z.array(z.string()),
  marks: z.number().int().min(1).max(20),
  topic: z.string().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

const ExtractedSchema = z.object({
  title: z.string(),
  questions: z.array(QuestionSchema),
});

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

export const extractQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        fileBase64: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const key = getAiApiKey();
    if (!key) throw new Error("Missing AI API key");
    const gateway = createLovableAiGatewayProvider(key, { structuredOutputs: true });

    const system = `You extract exam questions from documents. Return every question you can identify with type, options (for MCQ/multi/tf), the correct answer(s) as an array of strings, marks (1 if not stated), topic (short subject/topic tag), and difficulty (easy/medium/hard). For true/false use type "tf" with options ["True","False"]. For short-answer use type "short" with options null and correct_answer as accepted answers.

LANGUAGE (CRITICAL): Every question prompt, every option, and every correct_answer MUST be written in ENGLISH only. If the source contains Telugu, Hindi, or any other non-English text, translate it into clear, natural English before returning. Never emit non-English script (no Telugu, Devanagari, or other native scripts) in any field.

FORMATTING (CRITICAL — output renders with Markdown + KaTeX + mhchem):
- Default to plain English text. Use LaTeX ONLY for real formulas, symbols and chemical species — never for ordinary words.
- Every LaTeX fragment gets its own matching $...$ pair. Never leave an unmatched $, and never wrap a sentence in math.
- Chemistry uses mhchem inside math: $\\ce{H2SO4}$, $\\ce{SO4^2-}$, $\\ce{2SO2(g) + O2(g) <=> 2SO3(g)}$. Never bare \\ce{...}, never \\mathrm{...} around a reaction, never a stray \\sigma / \\pi / \\rightarrow in prose.
- Options are pure choice text with no "A)"/"B)" prefixes.

SELF-VERIFICATION (MANDATORY): Re-read every prompt, option and correct_answer before returning. Fix unbalanced $, bare macros, unbalanced chemical equations, duplicated or truncated text, and make sure correct_answer is the verbatim full text of one option.`;


    const isImage = data.mimeType.startsWith("image/");
    const isText =
      data.mimeType.startsWith("text/") ||
      data.mimeType === "application/json" ||
      /\.(md|markdown|txt|csv|json)$/i.test(data.fileName);
    const filePart = isImage
      ? {
          type: "image" as const,
          image: `data:${data.mimeType};base64,${data.fileBase64}`,
          mediaType: data.mimeType,
        }
      : isText
        ? {
            type: "text" as const,
            text: `--- FILE: ${data.fileName} ---\n${Buffer.from(data.fileBase64, "base64").toString("utf-8").slice(0, 200_000)}\n--- END FILE ---`,
          }
        : {
            type: "file" as const,
            data: `data:${data.mimeType};base64,${data.fileBase64}`,
            mediaType: data.mimeType || "application/octet-stream",
            filename: data.fileName,
          };

    try {
      const { output } = await generateText({
        model: gateway("openai/gpt-5.4-mini"),
        providerOptions: { lovable: { service_tier: "priority" } },
        output: Output.object({ schema: ExtractedSchema }),
        instructions: system,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `Extract all questions from this file: ${data.fileName}. Output in ENGLISH only — translate if the source is not English.` },
              filePart,
            ] as any,
          },
        ],
      });
      return {
        ...output,
        questions: output.questions.map((q) => repairQuestionLatex(q)),
      };

    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error(
          "AI could not extract structured questions from this file. Try a clearer file.",
        );
      }
      throw error;
    }
  });

export const listStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase
      .from("students")
      .select("id, student_code, name, email, class_name")
      .order("created_at", { ascending: false });
    return data ?? [];
  });
