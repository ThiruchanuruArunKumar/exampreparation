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

/* ---------------- Access code helpers ---------------- */

function randomAccessCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // exclude I,O,0,1
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

function randomStudentCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return (
    "STU-" +
    Array.from(bytes)
      .map((b) => alphabet[b % alphabet.length])
      .join("")
  );
}

/* ---------------- Exam create / settings ---------------- */

export const createExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().min(1).max(200),
        duration_minutes: z.number().int().min(1).max(600),
        questions: z.array(QuestionInput).min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Ensure unique access code (retry loop)
    let access_code = randomAccessCode();
    for (let i = 0; i < 5; i++) {
      const { data: exists } = await supabaseAdmin
        .from("exams")
        .select("id")
        .eq("access_code", access_code)
        .maybeSingle();
      if (!exists) break;
      access_code = randomAccessCode();
    }

    const total = data.questions.reduce((s, q) => s + q.marks, 0);
    const { data: exam, error } = await supabaseAdmin
      .from("exams")
      .insert({
        title: data.title,
        duration_minutes: data.duration_minutes,
        access_code,
        created_by: context.userId,
        total_marks: total,
      })
      .select("id, access_code")
      .single();
    if (error) throw error;

    const rows = data.questions.map((q, i) => ({
      exam_id: exam.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      correct_answer: q.correct_answer,
      marks: q.marks,
      topic: q.topic,
      difficulty: q.difficulty,
      order_index: i,
    }));
    const { error: qErr } = await supabaseAdmin.from("questions").insert(rows);
    if (qErr) throw qErr;

    return { id: exam.id, access_code: exam.access_code };
  });

export const regenerateExamCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ examId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let code = randomAccessCode();
    for (let i = 0; i < 5; i++) {
      const { data: exists } = await supabaseAdmin
        .from("exams")
        .select("id")
        .eq("access_code", code)
        .maybeSingle();
      if (!exists) break;
      code = randomAccessCode();
    }
    const { error } = await supabaseAdmin
      .from("exams")
      .update({ access_code: code })
      .eq("id", data.examId);
    if (error) throw error;
    return { access_code: code };
  });

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
        start_at: z.string().nullable(),
        end_at: z.string().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.start_at && data.end_at && new Date(data.start_at) >= new Date(data.end_at)) {
      throw new Error("Start time must be before end time");
    }
    const { error } = await context.supabase
      .from("exams")
      .update({
        title: data.title,
        description: data.description,
        duration_minutes: data.duration_minutes,
        shuffle_questions: data.shuffle_questions,
        shuffle_options: data.shuffle_options,
        start_at: data.start_at,
        end_at: data.end_at,
      })
      .eq("id", data.examId);
    if (error) throw error;
    return { ok: true };
  });


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
        .select("question_id, is_correct")
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
      context.supabase.from("students").select("*", { count: "exact", head: true }),
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

/* ---------------- Student management (no login) ---------------- */

export const listAllStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: students } = await context.supabase
      .from("students")
      .select("id, student_code, name, email, class_name, notes, created_at")
      .order("created_at", { ascending: false });
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
    return (students ?? []).map((s: any) => ({
      ...s,
      attemptCount: summary.get(s.id)?.count ?? 0,
      averagePercent: Math.round((summary.get(s.id)?.avg ?? 0) * 100),
    }));
  });

export const createStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        email: z.string().email().max(200).optional().or(z.literal("")),
        class_name: z.string().max(120).optional().or(z.literal("")),
        notes: z.string().max(1000).optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let code = randomStudentCode();
    for (let i = 0; i < 5; i++) {
      const { data: exists } = await supabaseAdmin
        .from("students")
        .select("id")
        .eq("student_code", code)
        .maybeSingle();
      if (!exists) break;
      code = randomStudentCode();
    }
    const { data: created, error } = await supabaseAdmin
      .from("students")
      .insert({
        student_code: code,
        name: data.name,
        email: data.email || null,
        class_name: data.class_name || null,
        notes: data.notes || null,
        created_by: context.userId,
      })
      .select("id, student_code")
      .single();
    if (error) throw error;
    return created;
  });

export const updateStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        email: z.string().email().max(200).optional().or(z.literal("")),
        class_name: z.string().max(120).optional().or(z.literal("")),
        notes: z.string().max(1000).optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("students")
      .update({
        name: data.name,
        email: data.email || null,
        class_name: data.class_name || null,
        notes: data.notes || null,
      })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteStudentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("students").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
