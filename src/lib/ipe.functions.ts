import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { repairLatex } from "./latex-repair";
import { SEED_SUBJECTS } from "./ipe-seed-data";

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
        subjectId: z.string().uuid().optional(),
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
    } else if (data.subjectId) {
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
  .inputValidator((i: unknown) => z.object({ subjectId: z.string().uuid().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const sb = await admin();
    let q = sb.from("ipe_previous_papers").select("*").order("year", { ascending: false });
    if (data.subjectId) q = q.eq("subject_id", data.subjectId);
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

/* ---------------- IPE Exam Creation Server Functions ---------------- */

export const createIpeExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        year: z.enum(["1st_year", "2nd_year"]),
        subjectId: z.string().uuid(),
        mode: z.enum(["mode_a", "mode_b", "mode_c"]), // Mode A: Combination, Mode B: Verbatim PYQ, Mode C: Manual selection
        durationMinutes: z.number().int().min(1).max(600),
        accessCode: z.string().trim().min(1).max(20).optional(),
        showResultAfterSubmit: z.boolean().default(true),
        answerSheetRequired: z.boolean().default(true),
        studentIds: z.array(z.string().uuid()).default([]),
        // Mode A specific inputs
        chapterIds: z.array(z.string().uuid()).optional(),
        vsaCount: z.number().int().min(0).default(10),
        saCount: z.number().int().min(0).default(6),
        laCount: z.number().int().min(0).default(2),
        // Mode B specific inputs
        previousPaperId: z.string().uuid().optional(),
        // Mode C & explicit questions input
        questionIds: z.array(z.string().uuid()).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdminRole(context);
    const sb = await admin();

    let selectedQuestionRows: any[] = [];

    if (data.mode === "mode_b" && data.previousPaperId) {
      const { data: paper } = await sb
        .from("ipe_previous_papers")
        .select("structured_question_ids")
        .eq("id", data.previousPaperId)
        .single();
      const qids = (paper?.structured_question_ids as string[]) ?? [];
      if (qids.length) {
        const { data: qs } = await sb.from("ipe_questions").select("*").in("id", qids);
        selectedQuestionRows = qs ?? [];
      }
    } else if (data.mode === "mode_c" && data.questionIds?.length) {
      const { data: qs } = await sb.from("ipe_questions").select("*").in("id", data.questionIds);
      selectedQuestionRows = qs ?? [];
    } else {
      // Mode A or fallback Mode C: Pull from chapterIds / bank
      let qBuilder = sb.from("ipe_questions").select("*");
      if (data.chapterIds?.length) {
        qBuilder = qBuilder.in("chapter_id", data.chapterIds);
      } else {
        const { data: chaps } = await sb.from("ipe_chapters").select("id").eq("subject_id", data.subjectId);
        const cids = (chaps ?? []).map((c: any) => c.id);
        if (cids.length) qBuilder = qBuilder.in("chapter_id", cids);
      }
      const { data: allBankQs } = await qBuilder;
      const bank = (allBankQs ?? []) as any[];

      const vsa = bank.filter((q: any) => q.question_type === "very_short_answer");
      const sa = bank.filter((q: any) => q.question_type === "short_answer");
      const la = bank.filter((q: any) => q.question_type === "long_answer");

      const pickedVsa = vsa.slice(0, data.vsaCount);
      const pickedSa = sa.slice(0, data.saCount);
      const pickedLa = la.slice(0, data.laCount);

      selectedQuestionRows = [...pickedVsa, ...pickedSa, ...pickedLa];
    }

    if (!selectedQuestionRows.length) {
      throw new Error("No questions available for the selected criteria. Please add questions to the Question Bank first.");
    }

    const totalMarks = selectedQuestionRows.reduce((acc, q) => acc + (q.marks ?? 2), 0);
    const accessCode = data.accessCode?.trim().toUpperCase() || randomAccessCode();

    const patternConfig = {
      is_ipe: true,
      mode: data.mode,
      subject_id: data.subjectId,
      year: data.year,
      answer_sheet_required: data.answerSheetRequired,
      sections: [
        { name: "Very Short Answer", count: selectedQuestionRows.filter((q) => q.question_type === "very_short_answer").length, marks_per_q: 2 },
        { name: "Short Answer", count: selectedQuestionRows.filter((q) => q.question_type === "short_answer").length, marks_per_q: 4 },
        { name: "Long Answer", count: selectedQuestionRows.filter((q) => q.question_type === "long_answer").length, marks_per_q: 8 },
      ].filter((s) => s.count > 0),
    };

    const { data: examRow, error: examErr } = await sb
      .from("exams")
      .insert({
        title: data.title,
        access_code: accessCode,
        duration_minutes: data.durationMinutes,
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

    // Convert IPE questions to standard exam questions
    const qInserts = selectedQuestionRows.map((q, idx) => ({
      exam_id: examRow.id,
      order_index: idx,
      type: "short", // rendered as descriptive/short text field during exam
      prompt: q.question_text,
      options: null,
      correct_answer: null,
      marks: q.marks ?? 2,
      topic: `${q.question_type.replace(/_/g, " ").toUpperCase()} (${q.marks} Marks)`,
      difficulty: "medium",
      source_ref: q.source === "previous_year" ? `PYQ ${q.source_year ?? ""}` : q.source,
    }));

    const { error: qErr } = await sb.from("questions").insert(qInserts);
    if (qErr) throw qErr;

    // Assign to students if specified
    if (data.studentIds.length) {
      const asgInserts = data.studentIds.map((sid) => ({
        exam_id: examRow.id,
        student_id: sid,
        assigned_by: context.userId,
        max_attempts: 1,
      }));
      await sb.from("assignments").insert(asgInserts);
    }

    return { examId: examRow.id, accessCode };
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
      .select("*");

    if (error) {
      if (error.code === "42P01") {
        // Table not created yet in Supabase environment, return input gracefully
        return { ok: true, images: data.images };
      }
      throw error;
    }
    return { ok: true, images: created ?? [] };
  });

export const getAttemptAnswerSheetImages = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ attemptId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: images, error } = await sb
      .from("attempt_answer_sheet_images")
      .select("*")
      .eq("attempt_id", data.attemptId)
      .order("page_number", { ascending: true });

    if (error) {
      if (error.code === "42P01") return [];
      throw error;
    }
    return images ?? [];
  });
