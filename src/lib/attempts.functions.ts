import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const reassignAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ assignmentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Preserve prior attempt history — grant a new attempt by bumping max_attempts
    // above the count of finished attempts, and clear any stuck in-progress row.
    const { data: asg } = await supabaseAdmin
      .from("assignments")
      .select("id, max_attempts")
      .eq("id", data.assignmentId)
      .single();
    if (!asg) throw new Error("Assignment not found");

    const { data: attempts } = await supabaseAdmin
      .from("attempts")
      .select("id, status")
      .eq("assignment_id", data.assignmentId);
    const finished = (attempts ?? []).filter((a) => a.status !== "in_progress").length;
    const inProgress = (attempts ?? []).filter((a) => a.status === "in_progress");

    // Discard only unfinished (in-progress) sessions; keep every submitted attempt.
    if (inProgress.length) {
      await supabaseAdmin
        .from("attempts")
        .delete()
        .in("id", inProgress.map((a) => a.id));
    }

    const newMax = Math.max((asg.max_attempts ?? 1), finished + 1);
    await supabaseAdmin
      .from("assignments")
      .update({ max_attempts: newMax })
      .eq("id", data.assignmentId);

    return { ok: true };
  });
