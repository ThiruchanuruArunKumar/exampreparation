import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_my_exams",
  title: "List my exams",
  description:
    "For admins: list exams you own. For students: list exams assigned to you with due dates and attempt limits.",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = sb(ctx);
    const userId = ctx.getUserId();

    const [{ data: owned }, { data: assigned }] = await Promise.all([
      supabase
        .from("exams")
        .select("id, title, duration_minutes, created_at")
        .eq("owner_id", userId!),
      supabase
        .from("assignments")
        .select("id, due_at, max_attempts, exam:exams(id, title, duration_minutes)")
        .eq("student_id", userId!),
    ]);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ owned: owned ?? [], assigned: assigned ?? [] }, null, 2),
        },
      ],
      structuredContent: { owned: owned ?? [], assigned: assigned ?? [] },
    };
  },
});
