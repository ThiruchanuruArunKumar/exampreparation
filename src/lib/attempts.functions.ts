import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function answersEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s1 = [...a].map((x) => x.trim().toLowerCase()).sort();
  const s2 = [...b].map((x) => x.trim().toLowerCase()).sort();
  return s1.every((v, i) => v === s2[i]);
}

export const startAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ assignmentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("status").eq("id", userId).maybeSingle();
    if ((prof as any)?.status !== "approved") throw new Error("Your account is not approved yet. Please wait for admin approval.");
    const { data: asg, error: aErr } = await supabase
      .from("assignments")
      .select("id, exam_id, student_id, max_attempts, due_at")
      .eq("id", data.assignmentId)
      .single();
    if (aErr || !asg) throw new Error("Assignment not found");
    if (asg.student_id !== userId) throw new Error("Forbidden");
    if (asg.due_at && new Date(asg.due_at) < new Date()) throw new Error("Assignment past due");

    const { data: prior } = await supabase
      .from("attempts")
      .select("id, status")
      .eq("assignment_id", asg.id)
      .eq("student_id", userId);
    const finished = (prior ?? []).filter((p) => p.status !== "in_progress");
    if (finished.length >= asg.max_attempts) throw new Error("Attempt limit reached");
    const inProgress = (prior ?? []).find((p) => p.status === "in_progress");
    if (inProgress) return { attemptId: inProgress.id };

    const { data: exam } = await supabase
      .from("exams")
      .select("id, duration_minutes, shuffle_questions, shuffle_options")
      .eq("id", asg.exam_id)
      .single();
    if (!exam) throw new Error("Exam missing");

    const { data: qs } = await supabase
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
    const endsAt = new Date(Date.now() + exam.duration_minutes * 60_000).toISOString();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error: cErr } = await supabaseAdmin
      .from("attempts")
      .insert({
        assignment_id: asg.id,
        student_id: userId,
        exam_id: exam.id,
        ends_at: endsAt,
        question_order: questionOrder,
        max_score: maxScore,
        status: "in_progress",
      })
      .select("id")
      .single();
    if (cErr) throw cErr;
    return { attemptId: created.id };
  });

export const getAttemptState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ attemptId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: att, error } = await supabase
      .from("attempts")
      .select("id, exam_id, student_id, ends_at, status, warning_count, question_order, score, max_score")
      .eq("id", data.attemptId)
      .single();
    if (error || !att) throw new Error("Attempt not found");
    if (att.student_id !== userId) throw new Error("Forbidden");

    const { data: exam } = await supabase
      .from("exams")
      .select("id, title, duration_minutes")
      .eq("id", att.exam_id)
      .single();

    const order = (att.question_order as { qid: string; options_order: number[] | null }[]) ?? [];
    const qids = order.map((o) => o.qid);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: qs } = await supabaseAdmin
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

    const { data: answers } = await supabase
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
      questions,
      answers: answers ?? [],
    };
  });

export const saveAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        attemptId: z.string().uuid(),
        questionId: z.string().uuid(),
        response: z.array(z.string()).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: att } = await supabase
      .from("attempts")
      .select("id, student_id, status, ends_at")
      .eq("id", data.attemptId)
      .single();
    if (!att || att.student_id !== userId) throw new Error("Forbidden");
    if (att.status !== "in_progress") throw new Error("Attempt closed");
    if (new Date(att.ends_at) < new Date()) throw new Error("Time up");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("answers")
      .upsert(
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

export const reportWarning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ attemptId: z.string().uuid(), count: z.number().int().min(0).max(100) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: att } = await supabase
      .from("attempts")
      .select("id, student_id, warning_count")
      .eq("id", data.attemptId)
      .single();
    if (!att || att.student_id !== userId) throw new Error("Forbidden");
    if (data.count <= att.warning_count) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("attempts")
      .update({ warning_count: data.count })
      .eq("id", data.attemptId);
    return { ok: true };
  });

export const submitAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ attemptId: z.string().uuid(), autoSubmit: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: att } = await supabase
      .from("attempts")
      .select("id, exam_id, student_id, status, question_order")
      .eq("id", data.attemptId)
      .single();
    if (!att || att.student_id !== userId) throw new Error("Forbidden");
    if (att.status !== "in_progress") return { ok: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const order = (att.question_order as { qid: string }[]) ?? [];
    const qids = order.map((o) => o.qid);
    const [{ data: qs }, { data: ans }] = await Promise.all([
      supabaseAdmin
        .from("questions")
        .select("id, type, correct_answer, marks, topic, difficulty, prompt")
        .in("id", qids),
      supabaseAdmin.from("answers").select("question_id, response").eq("attempt_id", att.id),
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
    const graded: { id: string; is_correct: boolean; marks_awarded: number; topic: string | null; difficulty: string | null }[] = [];

    for (const q of qs ?? []) {
      maxScore += q.marks;
      const resp = ansMap.get(q.id) ?? [];
      const correct = (q.correct_answer as string[]) ?? [];
      if (q.type === "short") {
        shortToGrade.push({ id: q.id, prompt: q.prompt, correct, response: resp, marks: q.marks });
      } else {
        const ok = resp.length > 0 && answersEqual(resp, correct);
        const awarded = ok ? q.marks : 0;
        score += awarded;
        graded.push({ id: q.id, is_correct: ok, marks_awarded: awarded, topic: q.topic, difficulty: q.difficulty });
      }
    }

    // AI grade short-answers
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
              shortToGrade.map((s) => ({ id: s.id, question: s.prompt, expected: s.correct, response: s.response })),
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
          for (const q of shortToGrade) {
            graded.push({ id: q.id, is_correct: false, marks_awarded: 0, topic: null, difficulty: null });
          }
        }
      }
    }

    // Persist grading
    for (const g of graded) {
      await supabaseAdmin
        .from("answers")
        .update({ is_correct: g.is_correct, marks_awarded: g.marks_awarded })
        .eq("attempt_id", att.id)
        .eq("question_id", g.id);
    }

    await supabaseAdmin
      .from("attempts")
      .update({
        status: data.autoSubmit ? "auto_submitted" : "submitted",
        auto_submitted: !!data.autoSubmit,
        submitted_at: new Date().toISOString(),
        score,
        max_score: maxScore,
      })
      .eq("id", att.id);

    // Generate insights
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
          prompt: `The student scored ${score}/${maxScore}. Per-topic accuracy: ${JSON.stringify(topicSummary)}. Write a short encouraging summary, list weak topics (accuracy < 0.6), strong topics (>= 0.8), and personalized study recommendations with concrete next steps.`,
        });
        await supabaseAdmin.from("insights").upsert(
          {
            attempt_id: att.id,
            summary: output.summary,
            weak_topics: output.weak_topics,
            strong_topics: output.strong_topics,
            recommendations: output.recommendations,
          },
          { onConflict: "attempt_id" },
        );
      }
    } catch (e) {
      console.error("insights failed", e);
    }

    return { ok: true, score, maxScore };
  });

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
    await supabaseAdmin.from("attempts").delete().eq("assignment_id", data.assignmentId);
    return { ok: true };
  });
