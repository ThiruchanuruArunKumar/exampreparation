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
  name: "get_attempt_insights",
  title: "Get AI insights for an attempt",
  description:
    "Return the AI-generated performance insights (weak/strong topics, recommendations) and per-answer breakdown for one completed attempt.",
  inputSchema: { attempt_id: z.string().uuid() },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ attempt_id }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = sb(ctx);
    const [{ data: attempt }, { data: insight }, { data: answers }] = await Promise.all([
      supabase
        .from("attempts")
        .select("id, status, score, max_score, submitted_at, exam:exams(id, title)")
        .eq("id", attempt_id)
        .maybeSingle(),
      supabase.from("insights").select("*").eq("attempt_id", attempt_id).maybeSingle(),
      supabase.from("answers").select("*").eq("attempt_id", attempt_id),
    ]);
    if (!attempt)
      return { content: [{ type: "text", text: "Attempt not found or access denied" }], isError: true };
    const payload = { attempt, insight, answers: answers ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
