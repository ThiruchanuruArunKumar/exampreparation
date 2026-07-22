import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden");
}

const QuestionInput = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(["mcq", "multi", "tf", "short"]),
  prompt: z.string().min(1),
  options: z.array(z.string()).nullable(),
  correct_answer: z.array(z.string()),
  marks: z.number().int().min(1).max(100),
  topic: z.string().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

/* ---------------- Exam settings ---------------- */

export const updateExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        examId: z.string().uuid(),
        title: z.string().min(1).max(200),
        description: z.string().max(2000).nullable(),
        duration_minutes: z.number().int().min(1).max(600),
        shuffle_questions: z.boolean(),
        shuffle_options: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("exams")
      .update({
        title: data.title,
        description: data.description,
        duration_minutes: data.duration_minutes,
        shuffle_questions: data.shuffle_questions,
        shuffle_options: data.shuffle_options,
      })
      .eq("id", data.examId);
    if (error) throw error;
    return { ok: true };
  });

/* ---------------- Question editor ---------------- */

export const saveQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        examId: z.string().uuid(),
        questions: z.array(QuestionInput),
        deletedIds: z.array(z.string().uuid()).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.deletedIds.length) {
      await supabaseAdmin.from("questions").delete().in("id", data.deletedIds);
    }

    const rows = data.questions.map((q, i) => ({
      id: q.id,
      exam_id: data.examId,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      correct_answer: q.correct_answer,
      marks: q.marks,
      topic: q.topic,
      difficulty: q.difficulty,
      order_index: i,
    }));

    if (rows.length) {
      const { error } = await supabaseAdmin.from("questions").upsert(rows, { onConflict: "id" });
      if (error) throw error;
    }

    const total = data.questions.reduce((s, q) => s + q.marks, 0);
    await supabaseAdmin.from("exams").update({ total_marks: total }).eq("id", data.examId);

    return { ok: true };
  });

/* ---------------- Bulk assign ---------------- */

export const bulkAssign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        examId: z.string().uuid(),
        studentIds: z.array(z.string().uuid()).min(1),
        due_at: z.string().nullable(),
        max_attempts: z.number().int().min(1).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const rows = data.studentIds.map((sid) => ({
      exam_id: data.examId,
      student_id: sid,
      assigned_by: context.userId,
      due_at: data.due_at,
      max_attempts: data.max_attempts,
    }));
    const { error, data: inserted } = await context.supabase
      .from("assignments")
      .upsert(rows, { onConflict: "exam_id,student_id", ignoreDuplicates: false })
      .select("id");
    if (error) throw error;
    return { assigned: inserted?.length ?? 0 };
  });

/* ---------------- Analytics ---------------- */

export const getExamAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ examId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: attempts } = await context.supabase
      .from("attempts")
      .select("id, student_id, status, score, max_score, submitted_at, warning_count")
      .eq("exam_id", data.examId)
      .neq("status", "in_progress");

    const { data: questions } = await context.supabase
      .from("questions")
      .select("id, topic, marks")
      .eq("exam_id", data.examId);

    const attemptIds = (attempts ?? []).map((a: any) => a.id);
    let topicStats: Record<string, { correct: number; total: number }> = {};
    if (attemptIds.length) {
      const { data: answers } = await context.supabase
        .from("answers")
        .select("question_id, is_correct, marks_awarded")
        .in("attempt_id", attemptIds);
      const qTopic = new Map((questions ?? []).map((q: any) => [q.id, q.topic || "General"]));
      for (const a of answers ?? []) {
        const t = qTopic.get(a.question_id) ?? "General";
        const s = topicStats[t] ?? { correct: 0, total: 0 };
        s.total += 1;
        if (a.is_correct) s.correct += 1;
        topicStats[t] = s;
      }
    }

    const scores = (attempts ?? []).map((a: any) => Number(a.score ?? 0));
    const maxScores = (attempts ?? []).map((a: any) => Number(a.max_score ?? 0));
    const totalMax = maxScores[0] ?? 0;
    const avg = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
    const pass = scores.filter((s, i) => maxScores[i] > 0 && s / maxScores[i] >= 0.5).length;

    return {
      totalAttempts: attempts?.length ?? 0,
      averageScore: Math.round(avg * 100) / 100,
      totalMarks: totalMax,
      passRate: scores.length ? Math.round((pass / scores.length) * 100) : 0,
      topics: Object.entries(topicStats).map(([topic, s]) => ({
        topic,
        accuracy: s.total ? Math.round((s.correct / s.total) * 100) : 0,
        total: s.total,
      })),
      attempts: attempts ?? [],
    };
  });

export const getGlobalAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [{ count: examCount }, { count: studentCount }, { data: attempts }] = await Promise.all([
      context.supabase.from("exams").select("*", { count: "exact", head: true }),
      context.supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "student"),
      context.supabase
        .from("attempts")
        .select("id, exam_id, score, max_score, status, submitted_at")
        .neq("status", "in_progress"),
    ]);
    const scores = (attempts ?? []).map((a: any) => Number(a.score ?? 0));
    const maxes = (attempts ?? []).map((a: any) => Number(a.max_score ?? 0));
    const avgPct = scores.length
      ? Math.round(
          (scores.reduce((s, v, i) => s + (maxes[i] ? v / maxes[i] : 0), 0) / scores.length) * 100,
        )
      : 0;
    return {
      examCount: examCount ?? 0,
      studentCount: studentCount ?? 0,
      attemptCount: attempts?.length ?? 0,
      averagePercent: avgPct,
      recent: (attempts ?? []).slice(-10).reverse(),
    };
  });

/* ---------------- Student management ---------------- */

export const listAllStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("user_id, role");
    const ids = (roles ?? []).map((r: any) => r.user_id);
    if (!ids.length) return [];
    const { data: profs } = await context.supabase
      .from("profiles")
      .select("id, email, full_name, created_at")
      .in("id", ids);

    // attempts summary per student
    const { data: attempts } = await context.supabase
      .from("attempts")
      .select("student_id, score, max_score, status")
      .neq("status", "in_progress");
    const summary = new Map<string, { count: number; avg: number }>();
    for (const a of attempts ?? []) {
      const s = summary.get(a.student_id) ?? { count: 0, avg: 0 };
      const pct = a.max_score ? Number(a.score) / Number(a.max_score) : 0;
      s.avg = (s.avg * s.count + pct) / (s.count + 1);
      s.count += 1;
      summary.set(a.student_id, s);
    }

    const roleMap = new Map((roles ?? []).map((r: any) => [r.user_id, r.role]));
    return (profs ?? []).map((p: any) => ({
      ...p,
      role: roleMap.get(p.id) ?? "student",
      attemptCount: summary.get(p.id)?.count ?? 0,
      averagePercent: Math.round((summary.get(p.id)?.avg ?? 0) * 100),
    }));
  });

export const inviteStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        email: z.string().email(),
        fullName: z.string().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.fullName ?? data.email.split("@")[0] },
    });
    if (error) throw new Error(error.message);
    return { ok: true, userId: invited.user?.id };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "student"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && data.role !== "admin") {
      throw new Error("You cannot demote yourself");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) throw error;
    return { ok: true };
  });

export const deleteStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot delete yourself");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
