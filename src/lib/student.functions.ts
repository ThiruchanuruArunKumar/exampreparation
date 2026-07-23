import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
function answersEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const s1 = [...a].map((x) => x.trim().toLowerCase()).sort();
  const s2 = [...b].map((x) => x.trim().toLowerCase()).sort();
  return s1.every((v, i) => v === s2[i]);
}
function randomToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const startStudentAttempt = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        studentCode: z.string().trim().min(1).max(40),
        accessCode: z.string().trim().min(1).max(20),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const code = data.studentCode.trim();
    const ac = data.accessCode.trim().toUpperCase();

    const { data: student } = await sb
      .from("students")
      .select("id, name")
      .eq("student_code", code)
      .maybeSingle();
    if (!student) throw new Error("Invalid student ID");

    const { data: exam } = await sb
      .from("exams")
      .select("id, title, duration_minutes, shuffle_questions, shuffle_options, start_at, end_at")
      .eq("access_code", ac)
      .maybeSingle();
    if (!exam) throw new Error("Invalid exam password");
    const now = new Date();
    if (exam.start_at && now < new Date(exam.start_at)) {
      throw new Error(`Exam opens at ${new Date(exam.start_at).toLocaleString()}`);
    }
    if (exam.end_at && now > new Date(exam.end_at)) {
      throw new Error("Exam window has closed");
    }


    let { data: asg } = await sb
      .from("assignments")
      .select("id, max_attempts, due_at")
      .eq("exam_id", exam.id)
      .eq("student_id", student.id)
      .maybeSingle();
    if (!asg) {
      const { data: created, error } = await sb
        .from("assignments")
        .insert({ exam_id: exam.id, student_id: student.id, max_attempts: 1 })
        .select("id, max_attempts, due_at")
        .single();
      if (error) throw error;
      asg = created;
    }
    if (asg.due_at && new Date(asg.due_at) < new Date()) throw new Error("Exam past due");

    const { data: prior } = await sb
      .from("attempts")
      .select("id, status, session_token")
      .eq("assignment_id", asg.id);
    const inProg = (prior ?? []).find((p) => p.status === "in_progress");
    if (inProg) return { attemptId: inProg.id, sessionToken: inProg.session_token ?? "" };
    const finished = (prior ?? []).filter((p) => p.status !== "in_progress").length;
    if (finished >= asg.max_attempts) throw new Error("You have already taken this exam.");

    const { data: qs } = await sb
      .from("questions")
      .select("id, options, marks, order_index")
      .eq("exam_id", exam.id)
      .order("order_index");
    if (!qs?.length) throw new Error("Exam has no questions");

    const ordered = exam.shuffle_questions ? shuffle(qs) : qs;
    const questionOrder = ordered.map((q) => ({
      qid: q.id,
      options_order:
        exam.shuffle_options && Array.isArray(q.options)
          ? shuffle((q.options as string[]).map((_, i) => i))
          : null,
    }));
    const maxScore = qs.reduce((s, q) => s + (q.marks ?? 0), 0);
    let endsAtMs = Date.now() + exam.duration_minutes * 60_000;
    if (exam.end_at) endsAtMs = Math.min(endsAtMs, new Date(exam.end_at).getTime());
    const endsAt = new Date(endsAtMs).toISOString();
    const token = randomToken();

    const { data: created, error } = await sb
      .from("attempts")
      .insert({
        assignment_id: asg.id,
        student_id: student.id,
        exam_id: exam.id,
        ends_at: endsAt,
        question_order: questionOrder,
        max_score: maxScore,
        status: "in_progress",
        session_token: token,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { attemptId: created.id, sessionToken: token };
  });

export const getStudentHistory = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ studentCode: z.string().trim().min(1).max(40) }).parse(i),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: student } = await sb
      .from("students")
      .select("id, name, student_code, email, class_name")
      .eq("student_code", data.studentCode.trim())
      .maybeSingle();
    if (!student) throw new Error("Invalid student ID");

    const { data: attempts } = await sb
      .from("attempts")
      .select("id, exam_id, status, score, max_score, submitted_at, started_at, auto_submitted, warning_count")
      .eq("student_id", student.id)
      .order("started_at", { ascending: false });

    const examIds = Array.from(new Set((attempts ?? []).map((a) => a.exam_id)));
    const { data: exams } = examIds.length
      ? await sb.from("exams").select("id, title, duration_minutes").in("id", examIds)
      : { data: [] as { id: string; title: string; duration_minutes: number }[] };
    const examMap = new Map((exams ?? []).map((e) => [e.id, e]));

    const attemptIds = (attempts ?? []).map((a) => a.id);
    const { data: insights } = attemptIds.length
      ? await sb
          .from("insights")
          .select("attempt_id, summary, weak_topics, strong_topics, recommendations")
          .in("attempt_id", attemptIds)
      : { data: [] as any[] };
    const insightMap = new Map((insights ?? []).map((i: any) => [i.attempt_id, i]));

    return {
      student,
      history: (attempts ?? []).map((a) => ({
        ...a,
        exam: examMap.get(a.exam_id) ?? null,
        insight: insightMap.get(a.id) ?? null,
      })),
    };
  });

async function loadAttempt(attemptId: string, token: string) {
  const sb = await admin();
  const { data: att, error } = await sb
    .from("attempts")
    .select(
      "id, exam_id, student_id, ends_at, status, warning_count, question_order, score, max_score, session_token, submitted_at, auto_submitted",
    )
    .eq("id", attemptId)
    .single();
  if (error || !att) throw new Error("Attempt not found");
  if (!att.session_token || att.session_token !== token) throw new Error("Invalid session");
  return { sb, att };
}

export const getStudentAttemptState = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ attemptId: z.string().uuid(), sessionToken: z.string().min(10) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { sb, att } = await loadAttempt(data.attemptId, data.sessionToken);
    const { data: exam } = await sb
      .from("exams")
      .select("id, title, duration_minutes")
      .eq("id", att.exam_id)
      .single();
    const { data: student } = await sb
      .from("students")
      .select("name, student_code")
      .eq("id", att.student_id)
      .single();
    const order = (att.question_order as { qid: string; options_order: number[] | null }[]) ?? [];
    const qids = order.map((o) => o.qid);
    const { data: qs } = await sb
      .from("questions")
      .select("id, type, prompt, options, marks, topic, difficulty")
      .in("id", qids);
    const qMap = new Map((qs ?? []).map((q) => [q.id, q]));
    const questions = order
      .map((o) => {
        const q = qMap.get(o.qid);
        if (!q) return null;
        let opts = q.options as string[] | null;
        if (opts && o.options_order) opts = o.options_order.map((i) => opts![i]);
        return {
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          options: opts,
          marks: q.marks,
          topic: q.topic,
          difficulty: q.difficulty,
        };
      })
      .filter(Boolean);
    const { data: answers } = await sb
      .from("answers")
      .select("question_id, response")
      .eq("attempt_id", att.id);
    return {
      attempt: {
        id: att.id,
        endsAt: att.ends_at,
        status: att.status,
        warningCount: att.warning_count,
        score: att.score,
        maxScore: att.max_score,
      },
      exam,
      student,
      questions,
      answers: answers ?? [],
    };
  });

export const saveStudentAnswer = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        attemptId: z.string().uuid(),
        sessionToken: z.string().min(10),
        questionId: z.string().uuid(),
        response: z.array(z.string()).max(20),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { sb, att } = await loadAttempt(data.attemptId, data.sessionToken);
    if (att.status !== "in_progress") throw new Error("Attempt closed");
    if (new Date(att.ends_at) < new Date()) throw new Error("Time up");
    const { error } = await sb.from("answers").upsert(
      {
        attempt_id: data.attemptId,
        question_id: data.questionId,
        response: data.response,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "attempt_id,question_id" },
    );
    if (error) throw error;
    return { ok: true };
  });

export const reportStudentWarning = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        attemptId: z.string().uuid(),
        sessionToken: z.string().min(10),
        count: z.number().int().min(0).max(100),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { sb, att } = await loadAttempt(data.attemptId, data.sessionToken);
    if (data.count <= att.warning_count) return { ok: true };
    await sb.from("attempts").update({ warning_count: data.count }).eq("id", data.attemptId);
    return { ok: true };
  });

export const submitStudentAttempt = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        attemptId: z.string().uuid(),
        sessionToken: z.string().min(10),
        autoSubmit: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { sb, att } = await loadAttempt(data.attemptId, data.sessionToken);
    const { data: examFlags } = await sb
      .from("exams")
      .select("title, show_result_after_submit, show_answer_sheet, show_answer_book, negative_mark_per_wrong")
      .eq("id", att.exam_id)
      .maybeSingle();
    const flags = {
      showResult: examFlags?.show_result_after_submit ?? true,
      showAnswerSheet: examFlags?.show_answer_sheet ?? false,
      showAnswerBook: examFlags?.show_answer_book ?? false,
      examTitle: examFlags?.title ?? "",
    };
    if (att.status !== "in_progress") {
      const { data: existing } = await sb
        .from("insights")
        .select("summary, weak_topics, strong_topics, recommendations")
        .eq("attempt_id", att.id)
        .maybeSingle();
      return { ok: true, alreadySubmitted: true, score: att.score, maxScore: att.max_score, insight: existing, ...flags };
    }

    const { data: examRow } = await sb
      .from("exams")
      .select("negative_mark_per_wrong")
      .eq("id", att.exam_id)
      .maybeSingle();
    const negPerWrong = Number(examRow?.negative_mark_per_wrong ?? 0);

    const order = (att.question_order as { qid: string }[]) ?? [];
    const qids = order.map((o) => o.qid);
    const [{ data: qs }, { data: ans }] = await Promise.all([
      sb
        .from("questions")
        .select("id, type, correct_answer, marks, topic, difficulty, prompt")
        .in("id", qids),
      sb.from("answers").select("question_id, response").eq("attempt_id", att.id),
    ]);
    const ansMap = new Map((ans ?? []).map((a) => [a.question_id, (a.response as string[]) ?? []]));
    let score = 0;
    let maxScore = 0;
    const shortToGrade: {
      id: string;
      prompt: string;
      correct: string[];
      response: string[];
      marks: number;
    }[] = [];
    const graded: {
      id: string;
      is_correct: boolean;
      marks_awarded: number;
      topic: string | null;
      difficulty: string | null;
    }[] = [];
    for (const q of qs ?? []) {
      maxScore += q.marks;
      const resp = ansMap.get(q.id) ?? [];
      const correct = (q.correct_answer as string[]) ?? [];
      if (q.type === "short") {
        shortToGrade.push({ id: q.id, prompt: q.prompt, correct, response: resp, marks: q.marks });
      } else {
        const attempted = resp.length > 0;
        const ok = attempted && answersEqual(resp, correct);
        const awarded = ok ? q.marks : attempted ? -negPerWrong : 0;
        score += awarded;
        graded.push({
          id: q.id,
          is_correct: ok,
          marks_awarded: awarded,
          topic: q.topic,
          difficulty: q.difficulty,
        });
      }
    }
    if (shortToGrade.length) {
      const key = process.env.LOVABLE_API_KEY;
      if (key) {
        try {
          const gateway = createLovableAiGatewayProvider(key, { structuredOutputs: true });
          const { output } = await generateText({
            model: gateway("openai/gpt-5.5"),
            output: Output.object({
              schema: z.object({
                results: z.array(
                  z.object({
                    id: z.string(),
                    fraction: z.number().min(0).max(1),
                    reason: z.string().nullable(),
                  }),
                ),
              }),
            }),
            prompt: `Grade each short answer strictly. Return fraction 0-1 of marks earned. Items:\n${JSON.stringify(
              shortToGrade.map((s) => ({
                id: s.id,
                question: s.prompt,
                expected: s.correct,
                response: s.response,
              })),
              null,
              2,
            )}`,
          });
          for (const r of output.results) {
            const q = shortToGrade.find((s) => s.id === r.id);
            if (!q) continue;
            const orig = qs?.find((x) => x.id === r.id);
            const awarded = Math.round(r.fraction * q.marks * 100) / 100;
            score += awarded;
            graded.push({
              id: r.id,
              is_correct: r.fraction >= 0.7,
              marks_awarded: awarded,
              topic: orig?.topic ?? null,
              difficulty: orig?.difficulty ?? null,
            });
          }
        } catch {
          for (const q of shortToGrade)
            graded.push({
              id: q.id,
              is_correct: false,
              marks_awarded: 0,
              topic: null,
              difficulty: null,
            });
        }
      }
    }
    for (const g of graded) {
      await sb
        .from("answers")
        .update({ is_correct: g.is_correct, marks_awarded: g.marks_awarded })
        .eq("attempt_id", att.id)
        .eq("question_id", g.id);
    }
    await sb
      .from("attempts")
      .update({
        status: data.autoSubmit ? "auto_submitted" : "submitted",
        auto_submitted: !!data.autoSubmit,
        submitted_at: new Date().toISOString(),
        score,
        max_score: maxScore,
      })
      .eq("id", att.id);

    let insight: {
      summary: string;
      weak_topics: string[];
      strong_topics: string[];
      recommendations: string;
    } | null = null;
    try {
      const key = process.env.LOVABLE_API_KEY;
      if (key) {
        const topicStats = new Map<string, { correct: number; total: number }>();
        for (const g of graded) {
          const t = g.topic ?? "General";
          const s = topicStats.get(t) ?? { correct: 0, total: 0 };
          s.total += 1;
          if (g.is_correct) s.correct += 1;
          topicStats.set(t, s);
        }
        const topicSummary = Array.from(topicStats.entries()).map(([topic, s]) => ({
          topic,
          accuracy: s.total ? s.correct / s.total : 0,
          total: s.total,
        }));
        const gateway = createLovableAiGatewayProvider(key, { structuredOutputs: true });
        const { output } = await generateText({
          model: gateway("openai/gpt-5.5"),
          output: Output.object({
            schema: z.object({
              summary: z.string(),
              weak_topics: z.array(z.string()),
              strong_topics: z.array(z.string()),
              recommendations: z.string(),
            }),
          }),
          prompt: `The student scored ${score}/${maxScore}. Per-topic accuracy: ${JSON.stringify(
            topicSummary,
          )}. Write a short encouraging summary, list weak topics (accuracy < 0.6), strong topics (>= 0.8), and personalized study recommendations with concrete next steps.`,
        });
        await sb.from("insights").upsert(
          {
            attempt_id: att.id,
            summary: output.summary,
            weak_topics: output.weak_topics,
            strong_topics: output.strong_topics,
            recommendations: output.recommendations,
          },
          { onConflict: "attempt_id" },
        );
        insight = output;
      }
    } catch (e) {
      console.error("insights failed", e);
    }
    return { ok: true, score, maxScore, insight };
  });
