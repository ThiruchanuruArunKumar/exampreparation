import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider, getAiApiKey, createVisionProvider, getVisionApiKey } from "./ai-gateway.server";
import { repairLatex } from "./latex-repair";
import { stripNullBytes } from "./utils";


const PatternEnum = z.enum(["neet", "eamcet", "ts_eamcet_bipc", "mains", "custom", "ipe"]);
/**
 * Pattern config differs per exam family (MCQ patterns vs IPE descriptive papers),
 * so validate loosely and keep any extra keys the creator stored.
 */
const PatternConfigSchema = z
  .object({
    sections: z
      .array(
        z
          .object({
            name: z.string().min(1).max(120),
            count: z.number().int().min(0).max(500),
            marks_per_q: z.number().min(0).max(100),
          })
          .loose(),
      )
      .optional(),
    negative_mark_per_wrong: z.number().min(0).max(100).optional(),
    duration_minutes: z.number().int().min(1).max(600).optional(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .loose()
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
  difficulty: z.enum(["easy", "medium", "hard", "extreme"]),
  source_ref: z.string().nullable().optional(),
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
  .handler(async ({ data: rawData, context }) => {
    const data = stripNullBytes(rawData);
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

    const total = data.questions.reduce((s: number, q: any) => s + q.marks, 0);
    const { data: exam, error } = await supabaseAdmin
      .from("exams")
      .insert({
        title: data.title,
        duration_minutes: data.duration_minutes,
        access_code,
        created_by: context.userId,
        total_marks: total,
        pattern: data.pattern,
        pattern_config: (data.pattern_config ?? null) as any,
        negative_mark_per_wrong: data.negative_mark_per_wrong,
        show_result_after_submit: data.show_result_after_submit,
        show_answer_sheet: data.show_answer_sheet,
        show_answer_book: data.show_answer_book,
      })
      .select("id, access_code")
      .single();
    if (error) throw error;

    if (data.questions.length) {
      const rows = data.questions.map((q: any, i: number) => ({
        exam_id: exam.id,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        correct_answer: q.correct_answer,
        marks: q.marks,
        topic: q.topic,
        difficulty: q.difficulty,
        source_ref: q.source_ref ?? null,
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
        pattern_config: (data.pattern_config ?? null) as any,
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
    const key = getAiApiKey();
    if (!key) throw new Error("AI not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("openai/gpt-5.4-mini"),
      providerOptions: { lovable: { service_tier: "priority" } },
      instructions:
        "You are an expert tutor writing an Answer Book entry for a competitive-exam question, in the clean, well-organized style of ChatGPT. Structure the reply EXACTLY as Markdown with these sections in this order, using these exact headings:\n\n### Correct answer\nOne line only. State the correct option verbatim in **bold**. Do NOT repeat it.\n\n### Why it is correct\n2-4 short sentences of plain-language reasoning. No formulas here.\n\n### Step-by-step solution\nA numbered Markdown list (1., 2., 3., ...). Each step = ONE idea, ONE sentence + at most ONE formula on its own display line. For each formula: name it, define every variable, then show the substitution. Use $$...$$ on its own line for any formula that stands alone.\n\n### Why the other options are wrong\nA Markdown bullet list (\"- \"). One short bullet per wrong option, starting with the option text in **bold**.\n\n### Key takeaway\nOne single line the student should memorize.\n\nSTRICT FORMATTING RULES — the output renders with Markdown + KaTeX + mhchem:\n- Use ONLY $...$ for inline math and $$...$$ for display math. NEVER use \\( \\), \\[ \\], plain parentheses, or plain brackets around LaTeX.\n- Every \\ce{...}, \\frac{...}{...}, \\sqrt{...}, ^, _ MUST be inside $...$ or $$...$$. Never write bare \\ce{AgCl} — write $\\ce{AgCl}$.\n- Chemistry example: $\\ce{H2SO4 -> 2H+ + SO4^{2-}}$. Powers/subs: $x^2$, $H_2O$, $10^{-3}$. Units: $9.8\\,\\text{m/s}^2$.\n- No emojis, no ASCII art, no horizontal rules, no walls of text, no preamble like \"Sure!\" or \"Let us solve this\". Get straight to the answer.",
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
  .handler(async ({ data: rawData, context }) => {
    const data = stripNullBytes(rawData);
    await assertAdmin(context);
    await assertOwnsExam(context, data.examId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.deletedIds.length) {
      await supabaseAdmin.from("questions").delete().in("id", data.deletedIds);
    }
    const rows = data.questions.map((q: any, i: number) => ({
      id: q.id,
      exam_id: data.examId,
      type: q.type,
      prompt: q.prompt,
      options: q.options,
      correct_answer: q.correct_answer,
      marks: q.marks,
      topic: q.topic,
      difficulty: q.difficulty,
      source_ref: q.source_ref ?? null,
      order_index: i,


    }));
    if (rows.length) {
      const { error } = await supabaseAdmin.from("questions").upsert(rows, { onConflict: "id" });
      if (error) throw error;
    }
    const total = data.questions.reduce((s: number, q: any) => s + q.marks, 0);
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

export const GenModeEnum = z.enum(["ai", "pyq"]);
export const ToughnessEnum = z.enum(["easy", "medium", "hard", "extreme"]);

const GenQuestionSchema = z.object({
  type: z.enum(["mcq", "multi", "tf", "short"]),
  prompt: z.string(),
  options: z.array(z.string()).nullable(),
  correct_answer: z.array(z.string()),
  marks: z.number().min(0).max(100),
  topic: z.string().nullable(),
  difficulty: z.enum(["easy", "medium", "hard", "extreme"]),
  source_ref: z.string().nullable(),
});
const GenSchema = z.object({ questions: z.array(GenQuestionSchema) });

type GenQuestion = z.infer<typeof GenQuestionSchema>;

function fixMatchOptionsInQuestion(q: GenQuestion): GenQuestion {
  if (!q.options || q.options.length === 0) return q;

  // Detect if any option string contains multi-line list items (A., B., C. or I., II., III.)
  const misplacedListIdx = q.options.findIndex(
    (opt) =>
      /^(?:\(?\s*[A-Da-d1-4I-IVi-iv]\s*[\.\):]|\b[A-Da-d]\b)/m.test(opt) && opt.includes("\n")
  );

  if (misplacedListIdx !== -1) {
    const misplacedText = q.options[misplacedListIdx];

    let updatedPrompt = q.prompt.trim();
    if (!/List[\s\-–—]*II|Column[\s\-–—]*II/i.test(updatedPrompt)) {
      const relabeledLines = misplacedText
        .split("\n")
        .map((line, idx) => {
          const roman = ["I", "II", "III", "IV"][idx] ?? `${idx + 1}`;
          return line.replace(/^(?:\(?\s*[A-Da-d1-4I-IVi-iv]\s*[\.\):]|\b[A-Da-d]\b[\.\):]?)\s*/, `${roman}. `);
        })
        .join("\n");
      updatedPrompt += `\n\nList-II:\n${relabeledLines}`;
    }

    const validPairings = q.options.filter(
      (opt, idx) => idx !== misplacedListIdx && opt.trim().length > 0 && !opt.includes("\n")
    );

    const defaultPairings = [
      "A-I, B-II, C-III, D-IV",
      "A-II, B-I, C-IV, D-III",
      "A-III, B-IV, C-I, D-II",
      "A-IV, B-III, C-II, D-I",
    ];

    while (validPairings.length < 4) {
      const fallback = defaultPairings[validPairings.length];
      if (!validPairings.includes(fallback)) validPairings.push(fallback);
    }

    const newOptions = validPairings.slice(0, 4);
    const newCorrect = q.correct_answer.map((c) =>
      c === misplacedText ? newOptions[0] : c
    );

    return {
      ...q,
      prompt: updatedPrompt,
      options: newOptions,
      correct_answer: newCorrect.length ? newCorrect : [newOptions[0]],
    };
  }

  return q;
}

function normalizeOptionMath(opt: string): string {
  if (!opt) return opt;
  let s = opt.trim().replace(/^\(?\s*[A-Da-d1-4]\s*[\).:]\s+/, "").replace(/\\\\/g, "\\");
  return repairLatex(s);
}


function resolveCorrectAnswer(options: string[] | null, rawCorrect: string[]): string[] {
  if (!options || !options.length) return rawCorrect;
  const clean = (str: string) =>
    str
      .trim()
      .replace(/\\\\/g, "\\")
      .replace(/\\ce\{([^{}]+)\}/g, "$1")
      .replace(/\\ce\s*([A-Za-z0-9_+\-^\(\)]+)/g, "$1")
      .replace(/\\text\{([^{}]+)\}/g, "$1")
      .replace(/[\$\`\\\{\}\(\)\<\>]/g, "")
      .replace(/\s+/g, "")
      .toLowerCase();

  const resolved: string[] = [];
  for (const ans of rawCorrect) {
    const aStr = ans.trim();
    const directIdx = options.findIndex((o) => clean(o) === clean(aStr));
    if (directIdx !== -1) {
      resolved.push(options[directIdx]);
      continue;
    }
    const letterMatch = aStr.match(/^(?:Option\s*)?\(?\s*([A-D1-4])\s*[\)\.]?$/i);
    if (letterMatch) {
      const char = letterMatch[1].toUpperCase();
      let idx = -1;
      if (["A", "B", "C", "D"].includes(char)) idx = ["A", "B", "C", "D"].indexOf(char);
      else if (["1", "2", "3", "4"].includes(char)) idx = parseInt(char, 10) - 1;

      if (idx >= 0 && idx < options.length) {
        resolved.push(options[idx]);
        continue;
      }
    }
  }

  if (!resolved.length && options.length > 0) {
    resolved.push(options[0]);
  }
  return Array.from(new Set(resolved));
}

// Force the admin-chosen toughness onto every question, fix misplaced options,
// auto-wrap LaTeX math in options, resolve correct_answer string matching,
// and make sure PYQ questions always carry a year/shift reference.
function normalizeGenerated(questions: GenQuestion[], genMode: string, toughness: string) {
  return questions.map((rawQ) => {
    const fixedQ = fixMatchOptionsInQuestion(rawQ);
    const normalizedPrompt = repairLatex(fixedQ.prompt);
    const normalizedOptions = fixedQ.options ? fixedQ.options.map(normalizeOptionMath) : null;
    const normalizedCorrect = fixedQ.type !== "short"
      ? resolveCorrectAnswer(normalizedOptions, fixedQ.correct_answer.map((a) => repairLatex(a)))
      : fixedQ.correct_answer;

    return {
      ...fixedQ,
      prompt: normalizedPrompt,

      options: normalizedOptions,
      correct_answer: normalizedCorrect,
      difficulty: toughness as GenQuestion["difficulty"],
      source_ref:
        fixedQ.source_ref?.trim() ||
        (genMode === "pyq" || toughness === "extreme" ? "Previous year (year/shift not identified)" : null),
    };
  });
}


// Real-exam question-format mix. All output remains type "mcq" (4 options) or
// "short" (numerical) — assertion/statement/match-the-list are STRUCTURED prompts
// inside an mcq, not new question types.
const PATTERN_FORMAT_MIX = `
QUESTION FORMAT MIX (must match real exam papers):
Produce a realistic mix of these formats. Every "structured" format below is
still type="mcq" with exactly 4 options — the STRUCTURE lives inside the prompt.

1) Direct single-correct MCQ — a plain conceptual/numerical MCQ with 4 options.
2) Assertion & Reason — prompt contains two lines:
      "Assertion (A): <statement>."
      "Reason (R): <statement>."
   Options are EXACTLY (in this order, verbatim):
      "Both A and R are true and R is the correct explanation of A"
      "Both A and R are true but R is not the correct explanation of A"
      "A is true but R is false"
      "A is false but R is true"
3) Statement-based (Statement-I / Statement-II) — prompt contains two labelled
   statements. Options are EXACTLY:
      "Both Statement-I and Statement-II are correct"
      "Both Statement-I and Statement-II are incorrect"
      "Statement-I is correct and Statement-II is incorrect"
      "Statement-I is incorrect and Statement-II is correct"
4) Match the following (List-I / List-II or Column-I / Column-II) — CRITICAL:
   The prompt MUST contain BOTH List-I (A, B, C, D) AND List-II (I, II, III, IV) in full.
   NEVER put List-II or any list items inside the options field!
   The options field MUST contain EXACTLY 4 candidate pairing strings, written like:
      Option 1: "A-I, B-II, C-III, D-IV"
      Option 2: "A-II, B-I, C-IV, D-III"
      Option 3: "A-III, B-IV, C-I, D-II"
      Option 4: "A-IV, B-III, C-II, D-I"
5) Multiple correct combinations — prompt lists 3-4 statements (i, ii, iii, iv)
   and asks which combination is correct. Options are 4 candidate subsets like
   "(i) and (iii) only".
6) Numerical / integer answer (JEE Main only) — type="short", options=null,
   correct_answer is the numeric value as string (e.g. ["12"] or ["3.14"]).

correct_answer for structured formats MUST be the FULL option text, verbatim.
Never emit just "1" or "A" — emit the whole matching option string.

CRITICAL LAWS FOR MATH & CHEMISTRY FORMATTING:
1) NEVER output bare \\ce{...} or bare \\mathrm{...} without $...$ dollar wrappers around them.
2) ALWAYS wrap chemical equations, formulas, and symbols in inline dollars: $...$. Example: $2SO_2(g) + O_2(g) \rightleftharpoons 2SO_3(g)$, $K_c$, $pH$, $O_2^-$, $Cu^{2+}$.
3) NEVER wrap English prose or full sentences in dollars ($...$). Keep prose as normal text.
4) Options MUST be clean single-line strings without stray delimiters.`;

const PATTERN_GUIDE: Record<string, string> = {
  neet:
    `NEET UG (India) official exam standard. NCERT Class 11 & 12 syllabus. Subjects: Physics, Chemistry, Botany, Zoology. Each subject has 50 questions (total 200 questions in the paper). Marks per question = 4 (+4 for correct, −1 for wrong).

CRITICAL EXAM PATTERN & QUESTION TYPE RATIO FOR NEET:
- Every question MUST follow NCERT Class 11 & Class 12 biology, chemistry, and physics textbook concepts and line-by-line facts.
- EXACT QUESTION FORMAT RATIO (matching real NTA NEET UG papers):
  1) ~50% Direct Single-Correct MCQs: Conceptual, diagrammatic, or numerical single-choice questions with 4 options.
  2) ~20% Match the Following (List-I / List-II): Two-column matching questions (List-I A,B,C,D vs List-II i,ii,iii,iv) with options formatted like "A-ii, B-iv, C-i, D-iii". This format is HEAVILY tested in NEET Botany, Zoology & Chemistry!
  3) ~15% Statement-based (Statement-I and Statement-II): Two labelled statements with standard options ("Both Statement-I and Statement-II are correct", "Both Statement-I and Statement-II are incorrect", etc.).
  4) ~15% Assertion & Reason (Assertion (A) and Reason (R)): Labelled Assertion (A) & Reason (R) with standard NEET options ("Both A and R are true and R is the correct explanation of A", etc.).
- No short/numerical answer type. ALL questions MUST be type="mcq" with exactly 4 options.
${PATTERN_FORMAT_MIX}`,
  eamcet:
    `AP/TS EAMCET (Engineering, MPC) standard. Intermediate 1st & 2nd year syllabus. Subjects: Mathematics, Physics, Chemistry. Marks per question = 1, no negative marks.
Approximate format ratio: ~80% direct single-correct MCQ, ~10% Match-the-following, ~5% Assertion & Reason, ~5% Statement-based / Multiple-correct-combination. No numerical/integer type. All questions type="mcq" with exactly 4 options.${PATTERN_FORMAT_MIX}`,
  ts_eamcet_bipc:
    `TS EAMCET (Agriculture & Medical / BIPC) standard. Intermediate 1st & 2nd year syllabus. Subjects: Botany, Zoology, Physics, Chemistry. Marks per question = 1, no negative marks.
Approximate format ratio: ~75% direct single-correct MCQ, ~10% Assertion & Reason, ~10% Match-the-following, ~5% Statement-based / Multiple-correct-combination. No numerical type. All questions type="mcq" with exactly 4 options.${PATTERN_FORMAT_MIX}`,
  mains:
    `JEE Main (India) standard. CBSE Class 11 & 12 syllabus. Subjects: Physics, Chemistry, Mathematics. Marks per question = 4 (+4 correct, −1 wrong for MCQ; numerical section: +4/−1).
Approximate format ratio: ~65% direct single-correct MCQ, ~20% Numerical/integer (type="short"), ~5% Assertion & Reason, ~5% Statement-based, ~5% Match-the-following. Non-numerical questions are type="mcq" with exactly 4 options.${PATTERN_FORMAT_MIX}`,
  custom: `Follow the admin's brief exactly.${PATTERN_FORMAT_MIX}`,
};

async function runGenerateOnce(prompt: string, userContent: any[]) {
  const needsVision = userContent.some((p) => p?.type === "image" || p?.type === "file");
  const key = needsVision ? getVisionApiKey() : getAiApiKey();
  if (!key) throw new Error("Missing AI API key");
  const model = needsVision
    ? createVisionProvider(key)("google/gemini-3.5-flash")
    : createLovableAiGatewayProvider(key, { structuredOutputs: true })("openai/gpt-oss-120b");
  try {
    const { output } = await generateText({
      model,
      output: Output.object({ schema: GenSchema }),
      instructions: prompt,
      messages: [
        { role: "user", content: userContent as any },
      ],
    });
    return output.questions;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      throw new Error("AI could not produce structured questions. Try clearer input or fewer questions.");
    }
    throw error;
  }
}

// Split large generations into parallel chunks for much faster wall-clock time,
// with prompt count sanitization per chunk and a top-up pass to guarantee exact count.
async function runGenerateExact(prompt: string, userContent: any[], count: number) {
  const CHUNK = 20;

  const sanitizeContentForCount = (contentArray: any[], targetCount: number) => {
    return contentArray.map((item) => {
      if (item && item.type === "text" && typeof item.text === "string") {
        return {
          ...item,
          text: item.text
            .replace(/exactly \d+ questions/gi, `exactly ${targetCount} questions`)
            .replace(/Produce exactly \d+/gi, `Produce exactly ${targetCount}`),
        };
      }
      return item;
    });
  };

  const sanitizePromptForCount = (promptStr: string, targetCount: number) => {
    return promptStr
      .replace(/exactly \d+ high-quality questions/gi, `exactly ${targetCount} high-quality questions`)
      .replace(/exactly \d+ questions/gi, `exactly ${targetCount} questions`);
  };

  let accumulated: GenQuestion[] = [];

  if (count <= CHUNK) {
    const p = sanitizePromptForCount(prompt, count);
    const c = sanitizeContentForCount(userContent, count);
    accumulated = await runGenerateOnce(p, c).catch(() => []);
  } else {
    const chunks: number[] = [];
    let remaining = count;
    while (remaining > 0) {
      const n = Math.min(CHUNK, remaining);
      chunks.push(n);
      remaining -= n;
    }

    const results = await Promise.all(
      chunks.map((n, i) => {
        const chunkPrompt = sanitizePromptForCount(prompt, n);
        const cleanedUserContent = sanitizeContentForCount(userContent, n);
        const chunkContent = [
          ...cleanedUserContent,
          {
            type: "text",
            text: `Batch ${i + 1} of ${chunks.length}. Produce exactly ${n} questions for THIS batch only. Vary topics/difficulty from other batches; do not repeat questions. Use a distinct random seed: ${Math.random().toString(36).slice(2, 10)}.`,
          },
        ];
        return runGenerateOnce(chunkPrompt, chunkContent).then((qs) => qs.slice(0, n)).catch(() => []);
      }),
    );
    accumulated = results.flat();
  }

  // Guarantee exact target count: if any chunk returned fewer items, run a top-up pass for the missing questions.
  if (accumulated.length < count) {
    const missing = count - accumulated.length;
    const topUpPrompt = sanitizePromptForCount(prompt, missing);
    const topUpContent = [
      ...sanitizeContentForCount(userContent, missing),
      {
        type: "text",
        text: `Top-up batch: Produce exactly ${missing} additional unique questions to complete the set. Do not repeat existing topics.`,
      },
    ];
    const extra = await runGenerateOnce(topUpPrompt, topUpContent).then((qs) => qs.slice(0, missing)).catch(() => []);
    accumulated = [...accumulated, ...extra];
  }

  return accumulated.slice(0, count);
}



const TOUGHNESS_GUIDE: Record<string, string> = {
  easy:
    `TOUGHNESS: EASY. Single-step, direct-recall or one-formula questions. Straight from NCERT/Intermediate textbook lines. Distractors are obviously wrong. Difficulty field = "easy" for every question.`,
  medium:
    `TOUGHNESS: MEDIUM. Two-step reasoning or one application of a formula, typical of an average question in the real paper. Distractors are plausible. Difficulty field = "medium" for every question.`,
  hard:
    `TOUGHNESS: HARD. Multi-concept, multi-step questions matching the toughest 20% of the real paper. Combine two chapters, require careful unit/exception handling, and use very close distractors. Difficulty field = "hard" for every question.`,
  extreme:
    `TOUGHNESS: EXTREME. Reproduce the EXACT questions asked in previous years' hardest shifts (the shift that was reported as the toughest that year). Do not simplify them. Every question must carry its real source_ref, e.g. "NEET 2022 (Phase 2)" or "JEE Main 2023 · Jan 31 Shift 2". Difficulty field = "extreme" for every question.`,
};

const MODE_GUIDE: Record<string, string> = {
  ai:
    `GENERATION MODE: AI-GENERATED (previous-year aligned). Every question must be a close variant/modification of a question actually asked in a previous year of this exam — same concept, same structure, same trap, with numbers, species, or wording changed. Never invent an off-pattern question. Set source_ref to the paper you modelled it on, prefixed with "Modelled on ", e.g. "Modelled on NEET 2021".`,
  pyq:
    `GENERATION MODE: PREVIOUS YEAR QUESTIONS (PYQ) ONLY. Every question MUST be an actual question asked in a real past paper of this exam, reproduced faithfully (wording, options, correct answer). Do NOT invent questions and do NOT paraphrase. source_ref is MANDATORY for every question and must state the exam, year and shift/phase exactly, e.g. "NEET 2023", "JEE Main 2024 · Apr 06 Shift 1", "TS EAMCET 2022 · Jul 18 Forenoon". If you are not confident a question was really asked, do not include it — pick another real one.`,
};

function baseGenPrompt(
  pattern: string,
  count: number,
  subject?: string | null,
  genMode: string = "ai",
  toughness: string = "medium",
) {
  const guide = PATTERN_GUIDE[pattern] ?? PATTERN_GUIDE.custom;
  return `You are an expert exam question setter. ${guide}

${MODE_GUIDE[genMode] ?? MODE_GUIDE.ai}

${TOUGHNESS_GUIDE[toughness] ?? TOUGHNESS_GUIDE.medium}

Generate exactly ${count} high-quality questions${subject ? ` on subject/topic: ${subject}` : ""}.
Return JSON matching the schema. For MCQ use type "mcq" with 4 options and one correct answer in correct_answer array. For true/false use "tf" with options ["True","False"]. For numerical/short use "short" with options null and correct_answer as accepted answers. CRITICAL: Set 'topic' to the specific chapter or topic name (e.g. 'Units and Measurements', 'Dual Nature of Radiation', 'Kinematics', 'Genetics', 'Thermodynamics'). NEVER set 'topic' to general subject names like 'Physics' or 'Chemistry'. Set difficulty to the toughness level requested above. Set source_ref as described above (null only when genMode is AI and no source paper applies). Do not repeat questions.


LANGUAGE (CRITICAL): Every question prompt, every option, and every correct_answer MUST be written in ENGLISH only. If the source material contains Telugu, Hindi, or any other non-English text, translate it to clear, natural English before producing the question. Never emit non-English script (no Telugu, Devanagari, or other native scripts) in any field.

FORMATTING (CRITICAL — questions render with Markdown + KaTeX + mhchem):
- Default to PLAIN ENGLISH TEXT. Use LaTeX ONLY for an actual formula, equation, symbol or chemical species — never for ordinary words. A sentence like "if the number of moles of product increases" must contain NO LaTeX at all.
- Every LaTeX fragment must be individually wrapped in its own $...$ pair. Never open a $ and close it many words later, never leave an unmatched $, never wrap a whole sentence in $...$.
- Powers/subscripts: $x^2$, $a_{ij}$, $10^{-3}$.
- Fractions/roots: $\\frac{a}{b}$, $\\sqrt{x}$, $\\sqrt[3]{x}$.
- Greek/symbols: $\\alpha$, $\\beta$, $\\pi$, $\\sigma$, $\\theta$, $\\Delta$, $\\rightarrow$, $\\pm$, $\\times$, $\\infty$ — each in its own $...$.
- Vectors/units: $\\vec{F} = m\\vec{a}$, $9.8\\ \\text{m/s}^2$.
- CHEMISTRY (strict): ALWAYS use mhchem inside math, one species/equation per $...$ pair:
  species -> $\\ce{H2SO4}$, $\\ce{SO4^2-}$, $\\ce{NH3(aq)}$, $\\ce{AgCl(s)}$
  reaction -> $\\ce{2SO2(g) + O2(g) <=> 2SO3(g)}$
  Never write bare \\ce{...} outside $...$; never write \\mathrm{...} around a whole reaction; never mix prose inside \\ce{}. Use $\\ce{->}$ / $\\ce{<=>}$ for arrows, never the words "arrow" or raw \\rightleftharpoons outside math. For bonds write "sigma bond" / "pi bond" in words, or $\\sigma$ / $\\pi$ inside math — never a stray \\sigma in prose.
- PHYSICS: state every symbol's meaning in words; numbers with units as $5\\ \\text{m s}^{-1}$.
- BOTANY / ZOOLOGY: plain English only, italics via **bold** is not needed; scientific names written normally (e.g. Homo sapiens). No LaTeX unless a real formula appears.
- Options must be pure text of the choice (no "A)"/"B)" prefixes), self-contained, and use the same math rules.
- Preserve line breaks in the prompt using \\n. Do NOT wrap the question in a code block. Do NOT escape backslashes twice.

SELF-VERIFICATION (MANDATORY): Before returning, re-read EVERY question prompt, EVERY option and EVERY correct_answer and check:
 1. Every $ has a matching closing $ and no prose sits inside a math span.
 2. Every backslash macro sits inside $...$ and is a real KaTeX/mhchem command.
 3. Every chemical formula/equation is written with \\ce{} and is chemically balanced.
 4. Exactly 4 distinct, plausible, non-overlapping options for MCQs, and correct_answer is the verbatim full text of one of them.
 5. No leftover markup, stray symbols, duplicated text, or truncated sentences.
Silently fix anything that fails these checks and return only the corrected questions.`;


}

// Build an AI-SDK v5 ModelMessage content part (not OpenAI-native image_url/file shapes).
function buildFilePart(fileBase64: string, mimeType: string, fileName: string) {
  const isImage = mimeType.startsWith("image/");
  const isText =
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    /\.(md|markdown|txt|csv|json)$/i.test(fileName);
  if (isImage) {
    return {
      type: "image" as const,
      image: `data:${mimeType};base64,${fileBase64}`,
      mediaType: mimeType,
    };
  }
  if (isText) {
    const text = Buffer.from(fileBase64, "base64").toString("utf-8").slice(0, 200_000);
    return {
      type: "text" as const,
      text: `--- FILE: ${fileName} ---\n${text}\n--- END FILE ---`,
    };
  }
  return {
    type: "file" as const,
    data: `data:${mimeType};base64,${fileBase64}`,
    mediaType: mimeType || "application/octet-stream",
    filename: fileName,
  };
}

export const generateFromNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pattern: PatternEnum,
        count: z.number().int().min(1).max(100),
        subject: z.string().max(120).nullable().optional(),
        fileBase64: z.string(),
        mimeType: z.string(),
        fileName: z.string(),
        genMode: GenModeEnum.default("ai"),
        toughness: ToughnessEnum.default("medium"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sys =
      baseGenPrompt(data.pattern, data.count, data.subject, data.genMode, data.toughness) +
      `\n\nBase the questions strictly on the notes/material in the attached file (${data.fileName}). Cross-reference with the style, difficulty, and pattern of PAST ${data.pattern.toUpperCase()} papers on these topics. Do not invent facts outside the notes. If the source is in Telugu/Hindi/any non-English language, translate all questions and options to English.`;
    const part = buildFilePart(data.fileBase64, data.mimeType, data.fileName);
    const questions = await runGenerateExact(sys, [
      { type: "text", text: `Generate exactly ${data.count} questions from these notes. Do not produce more or fewer than ${data.count}. Output in ENGLISH only.` },
      part,
    ], data.count);
    return { questions: normalizeGenerated(questions, data.genMode, data.toughness) };
  });

export const generateFromDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pattern: PatternEnum,
        count: z.number().int().min(1).max(100),
        subject: z.string().max(120).nullable().optional(),
        description: z.string().max(4000).nullable().optional(),
        genMode: GenModeEnum.default("ai"),
        toughness: ToughnessEnum.default("medium"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sys = baseGenPrompt(data.pattern, data.count, data.subject, data.genMode, data.toughness);
    const descText = data.description?.trim()
      ? `Exam brief / topics from admin:\n${data.description.trim()}\n\nProduce exactly ${data.count} questions — no more, no less.`
      : `No specific topic brief provided. Generate questions covering the standard syllabus for ${data.subject || "this exam"} strictly following the pattern, generation mode, and toughness level specified above. Produce exactly ${data.count} questions — no more, no less.`;
    const questions = await runGenerateExact(sys, [
      { type: "text", text: descText },
    ], data.count);
    return { questions: normalizeGenerated(questions, data.genMode, data.toughness) };
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
      source_ref: q.source_ref ?? null,
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


/* ---------------- Admin attempt detail & explanation ---------------- */

export const adminGetAttemptDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ attemptId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: att } = await context.supabase
      .from("attempts")
      .select("id, exam_id, student_id, status, score, max_score, warning_count, started_at, submitted_at, auto_submitted, question_order, marks_published, grader_notes")
      .eq("id", data.attemptId)
      .maybeSingle();
    if (!att) throw new Error("Attempt not found");
    // Ownership: caller must own the exam (RLS-scoped read).
    await assertOwnsExam(context, att.exam_id);

    const [{ data: exam }, { data: student }, { data: insight }, { data: answerSheetImages }] = await Promise.all([
      context.supabase
        .from("exams")
        .select("id, title, duration_minutes, show_result_after_submit, show_answer_sheet, show_answer_book, pattern, pattern_config")
        .eq("id", att.exam_id)
        .single(),
      context.supabase
        .from("students")
        .select("id, name, student_code, class_name, email")
        .eq("id", att.student_id)
        .maybeSingle(),
      context.supabase
        .from("insights")
        .select("summary, weak_topics, strong_topics, recommendations")
        .eq("attempt_id", att.id)
        .maybeSingle(),
      (context.supabase as any)
        .from("attempt_answer_sheet_images")
        .select("id, image_url, page_number, uploaded_at")
        .eq("attempt_id", att.id)
        .order("page_number", { ascending: true }),
    ]);

    const order = (att.question_order as { qid: string; options_order: number[] | null }[]) ?? [];
    const qids = order.map((o) => o.qid);
    let questions: any[] = [];
    if (qids.length) {
      const [{ data: qs }, { data: ans }] = await Promise.all([
        context.supabase.from("questions").select("id, type, prompt, options, correct_answer, marks, topic, source_ref").in("id", qids),
        context.supabase.from("answers").select("question_id, response, is_correct, marks_awarded").eq("attempt_id", att.id),
      ]);
      const ansMap = new Map((ans ?? []).map((a: any) => [a.question_id, a]));
      const qMap = new Map((qs ?? []).map((q: any) => [q.id, q]));
      questions = order
        .map((o) => {
          const q: any = qMap.get(o.qid);
          if (!q) return null;
          const a: any = ansMap.get(q.id);
          return {
            id: q.id,
            type: q.type,
            prompt: q.prompt,
            options: q.options,
            correct_answer: q.correct_answer,
            marks: q.marks,
            topic: q.topic,
            source_ref: q.source_ref ?? null,

            response: (a?.response as string[] | null) ?? [],
            is_correct: a?.is_correct ?? null,
            marks_awarded: a?.marks_awarded ?? 0,
          };
        })
        .filter(Boolean);
    }

    return {
      student,
      exam: exam
        ? {
            id: exam.id,
            title: exam.title,
            duration_minutes: exam.duration_minutes,
            showResult: !!exam.show_result_after_submit,
            showAnswerSheet: !!exam.show_answer_sheet,
            showAnswerBook: !!exam.show_answer_book,
            isIpe: !!(exam as any).pattern_config?.is_ipe,
            patternConfig: (exam as any).pattern_config ?? null,
          }
        : null,
      attempt: {
        id: att.id,
        status: att.status,
        score: att.score,
        max_score: att.max_score,
        submitted_at: att.submitted_at,
        started_at: att.started_at,
        auto_submitted: att.auto_submitted,
        warning_count: att.warning_count,
        marks_published: !!(att as any).marks_published,
        grader_notes: ((att as any).grader_notes as string | null) ?? "",
      },
      insight: insight ?? null,
      questions,
      answerSheetImages: answerSheetImages ?? [],
    };
  });

export const adminGetAttemptExplanation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ attemptId: z.string().uuid(), questionId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: att } = await context.supabase
      .from("attempts")
      .select("id, exam_id, question_order")
      .eq("id", data.attemptId)
      .maybeSingle();
    if (!att) throw new Error("Attempt not found");
    await assertOwnsExam(context, att.exam_id);
    const order = (att.question_order as { qid: string }[]) ?? [];
    if (!order.some((o) => o.qid === data.questionId)) throw new Error("Question not part of this attempt");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cached } = await supabaseAdmin
      .from("question_explanations")
      .select("explanation")
      .eq("question_id", data.questionId)
      .maybeSingle();
    if (cached?.explanation) return { explanation: cached.explanation as string };

    const { data: q } = await supabaseAdmin
      .from("questions")
      .select("prompt, options, correct_answer, type, topic")
      .eq("id", data.questionId)
      .single();
    if (!q) throw new Error("Question not found");
    const key = getAiApiKey();
    if (!key) throw new Error("AI not configured");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("openai/gpt-5.4-mini"),
      providerOptions: { lovable: { service_tier: "priority" } },
      instructions:
        "You are an expert tutor writing an Answer Book entry for a competitive-exam question, in the clean, well-organized style of ChatGPT. Structure the reply EXACTLY as Markdown with these sections in this order, using these exact headings:\n\n### Correct answer\nOne line only. State the correct option verbatim in **bold**. Do NOT repeat it.\n\n### Why it is correct\n2-4 short sentences of plain-language reasoning. No formulas here.\n\n### Step-by-step solution\nA numbered Markdown list (1., 2., 3., ...). Each step = ONE idea, ONE sentence + at most ONE formula on its own display line. For each formula: name it, define every variable, then show the substitution. Use $$...$$ on its own line for any formula that stands alone.\n\n### Why the other options are wrong\nA Markdown bullet list (\"- \"). One short bullet per wrong option, starting with the option text in **bold**.\n\n### Key takeaway\nOne single line the student should memorize.\n\nSTRICT FORMATTING RULES — the output renders with Markdown + KaTeX + mhchem:\n- Use ONLY $...$ for inline math and $$...$$ for display math. NEVER use \\( \\), \\[ \\], plain parentheses, or plain brackets around LaTeX.\n- Every \\ce{...}, \\frac{...}{...}, \\sqrt{...}, ^, _ MUST be inside $...$ or $$...$$. Never write bare \\ce{AgCl} — write $\\ce{AgCl}$.\n- Chemistry example: $\\ce{H2SO4 -> 2H+ + SO4^{2-}}$. Powers/subs: $x^2$, $H_2O$, $10^{-3}$. Units: $9.8\\,\\text{m/s}^2$.\n- No emojis, no ASCII art, no horizontal rules, no walls of text, no preamble like \"Sure!\" or \"Let us solve this\". Get straight to the answer.",
      prompt: JSON.stringify(
        { topic: q.topic, question: q.prompt, options: q.options, correct_answer: q.correct_answer, type: q.type },
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
    return { explanation: text };
  });
