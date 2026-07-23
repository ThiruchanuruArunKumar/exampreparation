import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

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
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key, { structuredOutputs: true });

    const system = `You extract exam questions from documents. Return every question you can identify with type, options (for MCQ/multi/tf), the correct answer(s) as an array of strings, marks (1 if not stated), topic (short subject/topic tag), and difficulty (easy/medium/hard). For true/false use type "tf" with options ["True","False"]. For short-answer use type "short" with options null and correct_answer as accepted answers.`;

    try {
      const { output } = await generateText({
        model: gateway("openai/gpt-5.5"),
        output: Output.object({ schema: ExtractedSchema }),
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: `Extract all questions from this file: ${data.fileName}` },
              data.mimeType.startsWith("image/")
                ? {
                    type: "image_url",
                    image_url: { url: `data:${data.mimeType};base64,${data.fileBase64}` },
                  }
                : {
                    type: "file",
                    file: {
                      filename: data.fileName,
                      file_data: `data:${data.mimeType};base64,${data.fileBase64}`,
                    },
                  },
            ] as never,
          },
        ] as never,
      });
      return output;
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
