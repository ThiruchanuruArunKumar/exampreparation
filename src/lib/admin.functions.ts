import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const PatternEnum = z.enum(["neet", "eamcet", "mains", "custom"]);
const PatternConfigSchema = z
  .object({
    sections: z.array(
      z.object({
        name: z.string().min(1).max(80),
        count: z.number().int().min(0).max(500),
        marks_per_q: z.number().min(0).max(100),
      }),
    ),
    negative_mark_per_wrong: z.number().min(0).max(100),
    duration_minutes: z.number().int().min(1).max(600),
    notes: z.string().max(2000).optional().nullable(),
  })
  .nullable();

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  const { data: sd } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (!data && !sd) throw new Error("Forbidden");
}

/** Throws if the caller does not own the given exam (RLS-scoped read). */
async function assertOwnsExam(
  context: { supabase: any; userId: string },
  examId: string,
) {
  const { data } = await context.supabase
    .from("exams")
    .select("id")
    .eq("id", examId)
    .maybeSingle();
  if (!data) throw new Error("Forbidden: exam not found or not owned by you");
}


const QuestionInput = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(["mcq", "multi", "tf", "short"]),
  prompt: z.string().min(1),
  options: z.array(z.string()).nullable(),
  correct_answer: z.array(z.string()),
  marks: z.number().min(0).max(100),
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
  // 6 uppercase letters only — clear, easy to read/type.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, O
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

/* ---------------- Exam create / settings ---------------- */

export const createExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().min(1).max(200),
        duration_minutes: z.number().int().min(1).max(600),
        questions: z.array(QuestionInput).default([]),
        pattern: PatternEnum.default("custom"),
        pattern_config: PatternConfigSchema.optional(),
        negative_mark_per_wrong: z.number().min(0).max(100).default(0),
        show_result_after_submit: z.boolean().default(true),
        show_answer_sheet: z.boolean().default(false),
        show_answer_book: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
        pattern: data.pattern,
        pattern_config: data.pattern_config ?? null,
        negative_mark_per_wrong: data.negative_mark_per_wrong,
        show_result_after_submit: data.show_result_after_submit,
        show_answer_sheet: data.show_answer_sheet,
        show_answer_book: data.show_answer_book,
      })
      .select("id, access_code")
      .single();
    if (error) throw error;

    if (data.questions.length) {
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
    }

    return { id: exam.id, access_code: exam.access_code };
  });

export const regenerateExamCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ examId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await assertOwnsExam(context, data.examId);
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
        pattern: PatternEnum,
        pattern_config: PatternConfigSchema.optional(),
        negative_mark_per_wrong: z.number().min(0).max(100),
        show_result_after_submit: z.boolean().default(true),
        show_answer_sheet: z.boolean().default(false),
        show_answer_book: z.boolean().default(false),
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
        pattern: data.pattern,
        pattern_config: data.pattern_config ?? null,
        negative_mark_per_wrong: data.negative_mark_per_wrong,
        show_result_after_submit: data.show_result_after_submit,
        show_answer_sheet: data.show_answer_sheet,
        show_answer_book: data.show_answer_book,
      })
      .eq("id", data.examId);
    if (error) throw error;
    return { ok: true };
  });

/* ---------------- Detailed explanation (Answer Book) ---------------- */

export const getOrGenerateExplanation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ questionId: z.string().uuid(), regenerate: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.regenerate) {
      const { data: cached } = await supabaseAdmin
        .from("question_explanations")
        .select("explanation")
        .eq("question_id", data.questionId)
        .maybeSingle();
      if (cached?.explanation) return { explanation: cached.explanation as string, cached: true };
    }
    const { data: q } = await supabaseAdmin
      .from("questions")
      .select("prompt, options, correct_answer, type, topic")
      .eq("id", data.questionId)
      .single();
    if (!q) throw new Error("Question not found");
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("openai/gpt-5.5"),
      system:
        "You are an expert tutor. Explain the answer to competitive-exam questions with maximum clarity: state the correct answer, then a rigorous step-by-step derivation. List every formula used with names, define each variable, show all substitutions, and finish with an intuition summary. Use plain text and Markdown (no LaTeX renderer). Be thorough — the student wants to LEARN, not just check.",
      prompt: JSON.stringify(
        {
          topic: q.topic,
          question: q.prompt,
          options: q.options,
          correct_answer: q.correct_answer,
          type: q.type,
        },
        null,
        2,
      ),
    });
    await supabaseAdmin
      .from("question_explanations")
      .upsert(
        { question_id: data.questionId, explanation: text, updated_at: new Date().toISOString() },
        { onConflict: "question_id" },
      );
    return { explanation: text, cached: false };
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
    await assertOwnsExam(context, data.examId);
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

/* ---------------- Results (per-student history) ---------------- */

export const adminListStudentsWithStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: students } = await context.supabase
      .from("students")
      .select("id, student_code, name, email, class_name, created_at")
      .order("created_at", { ascending: false });
    const ids = (students ?? []).map((s: any) => s.id);
    if (!ids.length) return { students: [] };
    const { data: attempts } = await context.supabase
      .from("attempts")
      .select("student_id, status, score, max_score, submitted_at")
      .in("student_id", ids);
    const byStudent = new Map<string, any[]>();
    for (const a of attempts ?? []) {
      const arr = byStudent.get(a.student_id) ?? [];
      arr.push(a);
      byStudent.set(a.student_id, arr);
    }
    return {
      students: (students ?? []).map((s: any) => {
        const rows = byStudent.get(s.id) ?? [];
        const finished = rows.filter((r) => r.status !== "in_progress");
        const totalScore = finished.reduce((n, r) => n + Number(r.score ?? 0), 0);
        const totalMax = finished.reduce((n, r) => n + Number(r.max_score ?? 0), 0);
        const last = finished.reduce<string | null>(
          (acc, r) => (r.submitted_at && (!acc || r.submitted_at > acc) ? r.submitted_at : acc),
          null,
        );
        return {
          ...s,
          attempts_total: rows.length,
          attempts_finished: finished.length,
          average_percent: totalMax ? Math.round((totalScore / totalMax) * 100) : null,
          last_attempt_at: last,
        };
      }),
    };
  });

export const adminGetStudentHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ studentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: student } = await context.supabase
      .from("students")
      .select("id, student_code, name, email, class_name, notes, created_at")
      .eq("id", data.studentId)
      .maybeSingle();
    if (!student) throw new Error("Student not found");
    const { data: attempts } = await context.supabase
      .from("attempts")
      .select("id, exam_id, status, score, max_score, warning_count, started_at, submitted_at, auto_submitted")
      .eq("student_id", data.studentId)
      .order("started_at", { ascending: false });
    const examIds = Array.from(new Set((attempts ?? []).map((a: any) => a.exam_id)));
    const { data: exams } = examIds.length
      ? await context.supabase.from("exams").select("id, title, duration_minutes").in("id", examIds)
      : { data: [] };
    const examMap = new Map((exams ?? []).map((e: any) => [e.id, e]));
    const attemptIds = (attempts ?? []).map((a: any) => a.id);
    const { data: insights } = attemptIds.length
      ? await context.supabase.from("insights").select("attempt_id, summary, weak_topics, strong_topics").in("attempt_id", attemptIds)
      : { data: [] };
    const insMap = new Map((insights ?? []).map((i: any) => [i.attempt_id, i]));
    return {
      student,
      history: (attempts ?? []).map((a: any) => ({
        ...a,
        exam: examMap.get(a.exam_id) ?? null,
        insight: insMap.get(a.id) ?? null,
      })),
    };
  });

/* ---------------- AI question generation & append ---------------- */

const GenQuestionSchema = z.object({
  type: z.enum(["mcq", "multi", "tf", "short"]),
  prompt: z.string(),
  options: z.array(z.string()).nullable(),
  correct_answer: z.array(z.string()),
  marks: z.number().min(0).max(100),
  topic: z.string().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]),
});
const GenSchema = z.object({ questions: z.array(GenQuestionSchema) });

const PATTERN_GUIDE: Record<string, string> = {
  neet:
    "NEET UG (India) standard. Single-correct MCQs only (type=mcq) with exactly 4 options. NCERT Class 11 & 12 syllabus. Subjects: Physics, Chemistry, Botany, Zoology. Marks per question = 4. Difficulty balanced (easy/medium/hard). Style must match previous NEET question papers — conceptual, application-based, formula recall.",
  eamcet:
    "AP/TS EAMCET (Engineering) standard. Single-correct MCQs only (type=mcq) with exactly 4 options. Intermediate 1st & 2nd year syllabus. Subjects: Mathematics, Physics, Chemistry. Marks per question = 1, no negative marks. Style must match previous EAMCET question papers — direct and formula-based.",
  mains:
    "JEE Main (India) standard. Single-correct MCQs (type=mcq, 4 options) and numerical-value questions (type=short with numeric expected answer). CBSE Class 11 & 12 syllabus. Subjects: Physics, Chemistry, Mathematics. Marks per question = 4. Style must match previous JEE Main papers — conceptual + calculation heavy.",
  custom: "Follow the admin's brief exactly.",
};

async function runGenerate(prompt: string, userContent: any[]) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const gateway = createLovableAiGatewayProvider(key, { structuredOutputs: true });
  try {
    const { output } = await generateText({
      model: gateway("openai/gpt-5.5"),
      output: Output.object({ schema: GenSchema }),
      system: prompt,
      messages: [
        { role: "user", content: userContent as never },
      ] as never,
    });
    return output.questions;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error("AI could not produce structured questions. Try clearer input or fewer questions.");
    }
    throw error;
  }
}

async function runGenerateExact(prompt: string, userContent: any[], count: number) {
  const qs = await runGenerate(prompt, userContent);
  return qs.slice(0, count);
}



function baseGenPrompt(pattern: string, count: number, subject?: string | null) {
  const guide = PATTERN_GUIDE[pattern] ?? PATTERN_GUIDE.custom;
  return `You are an expert exam question setter. ${guide}
Generate exactly ${count} high-quality questions${subject ? ` on subject/topic: ${subject}` : ""}.
Return JSON matching the schema. For MCQ use type "mcq" with 4 options and one correct answer in correct_answer array. For true/false use "tf" with options ["True","False"]. For numerical/short use "short" with options null and correct_answer as accepted answers. Set topic to the subject or sub-topic. Set difficulty (easy/medium/hard) mixed. Do not repeat questions.

FORMATTING (CRITICAL — questions render with Markdown + KaTeX):
- Wrap ALL math, chemistry, physics formulas in LaTeX: inline as $...$ and display as $$...$$. Never use unicode fake-math like x² or H₂O plain text.
- Powers/subscripts: $x^2$, $a_{ij}$, $H_2O$, $CO_2$, $10^{-3}$.
- Fractions/roots: $\\frac{a}{b}$, $\\sqrt{x}$, $\\sqrt[3]{x}$.
- Greek/symbols: $\\alpha, \\beta, \\pi, \\theta, \\Delta, \\rightarrow, \\leq, \\geq, \\neq, \\pm, \\times, \\cdot, \\infty$.
- Vectors/units: $\\vec{F} = m\\vec{a}$, $9.8\\,\\text{m/s}^2$.
- Chemistry: use $\\ce{...}$ style where possible, e.g. $\\ce{H2SO4 -> H+ + HSO4-}$, or plain LaTeX like $H_2SO_4 \\rightarrow 2H^+ + SO_4^{2-}$.
- Preserve line breaks in the prompt using \\n. Options must be pure text of the choice (no "A)"/"B)" prefixes) and may contain LaTeX the same way.
- Do NOT wrap the whole question in a code block. Do NOT escape backslashes twice.`;

}

export const generateFromNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pattern: PatternEnum,
        count: z.number().int().min(1).max(60),
        subject: z.string().max(120).nullable().optional(),
        fileBase64: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sys =
      baseGenPrompt(data.pattern, data.count, data.subject) +
      `\n\nBase the questions strictly on the notes/material in the attached file (${data.fileName}). Cross-reference with the style, difficulty, and pattern of PAST ${data.pattern.toUpperCase()} papers on these topics. Do not invent facts outside the notes.`;
    const part =
      data.mimeType.startsWith("image/")
        ? { type: "image_url", image_url: { url: `data:${data.mimeType};base64,${data.fileBase64}` } }
        : {
            type: "file",
            file: {
              filename: data.fileName,
              file_data: `data:${data.mimeType};base64,${data.fileBase64}`,
            },
          };
    const questions = await runGenerate(sys, [
      { type: "text", text: `Generate ${data.count} questions from these notes.` },
      part,
    ]);
    return { questions };
  });

export const generateFromDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pattern: PatternEnum,
        count: z.number().int().min(1).max(60),
        subject: z.string().max(120).nullable().optional(),
        description: z.string().min(3).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sys = baseGenPrompt(data.pattern, data.count, data.subject);
    const questions = await runGenerate(sys, [
      { type: "text", text: `Exam brief / topics from admin:\n${data.description}` },
    ]);
    return { questions };
  });

export const appendQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ examId: z.string().uuid(), questions: z.array(QuestionInput).min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await assertOwnsExam(context, data.examId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("questions")
      .select("order_index")
      .eq("exam_id", data.examId)
      .order("order_index", { ascending: false })
      .limit(1);
    const start = (existing?.[0]?.order_index ?? -1) + 1;
    const rows = data.questions.map((q, i) => ({
      exam_id: data.examId,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      correct_answer: q.correct_answer,
      marks: q.marks,
      topic: q.topic,
      difficulty: q.difficulty,
      order_index: start + i,
    }));
    const { error } = await supabaseAdmin.from("questions").insert(rows);
    if (error) throw error;
    const { data: totals } = await supabaseAdmin
      .from("questions")
      .select("marks")
      .eq("exam_id", data.examId);
    const total = (totals ?? []).reduce((s, r) => s + (r.marks ?? 0), 0);
    await supabaseAdmin.from("exams").update({ total_marks: total }).eq("id", data.examId);
    return { added: rows.length };
  });

