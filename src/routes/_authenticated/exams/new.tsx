import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";
import { NumberField } from "@/components/NumberField";
import { PatternPicker } from "@/components/PatternPicker";
import { QuestionSource, type GeneratedQuestion } from "@/components/QuestionSource";
import { createExam } from "@/lib/admin.functions";
import { getLatestDraft, getDraft, saveDraft, deleteDraft } from "@/lib/drafts.functions";
import { z } from "zod";
import { type ExamPattern, type PatternConfig, presetToConfig } from "@/lib/exam-patterns";
import { RichContent } from "@/components/RichContent";
import { useEffect, useRef } from "react";



function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/exams/new")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ draftId: z.string().uuid().optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "New exam — ExamPrep" },
      { name: "description", content: "Pick an exam pattern (NEET, EAMCET, JEE Main, or Custom) and let AI generate the questions." },
      { property: "og:title", content: "New exam — ExamPrep" },
      { property: "og:description", content: "Pick an exam pattern (NEET, EAMCET, JEE Main, or Custom) and let AI generate the questions." },
    ],
  }),
  component: NewExam,
});

function NewExam() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [pattern, setPattern] = useState<ExamPattern>("neet");
  const [config, setConfig] = useState<PatternConfig | null>(presetToConfig("neet"));
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [showResult, setShowResult] = useState(true);
  const [showSheet, setShowSheet] = useState(true);
  const [showBook, setShowBook] = useState(true);
  const [restored, setRestored] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">("idle");
  const skipNextSave = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore draft from cloud (once)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await getLatestDraft();
        if (cancelled || !d) return;
        skipNextSave.current = true;
        setDraftId(d.id);
        if (d.title) setTitle(d.title);
        if (d.pattern) setPattern(d.pattern as ExamPattern);
        if (d.pattern_config) setConfig(d.pattern_config as PatternConfig);

        if (Array.isArray(d.questions)) setQuestions(d.questions as GeneratedQuestion[]);
        if (typeof d.show_result_after_submit === "boolean") setShowResult(d.show_result_after_submit);
        if (typeof d.show_answer_sheet === "boolean") setShowSheet(d.show_answer_sheet);
        if (typeof d.show_answer_book === "boolean") setShowBook(d.show_answer_book);
        if (d.title || (Array.isArray(d.questions) && d.questions.length)) {
          toast.message("Draft restored", { description: "Your unsaved exam was recovered from the cloud." });
        }
      } catch { /* ignore */ }
      if (!cancelled) setRestored(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Debounced cloud save on every change
  useEffect(() => {
    if (!restored) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    const isEmpty = !title.trim() && questions.length === 0;
    if (isEmpty) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setDraftStatus("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        const r = await saveDraft({
          data: {
            id: draftId,
            title,
            pattern,
            pattern_config: config,
            questions,
            show_result_after_submit: showResult,
            show_answer_sheet: showSheet,
            show_answer_book: showBook,
          },
        });
        if (r?.id && r.id !== draftId) setDraftId(r.id);
        setDraftStatus("saved");
      } catch {
        setDraftStatus("idle");
      }
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [restored, draftId, title, pattern, config, questions, showResult, showSheet, showBook]);

  const clearDraft = async () => {
    if (draftId) {
      try { await deleteDraft({ data: { id: draftId } }); } catch { /* ignore */ }
    }
    setDraftId(null);
    setTitle("");
    setQuestions([]);
    setDraftStatus("idle");
    toast.success("Draft cleared");
  };


  const duration = config?.duration_minutes ?? 60;
  const subjects = config?.sections.map((s) => s.name) ?? [];

  const save = async () => {
    if (!title.trim()) return toast.error("Title required");
    setSaving(true);
    try {
      const r = await createExam({
        data: {
          title: title.trim(),
          duration_minutes: duration,
          questions,
          pattern,
          pattern_config: config,
          negative_mark_per_wrong: config?.negative_mark_per_wrong ?? 0,
          show_result_after_submit: showResult,
          show_answer_sheet: showSheet,
          show_answer_book: showBook,
        },
      });
      toast.success(`Exam created — password ${r.access_code}`);
      if (draftId) { try { await deleteDraft({ data: { id: draftId } }); } catch { /* ignore */ } }
      navigate({ to: "/exams/$examId", params: { examId: r.id } });

    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  };


  return (
    <AppShell title="New exam">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Exam details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="t">Title</Label>
                <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. NEET Mock 1 — Aug" />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  A 6-character exam password is generated automatically.
                </p>
              </div>

              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">After submission</div>
                <ToggleRow label="Show result to student" hint="Score, %, and AI feedback." checked={showResult} onChange={setShowResult} />
                <ToggleRow label="Show answer sheet" hint="Reveals correct answers alongside the student's response." checked={showSheet} onChange={setShowSheet} />
                <ToggleRow label="Show answer book" hint="Detailed AI explanations with formulas & steps." checked={showBook} onChange={setShowBook} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Exam pattern</CardTitle>
            </CardHeader>
            <CardContent>
              <PatternPicker
                pattern={pattern}
                config={config}
                onChange={(p, c) => {
                  setPattern(p);
                  setConfig(c);
                }}
              />
            </CardContent>
          </Card>

          <QuestionSource
            pattern={pattern}
            subjects={subjects}
            onQuestions={(qs) => setQuestions((prev) => [...prev, ...qs])}
            onTitleSuggested={(t) => !title && setTitle(t)}
          />

          <Button className="w-full" size="lg" onClick={save} disabled={saving}>
            {saving ? "Saving…" : `Save exam (${questions.length} questions)`}
          </Button>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{draftStatus === "saving" ? "Saving draft to cloud…" : draftStatus === "saved" ? "✓ Draft saved to cloud — safe to close and come back." : "Draft auto-saves to cloud."}</span>
            {(title || questions.length > 0) && (
              <button type="button" onClick={clearDraft} className="underline underline-offset-2 hover:text-destructive">
                Discard draft
              </button>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            You can add more questions any time — even after publishing — from the exam page.
          </p>

        </div>

        <div className="space-y-3">
          {questions.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Pick a pattern and use the AI panel on the left to generate questions.
              </CardContent>
            </Card>
          ) : (
            questions.map((q, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Q{i + 1} · {q.type} · {q.marks}m {q.topic && `· ${q.topic}`}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <RichContent>{q.prompt || "*(empty prompt)*"}</RichContent>
                  {q.options && (
                    <ul className="ml-4 list-disc text-xs">
                      {q.options.map((o, oi) => (
                        <li key={oi} className={q.correct_answer.includes(o) ? "font-medium text-primary" : ""}>
                          <RichContent inline>{o}</RichContent>
                        </li>
                      ))}
                    </ul>
                  )}

                  {q.type === "short" && (
                    <div className="text-xs text-muted-foreground">Accepted: {q.correct_answer.join(", ") || "—"}</div>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <Label className="text-xs">Marks</Label>
                      <NumberField
                        value={q.marks}
                        onChange={(n) => setQuestions((qs) => qs.map((x, j) => j === i ? { ...x, marks: n } : x))}
                        min={0}
                        step={0.25}
                        fallback={1}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Topic</Label>
                      <Input
                        value={q.topic ?? ""}
                        onChange={(e) => setQuestions((qs) => qs.map((x, j) => j === i ? { ...x, topic: e.target.value || null } : x))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
