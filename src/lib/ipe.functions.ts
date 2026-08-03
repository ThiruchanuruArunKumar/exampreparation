import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { repairLatex } from "./latex-repair";
import { SEED_SUBJECTS } from "./ipe-seed-data";
import { createLovableAiGatewayProvider, getAiApiKey, createVisionProvider, getVisionApiKey } from "./ai-gateway.server";
import { blueprintForSubject, blueprintMaxMarks, sectionLabel } from "./ipe-blueprints";


async function admin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function assertAdminRole(context: { supabase: any; userId: string }) {
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

function randomAccessCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

function isTableMissingError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  const code = err.code || "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("schema cache") ||
    msg.includes("could not find the table") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}

// Ensure default subjects, chapters, and rich question bank exist
async function ensureSeedData(sb: any, force = false) {
  try {
    const { data: existingSubjects, error } = await sb.from("ipe_subjects").select("id").limit(1);
    if (error && isTableMissingError(error)) {
      return;
    }

    const { data: existingQuestions, error: qErr } = await sb.from("ipe_questions").select("id").limit(1);
    if (qErr && isTableMissingError(qErr)) {
      return;
    }

    const hasQuestions = existingQuestions && existingQuestions.length > 0;

    if (!force && existingSubjects && existingSubjects.length > 0 && hasQuestions) {
      return; // Fully seeded
    }

    for (const sub of SEED_SUBJECTS) {
      // Check if subject already exists
      const { data: foundSub } = await sb
        .from("ipe_subjects")
        .select("id")
        .eq("name", sub.name)
        .eq("year", sub.year)
        .maybeSingle();

      let subId = foundSub?.id;
      if (!subId) {
        const { data: createdSub, error: subErr } = await sb
          .from("ipe_subjects")
          .insert({ name: sub.name, year: sub.year })
          .select("id")
          .single();
        if (subErr || !createdSub) continue;
        subId = createdSub.id;
      }

      for (const chap of sub.chapters) {
        const { data: foundChap } = await sb
          .from("ipe_chapters")
          .select("id")
          .eq("subject_id", subId)
          .eq("chapter_name", chap.chapterName)
          .maybeSingle();

        let chapId = foundChap?.id;
        if (!chapId) {
          const { data: createdChap, error: chapErr } = await sb
            .from("ipe_chapters")
            .insert({
              subject_id: subId,
              chapter_name: chap.chapterName,
              chapter_order: chap.chapterOrder,
            })
            .select("id")
            .single();
          if (chapErr || !createdChap) continue;
          chapId = createdChap.id;
        }

        // Insert questions if chapter has no questions yet
        const { data: qCheck } = await sb
          .from("ipe_questions")
          .select("id")
          .eq("chapter_id", chapId)
          .limit(1);

        if (!qCheck || qCheck.length === 0) {
          const qInserts = chap.questions.map((q) => ({
            chapter_id: chapId,
            question_type: q.questionType,
            question_text: repairLatex(q.questionText),
            marks: q.marks,
            source: q.source,
            source_year: q.sourceYear ?? null,
            verified: q.verified,
          }));
          await sb.from("ipe_questions").insert(qInserts);
        }
      }
    }
  } catch (e) {
    console.error("Seed error:", e);
  }
}

/* ---------------- Question Bank Server Functions ---------------- */

export const getIpeMigrationSql = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return `
CREATE TABLE IF NOT EXISTS public.ipe_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year TEXT NOT NULL CHECK (year IN ('1st_year', '2nd_year')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ipe_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.ipe_subjects(id) ON DELETE CASCADE,
  chapter_name TEXT NOT NULL,
  chapter_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ipe_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.ipe_chapters(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('very_short_answer', 'short_answer', 'long_answer')),
  question_text TEXT NOT NULL,
  marks INT NOT NULL DEFAULT 2,
  source TEXT NOT NULL CHECK (source IN ('previous_year', 'textbook', 'admin_added')),
  source_year TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ipe_previous_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.ipe_subjects(id) ON DELETE CASCADE,
  year TEXT NOT NULL,
  paper_file_url TEXT,
  structured_question_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attempt_answer_sheet_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  page_number INT NOT NULL DEFAULT 1,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_pattern_check;

ALTER TABLE public.ipe_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipe_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipe_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipe_previous_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answer_sheet_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ipe_subjects_all ON public.ipe_subjects;
CREATE POLICY ipe_subjects_all ON public.ipe_subjects FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ipe_chapters_all ON public.ipe_chapters;
CREATE POLICY ipe_chapters_all ON public.ipe_chapters FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ipe_questions_all ON public.ipe_questions;
CREATE POLICY ipe_questions_all ON public.ipe_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ipe_previous_papers_all ON public.ipe_previous_papers;
CREATE POLICY ipe_previous_papers_all ON public.ipe_previous_papers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS attempt_answer_sheet_images_all ON public.attempt_answer_sheet_images;
CREATE POLICY attempt_answer_sheet_images_all ON public.attempt_answer_sheet_images FOR ALL TO authenticated USING (true) WITH CHECK (true);
`;
  });

export const reseedIpeQuestionBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context);
    const sb = await admin();
    await ensureSeedData(sb, true);
    return { ok: true };
  });

export const getIpeSubjectsAndChapters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminRole(context);
    const sb = await admin();
    await ensureSeedData(sb);

    const { data: subjects, error: subErr } = await sb
      .from("ipe_subjects")
      .select("id, name, year, created_at")
      .order("name");

    if (subErr) {
      if (isTableMissingError(subErr)) {
        return { subjects: [], chapters: [], missingTables: true };
      }
      throw subErr;
    }

    const { data: chapters, error: chapErr } = await sb
      .from("ipe_chapters")
      .select("id, subject_id, chapter_name, chapter_order")
      .order("chapter_order");

    if (chapErr && !isTableMissingError(chapErr)) throw chapErr;

    return { subjects: subjects ?? [], chapters: chapters ?? [], missingTables: false };
  });

export const addIpeSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ name: z.string().trim().min(1).max(100), year: z.enum(["1st_year", "2nd_year"]) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const sb = await admin();
    const { data: created, error } = await sb
      .from("ipe_subjects")
      .insert({ name: data.name, year: data.year })
      .select("id, name, year")
      .single();
    if (error) throw error;
    return created;
  });

export const addIpeChapter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subjectId: z.string().uuid(),
        chapterName: z.string().trim().min(1).max(150),
        chapterOrder: z.number().int().min(1).default(1),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const sb = await admin();
    const { data: created, error } = await sb
      .from("ipe_chapters")
      .insert({
        subject_id: data.subjectId,
        chapter_name: data.chapterName,
        chapter_order: data.chapterOrder,
      })
      .select("id, subject_id, chapter_name, chapter_order")
      .single();
    if (error) throw error;
    return created;
  });

export const getIpeQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subjectId: z.string().optional(),
        chapterId: z.string().uuid().optional(),
        questionType: z.enum(["very_short_answer", "short_answer", "long_answer"]).optional(),
        source: z.enum(["previous_year", "textbook", "admin_added"]).optional(),
        verified: z.boolean().optional(),
        searchQuery: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const sb = await admin();

    let query = sb.from("ipe_questions").select("*").order("created_at", { ascending: false });

    if (data.chapterId) {
      query = query.eq("chapter_id", data.chapterId);
    } else if (data.subjectId && data.subjectId !== "all") {
      const { data: chaps } = await sb.from("ipe_chapters").select("id").eq("subject_id", data.subjectId);
      const cids = (chaps ?? []).map((c: any) => c.id);
      if (cids.length) {
        query = query.in("chapter_id", cids);
      } else {
        return [];
      }
    }

    if (data.questionType) query = query.eq("question_type", data.questionType);
    if (data.source) query = query.eq("source", data.source);
    if (typeof data.verified === "boolean") query = query.eq("verified", data.verified);

    const { data: questions, error } = await query;
    if (error) {
      if (error.code === "42P01") return [];
      throw error;
    }

    let result = questions ?? [];
    if (data.searchQuery?.trim()) {
      const q = data.searchQuery.trim().toLowerCase();
      result = result.filter(
        (item: any) =>
          item.question_text.toLowerCase().includes(q) ||
          (item.source_year ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  });

export const addIpeQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        chapterId: z.string().uuid(),
        questionType: z.enum(["very_short_answer", "short_answer", "long_answer"]),
        questionText: z.string().min(1),
        marks: z.number().int().min(1).max(20),
        source: z.enum(["previous_year", "textbook", "admin_added"]),
        sourceYear: z.string().nullable().optional(),
        verified: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const sb = await admin();
    const cleanText = repairLatex(data.questionText);
    const { data: created, error } = await sb
      .from("ipe_questions")
      .insert({
        chapter_id: data.chapterId,
        question_type: data.questionType,
        question_text: cleanText,
        marks: data.marks,
        source: data.source,
        source_year: data.sourceYear ?? null,
        verified: data.verified,
      })
      .select("*")
      .single();
    if (error) throw error;
    return created;
  });

export const importIpeQuestionsBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        chapterId: z.string().uuid(),
        questions: z.array(
          z.object({
            questionType: z.enum(["very_short_answer", "short_answer", "long_answer"]),
            questionText: z.string().min(1),
            marks: z.number().int().min(1).max(20),
            source: z.enum(["previous_year", "textbook", "admin_added"]).default("admin_added"),
            sourceYear: z.string().nullable().optional(),
          }),
        ),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const sb = await admin();

    const inserts = data.questions.map((q) => ({
      chapter_id: data.chapterId,
      question_type: q.questionType,
      question_text: repairLatex(q.questionText),
      marks: q.marks,
      source: q.source,
      source_year: q.sourceYear ?? null,
      verified: false, // Imported questions MUST be unverified until admin review
    }));

    const { data: created, error } = await sb.from("ipe_questions").insert(inserts).select("*");
    if (error) throw error;
    return created ?? [];
  });

export const toggleVerifyIpeQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ questionId: z.string().uuid(), verified: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const sb = await admin();
    const { error } = await sb
      .from("ipe_questions")
      .update({ verified: data.verified })
      .eq("id", data.questionId);
    if (error) throw error;
    return { ok: true };
  });

export const bulkVerifyIpeQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ questionIds: z.array(z.string().uuid()) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const sb = await admin();
    if (!data.questionIds.length) return { ok: true, count: 0 };
    const { error } = await sb
      .from("ipe_questions")
      .update({ verified: true })
      .in("id", data.questionIds);
    if (error) throw error;
    return { ok: true, count: data.questionIds.length };
  });

export const deleteIpeQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ questionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const sb = await admin();
    const { error } = await sb.from("ipe_questions").delete().eq("id", data.questionId);
    if (error) throw error;
    return { ok: true };
  });

/* ---------------- Previous Year Papers Server Functions ---------------- */

export const getIpePreviousPapers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ subjectId: z.string().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const sb = await admin();
    let q = sb.from("ipe_previous_papers").select("*").order("year", { ascending: false });
    if (data.subjectId && data.subjectId !== "all") q = q.eq("subject_id", data.subjectId);
    const { data: papers, error } = await q;
    if (error) {
      if (error.code === "42P01") return [];
      throw error;
    }
    return papers ?? [];
  });

export const addIpePreviousPaper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subjectId: z.string().uuid(),
        year: z.string().trim().min(1),
        paperFileUrl: z.string().optional(),
        structuredQuestionIds: z.array(z.string().uuid()).default([]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const sb = await admin();
    const { data: created, error } = await sb
      .from("ipe_previous_papers")
      .insert({
        subject_id: data.subjectId,
        year: data.year,
        paper_file_url: data.paperFileUrl ?? null,
        structured_question_ids: data.structuredQuestionIds,
      })
      .select("*")
      .single();
    if (error) throw error;
    return created;
  });

/* ---------------- AI generation of TS IPE questions ---------------- */

const AiIpeQuestionSchema = z.object({
  question_type: z.enum(["very_short_answer", "short_answer", "long_answer"]),
  question_text: z.string(),
  expected_answer: z.string(),
  marks: z.number(),
  source_year: z.string().nullable(),
});
const AiIpeBatchSchema = z.object({ questions: z.array(AiIpeQuestionSchema) });

type GenType = "ai_pyq_style" | "exact_pyq";
type Toughness = "easy" | "medium" | "hard" | "extreme";

function ipeGenInstructions(gen: GenType, toughness: Toughness) {
  const base = `You are a senior Telangana State Board of Intermediate Education (TSBIE) examiner who has set Intermediate Public Examination (IPE) papers for 20 years.

SYLLABUS: Strictly the TS Intermediate (1st year / 2nd year) prescribed textbooks. Never go outside the TS Inter syllabus.

QUESTION TYPES (use the exact TSBIE wording style):
- very_short_answer (VSAQ, 2 marks): one-line factual/definition/single-step question.
- short_answer (SAQ, 4 marks): 3-5 step derivation, explanation, or reasoning question.
- long_answer (LAQ, 7-8 marks): full derivation, detailed diagram-based explanation, statement + proof, or complete process description.

LANGUAGE: English only. Never emit Telugu or any non-English script.

FORMATTING (renders with Markdown + KaTeX + mhchem):
- Plain English prose. Use LaTeX ONLY for real formulas and symbols, never for ordinary words.
- Every LaTeX fragment gets its own matching $...$ pair. Never leave an unmatched $.
- Chemistry uses mhchem inside math: $\\ce{H2SO4}$, $\\ce{2SO2(g) + O2(g) <=> 2SO3(g)}$. Never a bare \\ce{...}.
- No "Q1."/"1)" numbering inside question_text. No option letters (these are descriptive questions).

expected_answer: a concise but complete model answer / marking key a teacher can grade against (key points, formula, final result). Keep it under 120 words for VSAQ/SAQ and under 250 words for LAQ.

SELF-VERIFICATION (MANDATORY): re-read every question and model answer before returning; fix unbalanced $, bare macros, truncated text, and anything off-syllabus.`;

  const genRule =
    gen === "exact_pyq"
      ? `MODE — EXACT PREVIOUS YEAR QUESTIONS: return ONLY questions that were actually asked in past TS IPE papers. Reproduce the original wording as faithfully as possible and set source_year to the real exam session, e.g. "March 2019", "March 2023", "May 2022". Never invent a year. If you are not confident a question truly appeared, do not include it.`
      : `MODE — AI GENERATED (previous-year style): create fresh questions that are close variants/modifications of questions actually asked in past TS IPE papers. Set source_year to the session the pattern is modelled on, e.g. "Modelled on March 2022", or null when it is a generic board-style question.`;

  const toughRule = {
    easy: "DIFFICULTY — EASY: direct textbook recall, single-step, frequently repeated board questions.",
    medium: "DIFFICULTY — MEDIUM: standard board level, typical of an average IPE paper.",
    hard: "DIFFICULTY — HARD: the tougher end of board papers — multi-step derivations, less frequently asked items.",
    extreme:
      "DIFFICULTY — EXTREME: the hardest items ever asked in TS IPE — pick from the toughest sessions and long multi-part derivations.",
  }[toughness];

  return `${base}\n\n${genRule}\n\n${toughRule}`;
}

async function generateIpeQuestionSet(opts: {
  subjectName: string;
  year: string;
  chapterNames: string[];
  counts: { very_short_answer: number; short_answer: number; long_answer: number };
  generationType: GenType;
  toughness: Toughness;
  /** e.g. "March 2023" — force the AI to reproduce that exact TS IPE session's paper */
  sessionHint?: string;
}) {
  const key = getAiApiKey();
  if (!key) throw new Error("AI is not configured");
  const gateway = createLovableAiGatewayProvider(key, { structuredOutputs: true });

  const marksFor = (t: keyof typeof opts.counts) =>
    t === "very_short_answer" ? 2 : t === "short_answer" ? 4 : /math/i.test(opts.subjectName) ? 7 : 8;

  const types = (Object.keys(opts.counts) as (keyof typeof opts.counts)[]).filter((t) => opts.counts[t] > 0);

  const batches = await Promise.all(
    types.map(async (t) => {
      const { output } = await generateText({
        model: gateway("openai/gpt-oss-20b"),
        output: Output.object({ schema: AiIpeBatchSchema }),
        providerOptions: {
          groq: {
            reasoningEffort: "low",
            structuredOutputs: true,
            strictJsonSchema: true,
          },
        },
        instructions: ipeGenInstructions(opts.generationType, opts.toughness),
        prompt: `Subject: ${opts.subjectName} (TS Intermediate ${opts.year.replace("_", " ")})
Chapters to cover${opts.chapterNames.length ? "" : " (whole syllabus)"}: ${opts.chapterNames.length ? opts.chapterNames.join("; ") : "all prescribed chapters"}
${opts.sessionHint ? `\nTARGET SESSION: reproduce the questions of the actual TS IPE ${opts.sessionHint} ${opts.subjectName} paper as faithfully as you can. Set source_year to "${opts.sessionHint}" on every question.\n` : ""}
Produce EXACTLY ${opts.counts[t]} questions of type "${t}" worth ${marksFor(t)} marks each. Spread them evenly across the listed chapters and do not repeat a question.`,
      });
      const questions = output.questions
        .slice(0, opts.counts[t])
        .map((q) => ({ ...q, question_type: t, marks: marksFor(t), source_year: opts.sessionHint ?? q.source_year }));
      if (!questions.length) throw new Error(`AI returned no ${t.replaceAll("_", " ")} questions.`);
      return questions;
    }),
  );

  return batches.flat().map((q) => ({
    ...q,
    question_text: repairLatex(q.question_text),
    expected_answer: repairLatex(q.expected_answer),
  }));
}


export const generateIpeQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        subjectId: z.string().uuid(),
        chapterIds: z.array(z.string().uuid()).default([]),
        vsaCount: z.number().int().min(0).max(20).default(10),
        saCount: z.number().int().min(0).max(20).default(8),
        laCount: z.number().int().min(0).max(20).default(3),
        generationType: z.enum(["ai_pyq_style", "exact_pyq"]).default("ai_pyq_style"),
        toughness: z.enum(["easy", "medium", "hard", "extreme"]).default("medium"),
        saveToBank: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const sb = await admin();

    const { data: subject } = await sb.from("ipe_subjects").select("id, name, year").eq("id", data.subjectId).single();
    if (!subject) throw new Error("Subject not found");

    let chapters: any[] = [];
    if (data.chapterIds.length) {
      const { data: rows } = await sb.from("ipe_chapters").select("id, chapter_name").in("id", data.chapterIds);
      chapters = rows ?? [];
    } else {
      const { data: rows } = await sb
        .from("ipe_chapters")
        .select("id, chapter_name")
        .eq("subject_id", data.subjectId)
        .order("chapter_order");
      chapters = rows ?? [];
    }

    const generated = await generateIpeQuestionSet({
      subjectName: subject.name,
      year: subject.year,
      chapterNames: chapters.map((c) => c.chapter_name),
      counts: {
        very_short_answer: data.vsaCount,
        short_answer: data.saCount,
        long_answer: data.laCount,
      },
      generationType: data.generationType,
      toughness: data.toughness,
    });

    if (!data.saveToBank || !chapters.length) return { questions: generated, saved: [] as any[] };

    const inserts = generated.map((q, idx) => ({
      chapter_id: chapters[idx % chapters.length].id,
      question_type: q.question_type,
      question_text: q.question_text,
      expected_answer: q.expected_answer,
      marks: q.marks,
      source: data.generationType === "exact_pyq" ? "previous_year" : "admin_added",
      source_year: q.source_year,
      verified: false,
    }));
    const { data: saved, error } = await sb.from("ipe_questions").insert(inserts).select("*");
    if (error) throw error;
    return { questions: generated, saved: saved ?? [] };
  });

/**
 * Fill the question bank chapter-by-chapter for a whole subject (or a whole year)
 * so every TS Inter chapter has a drillable set of board-style questions.
 */
export const bulkFillIpeQuestionBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        // "all" fills every subject of the given year
        subjectId: z.string().min(1),
        year: z.enum(["1st_year", "2nd_year"]),
        perChapter: z
          .object({
            very_short_answer: z.number().int().min(0).max(10).default(4),
            short_answer: z.number().int().min(0).max(10).default(3),
            long_answer: z.number().int().min(0).max(10).default(2),
          })
          .default({ very_short_answer: 4, short_answer: 3, long_answer: 2 }),
        generationType: z.enum(["ai_pyq_style", "exact_pyq"]).default("exact_pyq"),
        toughness: z.enum(["easy", "medium", "hard", "extreme"]).default("medium"),
        /** only top up chapters that are below the requested per-type counts */
        skipFilled: z.boolean().default(true),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const sb = await admin();

    let subjectQuery = sb.from("ipe_subjects").select("id, name, year").eq("year", data.year);
    if (data.subjectId !== "all") subjectQuery = subjectQuery.eq("id", data.subjectId);
    const { data: subjects } = await subjectQuery;
    if (!subjects?.length) throw new Error("No subjects found for this selection.");

    const { data: chapters } = await sb
      .from("ipe_chapters")
      .select("id, subject_id, chapter_name")
      .in(
        "subject_id",
        subjects.map((s: any) => s.id),
      )
      .order("chapter_order");
    const chapterRows = (chapters ?? []) as any[];
    if (!chapterRows.length) throw new Error("No chapters found. Seed the syllabus first.");

    const { data: existing } = await sb
      .from("ipe_questions")
      .select("chapter_id, question_type")
      .in(
        "chapter_id",
        chapterRows.map((c) => c.id),
      );
    const have = new Map<string, Record<string, number>>();
    for (const row of (existing ?? []) as any[]) {
      const rec = have.get(row.chapter_id) ?? {};
      rec[row.question_type] = (rec[row.question_type] ?? 0) + 1;
      have.set(row.chapter_id, rec);
    }

    const jobs = chapterRows
      .map((c) => {
        const subject = subjects.find((s: any) => s.id === c.subject_id)!;
        const rec = have.get(c.id) ?? {};
        const need = {
          very_short_answer: Math.max(
            0,
            data.perChapter.very_short_answer - (data.skipFilled ? (rec.very_short_answer ?? 0) : 0),
          ),
          short_answer: Math.max(0, data.perChapter.short_answer - (data.skipFilled ? (rec.short_answer ?? 0) : 0)),
          long_answer: Math.max(0, data.perChapter.long_answer - (data.skipFilled ? (rec.long_answer ?? 0) : 0)),
        };
        return { chapter: c, subject, need };
      })
      .filter((j) => j.need.very_short_answer + j.need.short_answer + j.need.long_answer > 0);

    let inserted = 0;
    const failures: string[] = [];
    const CONCURRENCY = 4;
    for (let i = 0; i < jobs.length; i += CONCURRENCY) {
      const slice = jobs.slice(i, i + CONCURRENCY);
      await Promise.all(
        slice.map(async (job) => {
          try {
            const generated = await generateIpeQuestionSet({
              subjectName: job.subject.name,
              year: job.subject.year,
              chapterNames: [job.chapter.chapter_name],
              counts: job.need,
              generationType: data.generationType,
              toughness: data.toughness,
            });
            if (!generated.length) return;
            const { error } = await sb.from("ipe_questions").insert(
              generated.map((q) => ({
                chapter_id: job.chapter.id,
                question_type: q.question_type,
                question_text: q.question_text,
                expected_answer: q.expected_answer,
                marks: q.marks,
                source: data.generationType === "exact_pyq" ? "previous_year" : "admin_added",
                source_year: q.source_year,
                verified: false,
              })),
            );
            if (error) throw error;
            inserted += generated.length;
          } catch (e) {
            failures.push(`${job.subject.name} — ${job.chapter.chapter_name}`);
          }
        }),
      );
    }

    return { inserted, chaptersProcessed: jobs.length, failures };
  });


/* ---------------- IPE Exam Creation Server Functions ---------------- */

export const createIpeExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        year: z.enum(["1st_year", "2nd_year"]),
        subjectId: z.string().min(1),
        // Mode A: bank blueprint · Mode B: verbatim PYQ paper · Mode C: manual pick · Mode D: AI generated
        mode: z.enum(["mode_a", "mode_b", "mode_c", "mode_d"]),
        durationMinutes: z.number().int().min(1).max(600).optional(),
        accessCode: z.string().trim().min(1).max(20).optional(),
        showResultAfterSubmit: z.boolean().default(true),
        answerSheetRequired: z.boolean().default(true),
        studentIds: z.array(z.string().uuid()).default([]),
        // Mode A specific inputs
        chapterIds: z.array(z.string().uuid()).optional(),
        useBlueprint: z.boolean().default(true),
        vsaCount: z.number().int().min(0).optional(),
        saCount: z.number().int().min(0).optional(),
        laCount: z.number().int().min(0).optional(),
        // Mode B specific inputs — AI reproduces the actual paper of this TS IPE session
        pyqSession: z.string().trim().min(1).max(40).optional(),
        previousPaperId: z.string().uuid().optional(),
        // Mode C & explicit questions input
        questionIds: z.array(z.string().uuid()).optional(),
        // Mode D specific inputs
        generationType: z.enum(["ai_pyq_style", "exact_pyq"]).default("ai_pyq_style"),
        toughness: z.enum(["easy", "medium", "hard", "extreme"]).default("medium"),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const sb = await admin();

    let subjectName = "";
    if (data.subjectId !== "all") {
      const { data: subj } = await sb.from("ipe_subjects").select("name").eq("id", data.subjectId).maybeSingle();
      subjectName = subj?.name ?? "";
    }
    const blueprint = blueprintForSubject(subjectName);
    const bpCount = (k: string) => blueprint.sections.find((s) => s.key === k)?.count ?? 0;

    const wanted = data.useBlueprint
      ? {
          very_short_answer: bpCount("very_short_answer"),
          short_answer: bpCount("short_answer"),
          long_answer: bpCount("long_answer"),
        }
      : {
          very_short_answer: data.vsaCount ?? bpCount("very_short_answer"),
          short_answer: data.saCount ?? bpCount("short_answer"),
          long_answer: data.laCount ?? bpCount("long_answer"),
        };

    let selectedQuestionRows: any[] = [];

    if (data.mode === "mode_d") {
      if (data.subjectId === "all") throw new Error("Pick a single subject for AI generation.");
      const { data: subject } = await sb
        .from("ipe_subjects")
        .select("id, name, year")
        .eq("id", data.subjectId)
        .single();
      let chapters: any[] = [];
      if (data.chapterIds?.length) {
        const { data: rows } = await sb.from("ipe_chapters").select("id, chapter_name").in("id", data.chapterIds);
        chapters = rows ?? [];
      } else {
        const { data: rows } = await sb
          .from("ipe_chapters")
          .select("id, chapter_name")
          .eq("subject_id", data.subjectId)
          .order("chapter_order");
        chapters = rows ?? [];
      }
      const generated = await generateIpeQuestionSet({
        subjectName: subject?.name ?? subjectName,
        year: subject?.year ?? data.year,
        chapterNames: chapters.map((c) => c.chapter_name),
        counts: wanted,
        generationType: data.generationType,
        toughness: data.toughness,
      });
      if (chapters.length) {
        // Keep every generated question in the bank for reuse (unverified until reviewed).
        await sb.from("ipe_questions").insert(
          generated.map((q, idx) => ({
            chapter_id: chapters[idx % chapters.length].id,
            question_type: q.question_type,
            question_text: q.question_text,
            expected_answer: q.expected_answer,
            marks: q.marks,
            source: data.generationType === "exact_pyq" ? "previous_year" : "admin_added",
            source_year: q.source_year,
            verified: false,
          })),
        );
      }
      selectedQuestionRows = generated.map((q) => ({
        question_type: q.question_type,
        question_text: q.question_text,
        expected_answer: q.expected_answer,
        marks: q.marks,
        source: data.generationType === "exact_pyq" ? "previous_year" : "admin_added",
        source_year: q.source_year,
      }));
    } else if (data.mode === "mode_b") {
      // Mode B: the AI reproduces the actual previous-year TS IPE paper for the chosen session.
      if (data.subjectId === "all") throw new Error("Pick a single subject for a previous-year paper.");
      const { data: subject } = await sb
        .from("ipe_subjects")
        .select("id, name, year")
        .eq("id", data.subjectId)
        .maybeSingle();
      const { data: chaps } = await sb
        .from("ipe_chapters")
        .select("chapter_name")
        .eq("subject_id", data.subjectId)
        .order("chapter_order");
      const session = data.pyqSession?.trim() || "March 2023";
      const generated = await generateIpeQuestionSet({
        subjectName: subject?.name ?? subjectName,
        year: subject?.year ?? data.year,
        chapterNames: (chaps ?? []).map((c: any) => c.chapter_name),
        counts: wanted,
        generationType: "exact_pyq",
        toughness: data.toughness,
        sessionHint: session,
      });
      selectedQuestionRows = generated.map((q) => ({
        question_type: q.question_type,
        question_text: q.question_text,
        expected_answer: q.expected_answer,
        marks: q.marks,
        source: "previous_year",
        source_year: q.source_year ?? session,
      }));
    } else if (data.mode === "mode_c" && data.questionIds?.length) {
      const { data: qs } = await sb.from("ipe_questions").select("*").in("id", data.questionIds);
      selectedQuestionRows = qs ?? [];
    } else {
      // Mode A: pull the blueprint's question mix out of the bank
      let qBuilder = sb.from("ipe_questions").select("*");
      let bankChapterIds: string[] = data.chapterIds ?? [];
      if (data.chapterIds?.length) {
        qBuilder = qBuilder.in("chapter_id", data.chapterIds);
      } else if (data.subjectId === "all") {
        const { data: yearSubs } = await sb.from("ipe_subjects").select("id").eq("year", data.year);
        const subIds = (yearSubs ?? []).map((s: any) => s.id);
        if (subIds.length) {
          const { data: chaps } = await sb.from("ipe_chapters").select("id").in("subject_id", subIds);
          const cids = (chaps ?? []).map((c: any) => c.id);
          bankChapterIds = cids;
          if (cids.length) qBuilder = qBuilder.in("chapter_id", cids);
        }
      } else {
        const { data: chaps } = await sb.from("ipe_chapters").select("id").eq("subject_id", data.subjectId);
        const cids = (chaps ?? []).map((c: any) => c.id);
        bankChapterIds = cids;
        if (cids.length) qBuilder = qBuilder.in("chapter_id", cids);
      }
      const { data: allBankQs } = await qBuilder;
      const bank = (allBankQs ?? []) as any[];
      const pick = (t: string, n: number) => bank.filter((q: any) => q.question_type === t).slice(0, n);

      selectedQuestionRows = [
        ...pick("very_short_answer", wanted.very_short_answer),
        ...pick("short_answer", wanted.short_answer),
        ...pick("long_answer", wanted.long_answer),
      ];

      // Top up any shortfall with AI-generated board-style questions instead of failing.
      const shortfall = {
        very_short_answer: Math.max(0, wanted.very_short_answer - pick("very_short_answer", wanted.very_short_answer).length),
        short_answer: Math.max(0, wanted.short_answer - pick("short_answer", wanted.short_answer).length),
        long_answer: Math.max(0, wanted.long_answer - pick("long_answer", wanted.long_answer).length),
      };
      const missing = shortfall.very_short_answer + shortfall.short_answer + shortfall.long_answer;
      if (missing > 0) {
        if (data.subjectId === "all") {
          throw new Error(
            "The question bank does not have enough questions for this year. Use the Question Bank tab to AI-fill the syllabus, or pick a single subject.",
          );
        }
        const { data: subject } = await sb
          .from("ipe_subjects")
          .select("id, name, year")
          .eq("id", data.subjectId)
          .maybeSingle();
        const { data: chapRows } = await sb
          .from("ipe_chapters")
          .select("id, chapter_name")
          .eq("subject_id", data.subjectId)
          .order("chapter_order");
        const chapterList = (chapRows ?? []) as any[];
        const topUp = await generateIpeQuestionSet({
          subjectName: subject?.name ?? subjectName,
          year: subject?.year ?? data.year,
          chapterNames: chapterList.map((c) => c.chapter_name),
          counts: shortfall,
          generationType: data.generationType,
          toughness: data.toughness,
        });
        if (chapterList.length && topUp.length) {
          await sb.from("ipe_questions").insert(
            topUp.map((q, idx) => ({
              chapter_id: chapterList[idx % chapterList.length].id,
              question_type: q.question_type,
              question_text: q.question_text,
              expected_answer: q.expected_answer,
              marks: q.marks,
              source: data.generationType === "exact_pyq" ? "previous_year" : "admin_added",
              source_year: q.source_year,
              verified: false,
            })),
          );
        }
        selectedQuestionRows = [
          ...selectedQuestionRows,
          ...topUp.map((q) => ({
            question_type: q.question_type,
            question_text: q.question_text,
            expected_answer: q.expected_answer,
            marks: q.marks,
            source: data.generationType === "exact_pyq" ? "previous_year" : "admin_added",
            source_year: q.source_year,
          })),
        ];
      }
      void bankChapterIds;
    }


    if (!selectedQuestionRows.length) {
      throw new Error("No questions available for the selected criteria. Please add questions to the Question Bank first.");
    }

    // Order the paper strictly Section A -> B -> C
    const typeOrder = { very_short_answer: 0, short_answer: 1, long_answer: 2 } as Record<string, number>;
    selectedQuestionRows.sort((a, b) => (typeOrder[a.question_type] ?? 9) - (typeOrder[b.question_type] ?? 9));

    const sections = blueprint.sections
      .map((s) => {
        const printed = selectedQuestionRows.filter((q) => q.question_type === s.key).length;
        if (!printed) return null;
        const attempt = Math.min(s.attempt_limit, printed);
        return {
          key: s.key,
          name: s.name,
          count: printed,
          marks_per_q: s.marks_per_q,
          attempt_limit: attempt,
        };
      })
      .filter(Boolean) as { key: string; name: string; count: number; marks_per_q: number; attempt_limit: number }[];

    const totalMarks = sections.reduce((n, s) => n + s.attempt_limit * s.marks_per_q, 0);
    const accessCode = data.accessCode?.trim().toUpperCase() || randomAccessCode();
    const duration = data.durationMinutes ?? blueprint.duration_minutes;

    const patternConfig = {
      is_ipe: true,
      descriptive_only: true,
      mode: data.mode,
      subject_id: data.subjectId,
      subject_name: subjectName,
      year: data.year,
      blueprint: blueprint.id,
      blueprint_max_marks: blueprintMaxMarks(blueprint),
      answer_sheet_required: data.answerSheetRequired,
      generation_type: data.mode === "mode_d" ? data.generationType : undefined,
      toughness: data.mode === "mode_d" ? data.toughness : undefined,
      sections,
    };

    const { data: examRow, error: examErr } = await sb
      .from("exams")
      .insert({
        title: data.title,
        access_code: accessCode,
        duration_minutes: duration,
        pattern: "ipe",
        pattern_config: patternConfig,
        total_marks: totalMarks,
        negative_mark_per_wrong: 0,
        show_result_after_submit: data.showResultAfterSubmit,
        show_answer_sheet: true,
        show_answer_book: true,
        created_by: context.userId,
      })
      .select("*")
      .single();

    if (examErr || !examRow) throw examErr || new Error("Failed to create exam");

    const qInserts = selectedQuestionRows.map((q, idx) => ({
      exam_id: examRow.id,
      order_index: idx,
      type: "short", // descriptive — answered on paper, not on screen
      prompt: q.question_text,
      options: null,
      correct_answer: q.expected_answer ? [q.expected_answer] : null,
      marks: q.marks ?? 2,
      topic: `${sectionLabel(q.question_type)} (${q.marks} Marks)`,
      difficulty: data.mode === "mode_d" ? data.toughness : "medium",
      source_ref:
        q.source === "previous_year"
          ? `TS IPE ${q.source_year ?? "Previous Year"}`
          : q.source_year
            ? String(q.source_year)
            : "TS IPE model question",
    }));

    const { error: qErr } = await sb.from("questions").insert(qInserts);
    if (qErr) throw qErr;

    if (data.studentIds.length) {
      const asgInserts = data.studentIds.map((sid) => ({
        exam_id: examRow.id,
        student_id: sid,
        assigned_by: context.userId,
        max_attempts: 1,
      }));
      await sb.from("assignments").insert(asgInserts);
    }

    return { examId: examRow.id, accessCode, totalMarks, durationMinutes: duration, sections };
  });

/* ---------------- Answer Sheet Image Handling ---------------- */

export const uploadAnswerSheetImages = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        attemptId: z.string().uuid(),
        sessionToken: z.string().min(10),
        images: z.array(
          z.object({
            imageUrl: z.string().min(1),
            pageNumber: z.number().int().min(1),
          }),
        ),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: att } = await sb
      .from("attempts")
      .select("id, session_token")
      .eq("id", data.attemptId)
      .single();

    if (!att || att.session_token !== data.sessionToken) {
      throw new Error("Invalid session token");
    }

    // Delete prior uploads for this attempt if retaking
    await sb.from("attempt_answer_sheet_images").delete().eq("attempt_id", data.attemptId);

    const inserts = data.images.map((img) => ({
      attempt_id: data.attemptId,
      image_url: img.imageUrl,
      page_number: img.pageNumber,
    }));

    const { data: created, error } = await sb
      .from("attempt_answer_sheet_images")
      .insert(inserts)
      .select("id, page_number, uploaded_at");

    if (error) {
      if (error.code === "42P01") {
        return { ok: true, count: data.images.length };
      }
      throw error;
    }
    return { ok: true, count: (created ?? []).length };
  });

/** Teacher-only: the answer sheet photos of one attempt on an exam the caller owns. */
export const getAttemptAnswerSheetImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ attemptId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    // RLS on attempt_answer_sheet_images already restricts rows to the exam owner.
    const { data: images, error } = await (context.supabase as any)
      .from("attempt_answer_sheet_images")
      .select("id, image_url, page_number, uploaded_at")
      .eq("attempt_id", data.attemptId)
      .order("page_number", { ascending: true });

    if (error) {
      if (error.code === "42P01") return [];
      throw error;
    }
    return images ?? [];
  });

/* ---------------- Teacher evaluation of descriptive answer sheets ---------------- */

async function loadGradableAttempt(context: { supabase: any; userId: string }, attemptId: string) {
  const { data: att } = await context.supabase
    .from("attempts")
    .select("id, exam_id, student_id, status, score, max_score, marks_published, grader_notes, question_order")
    .eq("id", attemptId)
    .maybeSingle();
  if (!att) throw new Error("Attempt not found");

  const { data: exam } = await context.supabase
    .from("exams")
    .select("id, title, created_by, total_marks, pattern_config")
    .eq("id", att.exam_id)
    .maybeSingle();
  if (!exam || exam.created_by !== context.userId) throw new Error("Forbidden");

  return { att, exam };
}

/** Teacher-only: questions + current marks + uploaded pages for the grading screen. */
export const getIpeGradingSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ attemptId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const { att, exam } = await loadGradableAttempt(context, data.attemptId);

    const [{ data: qs }, { data: ans }, { data: images }, { data: student }] = await Promise.all([
      context.supabase
        .from("questions")
        .select("id, prompt, marks, topic, correct_answer, source_ref, order_index")
        .eq("exam_id", att.exam_id)
        .order("order_index"),
      context.supabase
        .from("answers")
        .select("question_id, marks_awarded, grader_feedback")
        .eq("attempt_id", att.id),
      (context.supabase as any)
        .from("attempt_answer_sheet_images")
        .select("id, image_url, page_number")
        .eq("attempt_id", att.id)
        .order("page_number", { ascending: true }),
      context.supabase.from("students").select("id, name, student_code").eq("id", att.student_id).maybeSingle(),
    ]);

    const ansMap = new Map((ans ?? []).map((a: any) => [a.question_id, a]));
    return {
      exam: { id: exam.id, title: exam.title, totalMarks: exam.total_marks, patternConfig: exam.pattern_config },
      student: student ?? null,
      attempt: {
        id: att.id,
        status: att.status,
        score: Number(att.score ?? 0),
        maxScore: Number(att.max_score ?? exam.total_marks ?? 0),
        marksPublished: !!att.marks_published,
        graderNotes: att.grader_notes ?? "",
      },
      questions: (qs ?? []).map((q: any) => ({
        id: q.id,
        prompt: q.prompt,
        marks: q.marks,
        topic: q.topic,
        section: q.topic,
        modelAnswer: Array.isArray(q.correct_answer) ? (q.correct_answer[0] ?? null) : null,
        sourceRef: q.source_ref ?? null,
        marksAwarded: Number((ansMap.get(q.id) as any)?.marks_awarded ?? 0),
        feedback: ((ansMap.get(q.id) as any)?.grader_feedback as string | null) ?? "",
      })),
      answerSheetImages: images ?? [],
    };
  });

const GradeRowSchema = z.object({
  questionId: z.string().uuid(),
  marksAwarded: z.number().min(0).max(100),
  feedback: z.string().max(4000).optional(),
});

async function persistGrades(
  sb: any,
  attemptId: string,
  maxScore: number,
  grades: { questionId: string; marksAwarded: number; feedback?: string | null }[],
  notes?: string | null,
) {
  for (const g of grades) {
    const { data: existing } = await sb
      .from("answers")
      .select("id")
      .eq("attempt_id", attemptId)
      .eq("question_id", g.questionId)
      .maybeSingle();
    const payload = {
      marks_awarded: g.marksAwarded,
      grader_feedback: g.feedback ?? null,
      is_correct: null as boolean | null,
      updated_at: new Date().toISOString(),
    };
    if (existing?.id) {
      await sb.from("answers").update(payload).eq("id", existing.id);
    } else {
      await sb.from("answers").insert({ attempt_id: attemptId, question_id: g.questionId, ...payload });
    }
  }

  const score = grades.reduce((n, g) => n + Number(g.marksAwarded || 0), 0);
  const update: Record<string, unknown> = {
    score,
    max_score: maxScore,
    graded_at: new Date().toISOString(),
  };
  if (notes !== undefined) update.grader_notes = notes;
  await sb.from("attempts").update(update).eq("id", attemptId);
  return score;
}

/** Teacher-only: save manually entered marks. Marks stay hidden until published. */
export const saveIpeGrades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        attemptId: z.string().uuid(),
        grades: z.array(GradeRowSchema),
        notes: z.string().max(4000).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const { exam } = await loadGradableAttempt(context, data.attemptId);
    const sb = await admin();
    const score = await persistGrades(
      sb,
      data.attemptId,
      Number(exam.total_marks ?? 0),
      data.grades,
      data.notes ?? null,
    );
    return { ok: true, score };
  });

/** Teacher-only: publish or unpublish the evaluated marks to the student. */
export const setIpeMarksPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ attemptId: z.string().uuid(), published: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    await loadGradableAttempt(context, data.attemptId);
    const sb = await admin();
    await sb.from("attempts").update({ marks_published: data.published }).eq("id", data.attemptId);
    return { ok: true, published: data.published };
  });

/** Teacher-only: AI reads the uploaded answer-sheet photos and proposes marks per question. */
export const aiEvaluateIpeAnswerSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ attemptId: z.string().uuid(), apply: z.boolean().default(false) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const { att, exam } = await loadGradableAttempt(context, data.attemptId);
    const sb = await admin();

    const [{ data: qs }, { data: images }] = await Promise.all([
      sb
        .from("questions")
        .select("id, prompt, marks, topic, correct_answer, order_index")
        .eq("exam_id", att.exam_id)
        .order("order_index"),
      sb
        .from("attempt_answer_sheet_images")
        .select("image_url, page_number")
        .eq("attempt_id", att.id)
        .order("page_number", { ascending: true }),
    ]);

    const questions = qs ?? [];
    const pages = images ?? [];
    if (!questions.length) throw new Error("This exam has no questions to evaluate.");
    if (!pages.length) throw new Error("The student has not uploaded any answer sheet pages for this attempt.");

    const key = getVisionApiKey();
    if (!key) throw new Error("AI is not configured");
    const gateway = createVisionProvider(key);

    const EvalSchema = z.object({
      grades: z.array(
        z.object({
          question_number: z.number().int().min(1),
          marks_awarded: z.number().min(0),
          feedback: z.string(),
        }),
      ),
      overall_feedback: z.string(),
      weak_topics: z.array(z.string()),
      strong_topics: z.array(z.string()),
    });

    const paper = questions
      .map(
        (q: any, i: number) =>
          `Q${i + 1} [${q.topic ?? ""}] (max ${q.marks} marks)\nQuestion: ${q.prompt}\nModel answer / marking key: ${
            Array.isArray(q.correct_answer) ? (q.correct_answer[0] ?? "not provided") : "not provided"
          }`,
      )
      .join("\n\n");

    const { output } = await generateText({
      model: gateway("google/gemini-3.5-flash"),
      output: Output.object({ schema: EvalSchema }),
      instructions: `You are an experienced TS Intermediate Board (TSBIE) evaluator marking a handwritten descriptive answer script.

RULES:
- The images are photographs of the student's handwritten answer booklet pages, in page order.
- Match each answered question to its question number on the printed paper. Students may answer in any order and may skip questions (the paper carries internal choice).
- Award marks the way a board evaluator does: step marks for correct steps, formula, diagram, final answer. Never exceed the question's maximum marks. Award 0 if the question was not attempted or is illegible/blank.
- feedback: 1-3 short sentences per question — what earned marks and what was missing. Plain English.
- Return EXACTLY one entry per question number of the printed paper, in order, even when unattempted.
- If handwriting is unreadable for a question, award 0 and say "Could not read the answer — please verify manually."
- Use $...$ / mhchem for any formula in feedback. No emojis.

Your marks are a PROPOSAL that the teacher will review and can edit before publishing.`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Exam: ${exam.title}\n\nPRINTED QUESTION PAPER:\n\n${paper}\n\nNow evaluate the ${pages.length} attached answer-sheet page image(s).`,
            },
            ...pages.map((p: any) => ({ type: "image" as const, image: p.image_url })),
          ] as any,
        },
      ],
    });

    const grades = questions.map((q: any, i: number) => {
      const g = output.grades.find((x) => x.question_number === i + 1);
      const awarded = Math.max(0, Math.min(Number(q.marks ?? 0), Number(g?.marks_awarded ?? 0)));
      return { questionId: q.id, marksAwarded: awarded, feedback: g?.feedback ?? "" };
    });

    if (data.apply) {
      await persistGrades(sb, att.id, Number(exam.total_marks ?? 0), grades);
      await sb.from("insights").delete().eq("attempt_id", att.id);
      await sb.from("insights").insert({
        attempt_id: att.id,
        summary: output.overall_feedback,
        weak_topics: output.weak_topics,
        strong_topics: output.strong_topics,
        recommendations: output.overall_feedback,
      });
    }

    return {
      applied: data.apply,
      proposedScore: grades.reduce((n: number, g: { marksAwarded: number }) => n + g.marksAwarded, 0),
      maxScore: Number(exam.total_marks ?? 0),
      grades,
      overallFeedback: output.overall_feedback,
      weakTopics: output.weak_topics,
      strongTopics: output.strong_topics,
    };
  });

