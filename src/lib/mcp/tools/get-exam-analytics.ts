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
  name: "get_exam_analytics",
  title: "Get exam analytics (admin)",
  description:
    "Admin-only: summary analytics for one exam — attempt count, average score, and per-student results. RLS restricts to exams owned by the caller.",
  inputSchema: { exam_id: z.string().uuid() },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ exam_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = sb(ctx);
    const { data: exam } = await supabase
      .from("exams")
      .select("id, title, owner_id")
      .eq("id", exam_id)
      .maybeSingle();
    if (!exam || exam.owner_id !== ctx.getUserId())
      return { content: [{ type: "text", text: "Exam not found or not owned by you" }], isError: true };

    const { data: attempts } = await supabase
      .from("attempts")
      .select("id, status, score, max_score, submitted_at, student:profiles(id, email, full_name)")
      .eq("exam_id", exam_id);

    const completed = (attempts ?? []).filter((a) => a.status === "submitted");
    const avg =
      completed.length > 0
        ? completed.reduce(
            (s, a) => s + ((a.score ?? 0) / Math.max(a.max_score ?? 1, 1)) * 100,
            0,
          ) / completed.length
        : 0;
    const payload = {
      exam,
      total_attempts: attempts?.length ?? 0,
      completed: completed.length,
      average_percent: Math.round(avg * 10) / 10,
      attempts: attempts ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
