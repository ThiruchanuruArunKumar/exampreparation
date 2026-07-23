import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_exam",
  title: "Get exam",
  description:
    "Fetch exam metadata and its questions. Admin owners see full question data (including correct answers). Students only see it if assigned; correct answers are stripped.",
  inputSchema: { exam_id: z.string().uuid().describe("Exam UUID") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ exam_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = sb(ctx);
    const { data: exam, error } = await supabase
      .from("exams")
      .select("*, questions(*)")
      .eq("id", exam_id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!exam) return { content: [{ type: "text", text: "Exam not found or access denied" }], isError: true };

    const isOwner = exam.owner_id === ctx.getUserId();
    if (!isOwner && Array.isArray(exam.questions)) {
      exam.questions = exam.questions.map((q: Record<string, unknown>) => {
        const { correct_answer: _c, ...rest } = q;
        return rest;
      });
    }
    return {
      content: [{ type: "text", text: JSON.stringify(exam, null, 2) }],
      structuredContent: { exam },
    };
  },
});
