import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PatternEnum = z.enum(["neet", "eamcet", "mains", "custom"]);

const DraftPayload = z.object({
  id: z.string().uuid().optional().nullable(),
  title: z.string().max(200).default(""),
  pattern: PatternEnum.default("neet"),
  pattern_config: z.any().nullable().optional(),
  questions: z.array(z.any()).default([]),
  show_result_after_submit: z.boolean().default(true),
  show_answer_sheet: z.boolean().default(true),
  show_answer_book: z.boolean().default(true),
});

export const getLatestDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("exam_drafts")
      .select("*")
      .eq("owner_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? null;
  });

export const listDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("exam_drafts")
      .select("id, title, pattern, questions, updated_at, created_at")
      .eq("owner_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((d: any) => ({
      id: d.id as string,
      title: (d.title as string) || "",
      pattern: (d.pattern as string) || "neet",
      questionCount: Array.isArray(d.questions) ? d.questions.length : 0,
      updated_at: d.updated_at as string,
      created_at: d.created_at as string,
    }));
  });

export const getDraft = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("exam_drafts")
      .select("*")
      .eq("id", data.id)
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? null;
  });


export const saveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DraftPayload.parse(input))
  .handler(async ({ data, context }) => {
    const row = {
      owner_id: context.userId,
      title: data.title,
      pattern: data.pattern,
      pattern_config: data.pattern_config ?? null,
      questions: data.questions,
      show_result_after_submit: data.show_result_after_submit,
      show_answer_sheet: data.show_answer_sheet,
      show_answer_book: data.show_answer_book,
    };
    if (data.id) {
      const { data: up, error } = await context.supabase
        .from("exam_drafts")
        .update(row)
        .eq("id", data.id)
        .eq("owner_id", context.userId)
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (up?.id) return { id: up.id };
    }
    const { data: ins, error: insErr } = await context.supabase
      .from("exam_drafts")
      .insert(row)
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);
    return { id: ins.id as string };
  });

export const deleteDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("exam_drafts")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
