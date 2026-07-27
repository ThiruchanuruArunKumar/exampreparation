import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Trash2, Search, Filter } from "lucide-react";
import { NumberField } from "@/components/NumberField";
import { PatternPicker } from "@/components/PatternPicker";
import { QuestionSource, type GeneratedQuestion } from "@/components/QuestionSource";
import { createExam } from "@/lib/admin.functions";
import { getDraft, saveDraft, deleteDraft } from "@/lib/drafts.functions";
import { z } from "zod";
import { type ExamPattern, type PatternConfig, presetToConfig } from "@/lib/exam-patterns";
import { RichContent } from "@/components/RichContent";
import { cn } from "@/lib/utils";

function getQuestionSection(q: GeneratedQuestion, index: number, config: PatternConfig | null): string {
  if (!config || !config.sections.length) return q.topic ?? "General";

  const topicLower = (q.topic ?? "").toLowerCase();
  for (const sec of config.sections) {
    if (topicLower.includes(sec.name.toLowerCase())) {
      return sec.name;
    }
  }

  let currentOffset = 0;
  for (const sec of config.sections) {
    const secCount = Number(sec.count) || 0;
    if (index >= currentOffset && index < currentOffset + secCount) {
      return sec.name;
    }
    currentOffset += secCount;
  }

  return config.sections[0]?.name ?? "General";
}

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
  const search = Route.useSearch();
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

  // Subject filter & search state for the right panel
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const availableSubjects = useMemo(() => config?.sections.map((s) => s.name) ?? [], [config]);

  const subjectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < questions.length; i++) {
      const s = getQuestionSection(questions[i], i, config);
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [questions, config]);

  const filteredQuestions = useMemo(() => {
    return questions
      .map((q, originalIndex) => ({
        q,
        originalIndex,
        section: getQuestionSection(q, originalIndex, config),
      }))
      .filter(({ q, section }) => {
        if (selectedSubject !== "all" && section.toLowerCase() !== selectedSubject.toLowerCase()) {
          return false;
        }
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          const matchPrompt = q.prompt.toLowerCase().includes(query);
          const matchTopic = (q.topic ?? "").toLowerCase().includes(query);
          const matchRef = (q.source_ref ?? "").toLowerCase().includes(query);
          return matchPrompt || matchTopic || matchRef;
        }
        return true;
      });
  }, [questions, config, selectedSubject, searchQuery]);

  // Restore existing draft when ?draftId= is provided; otherwise create a fresh draft row
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (search.draftId) {
          const d = await getDraft({ data: { id: search.draftId } });
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
        } else {
          skipNextSave.current = true;
          const r = await saveDraft({
            data: {
              title: "",
              pattern: "neet",
              pattern_config: presetToConfig("neet"),
              questions: [],
              show_result_after_submit: true,
              show_answer_sheet: true,
              show_answer_book: true,
            },
          });
          if (cancelled) return;
          if (r?.id) setDraftId(r.id);
          setDraftStatus("saved");
        }
      } catch { /* ignore */ }
      if (!cancelled) setRestored(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Keep latest state in a ref so we can flush on unmount / tab hide
  const latest = useRef({ draftId, title, pattern, config, questions, showResult, showSheet, showBook });
  useEffect(() => {
    latest.current = { draftId, title, pattern, config, questions, showResult, showSheet, showBook };
  });

  const flushSave = useCallback(async () => {
    const s = latest.current;
    try {
      const r = await saveDraft({
        data: {
          id: s.draftId,
          title: s.title,
          pattern: s.pattern,
          pattern_config: s.config,
          questions: s.questions,
          show_result_after_submit: s.showResult,
          show_answer_sheet: s.showSheet,
          show_answer_book: s.showBook,
        },
      });
      if (r?.id && r.id !== s.draftId) {
        setDraftId(r.id);
        latest.current.draftId = r.id;
      }
      setDraftStatus("saved");
    } catch {
      setDraftStatus("idle");
    }
  }, []);

  // Debounced cloud save on every change
  useEffect(() => {
    if (!restored) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setDraftStatus("saving");
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      flushSave();
    }, 800);
  }, [restored, draftId, title, pattern, config, questions, showResult, showSheet, showBook, flushSave]);

  // Flush pending save on tab hide / navigation away / unmount
  useEffect(() => {
    if (!restored) return;
    const flush = () => {
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
      flushSave();
    };
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
      flush();
    };
  }, [restored, flushSave]);

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

  const [mobileTab, setMobileTab] = useState<"setup" | "questions">("setup");

  // Auto-switch to questions tab on mobile when new questions are added
  const prevQuestionsCount = useRef(questions.length);
  useEffect(() => {
    if (questions.length > prevQuestionsCount.current && window.innerWidth < 1024) {
      setMobileTab("questions");
    }
    prevQuestionsCount.current = questions.length;
  }, [questions.length]);

  return (
    <AppShell title="New exam">
      <div className="pb-16 lg:pb-0 space-y-4">
        {/* Mobile View Switcher Tabs */}
        <div className="flex items-center rounded-xl border border-border/80 bg-muted/40 p-1 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileTab("setup")}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-semibold transition-all",
              mobileTab === "setup"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            ⚙️ Setup & Generator
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("questions")}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-semibold transition-all relative",
              mobileTab === "questions"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            📋 Questions Preview ({questions.length})
            {questions.length > 0 && (
              <span className="ml-1.5 inline-flex h-2 w-2 rounded-full bg-primary animate-pulse" />
            )}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)]">
          {/* Left Control Panel */}
          <div className={cn("space-y-4", mobileTab !== "setup" && "hidden lg:block")}>
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Exam Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="t" className="text-xs font-medium">Exam Title</Label>
                  <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. NEET Mock 1 — Aug" className="mt-1" />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    A 6-character exam access password is generated automatically upon saving.
                  </p>
                </div>

                <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Student Post-Exam Controls</div>
                  <ToggleRow label="Show result to student" hint="Score, %, and AI feedback." checked={showResult} onChange={setShowResult} />
                  <ToggleRow label="Show answer sheet" hint="Reveals correct answers alongside student response." checked={showSheet} onChange={setShowSheet} />
                  <ToggleRow label="Show answer book" hint="Detailed AI explanations with formulas & steps." checked={showBook} onChange={setShowBook} />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Exam Pattern</CardTitle>
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

            <Button className="w-full hidden lg:flex" size="lg" onClick={save} disabled={saving}>
              {saving ? "Saving…" : `Save Exam (${questions.length} questions)`}
            </Button>

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>{draftStatus === "saving" ? "Saving draft to cloud…" : draftStatus === "saved" ? "✓ Cloud auto-saved." : "Draft auto-saves."}</span>
              {(title || questions.length > 0) && (
                <button type="button" onClick={clearDraft} className="underline underline-offset-2 hover:text-destructive">
                  Discard draft
                </button>
              )}
            </div>
          </div>

          {/* Right Questions Preview Panel */}
          <div className={cn("space-y-3", mobileTab !== "questions" && "hidden lg:block")}>
          {/* Header Card with Subject Dropdown & Filter Pills */}
          <Card className="lg:sticky lg:top-20 z-20 shadow-sm border-border bg-background/95 backdrop-blur">
            <CardContent className="p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-base">
                    <span>Questions Preview</span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {questions.length} Total
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedSubject === "all"
                      ? "Showing questions across all subjects"
                      : `Viewing ${selectedSubject} (${subjectCounts[selectedSubject] ?? 0} questions)`}
                  </p>
                </div>

                {/* Subject Dropdown Select */}
                {availableSubjects.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="subj-select" className="text-xs shrink-0 font-medium text-muted-foreground">
                      <Filter className="inline h-3 w-3 mr-1" /> Subject:
                    </Label>
                    <select
                      id="subj-select"
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="all">All Subjects ({questions.length})</option>
                      {availableSubjects.map((s) => (
                        <option key={s} value={s}>
                          {s} ({subjectCounts[s] ?? 0} Qs)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Quick-Filter Subject Pill Tabs */}
              {availableSubjects.length > 0 && (
                <div className="flex items-center gap-1.5 border-t border-border/50 pt-2 overflow-x-auto no-scrollbar pb-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedSubject("all")}
                    className={cn(
                      "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      selectedSubject === "all"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    All ({questions.length})
                  </button>
                  {availableSubjects.map((s) => {
                    const c = subjectCounts[s] ?? 0;
                    const isActive = selectedSubject.toLowerCase() === s.toLowerCase();
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSelectedSubject(s)}
                        className={cn(
                          "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        {s} ({c})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Search Bar */}
              {questions.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search question text or topics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Question List View */}
          {questions.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Pick an exam pattern and use the AI panel on the left to generate questions.
              </CardContent>
            </Card>
          ) : filteredQuestions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No questions found matching your filter/search criteria.
              </CardContent>
            </Card>
          ) : (
            filteredQuestions.map(({ q, originalIndex, section }) => (
              <Card key={originalIndex} className="border-border/70 shadow-sm transition-all hover:border-primary/40">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Q{originalIndex + 1}</span>
                    <span>·</span>
                    <span className="uppercase tracking-wider font-semibold text-primary">{section}</span>
                    {q.topic && q.topic.toLowerCase() !== section.toLowerCase() && (
                      <>
                        <span>—</span>
                        <span className="font-medium text-foreground">{q.topic}</span>
                      </>
                    )}
                    <span>·</span>
                    <span className="uppercase">{q.type}</span>
                    <span>·</span>
                    <span>{q.marks}M</span>
                    {q.source_ref && (
                      <Badge variant="secondary" className="ml-1 border-0 bg-primary/10 text-[10px] font-semibold text-primary">
                        {q.source_ref}
                      </Badge>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== originalIndex))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>

                <CardContent className="space-y-3 text-sm pt-1">
                  <RichContent>{q.prompt || "*(empty prompt)*"}</RichContent>
                  
                  {q.options && (
                    <div className="space-y-2 pt-1 text-xs">
                      {q.options.map((o, oi) => {
                        const cleanForComparison = (str: string) =>
                          str
                            .trim()
                            .replace(/\\\\/g, "\\")
                            .replace(/\\ce\{([^{}]+)\}/g, "$1")
                            .replace(/\\ce\s*([A-Za-z0-9_+\-^\(\)]+)/g, "$1")
                            .replace(/\\text\{([^{}]+)\}/g, "$1")
                            .replace(/[\$\`\\\{\}\(\)\<\>]/g, "")
                            .replace(/\s+/g, "")
                            .toLowerCase();

                        const isCorrect = q.correct_answer.some((ans) => {
                          if (ans === o) return true;
                          const cleanAns = cleanForComparison(ans);
                          const cleanOpt = cleanForComparison(o);
                          if (cleanAns && cleanAns === cleanOpt) return true;

                          const letterMatch = ans.match(/^(?:Option\s*)?\(?\s*([A-D1-4])\s*[\)\.]?$/i);
                          if (letterMatch) {
                            const char = letterMatch[1].toUpperCase();
                            const targetIdx = ["A", "B", "C", "D"].includes(char)
                              ? ["A", "B", "C", "D"].indexOf(char)
                              : parseInt(char, 10) - 1;
                            if (targetIdx === oi) return true;
                          }
                          return false;
                        });
                        const letter = String.fromCharCode(65 + oi);
                        return (
                          <div
                            key={oi}
                            className={cn(
                              "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors",
                              isCorrect
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium"
                                : "border-border/60 bg-muted/20 text-foreground"
                            )}
                          >
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-background text-[10px] font-bold text-muted-foreground">
                              {letter}
                            </span>
                            <div className="min-w-0 flex-1 py-0.5 leading-normal">
                              <RichContent inline>{o}</RichContent>
                            </div>
                            {isCorrect && (
                              <span className="ml-auto shrink-0 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                                Correct
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.type === "short" && (
                    <div className="text-xs text-muted-foreground">Accepted: {q.correct_answer.join(", ") || "—"}</div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                    <div>
                      <Label className="text-xs">Marks</Label>
                      <NumberField
                        value={q.marks}
                        onChange={(n) => setQuestions((qs) => qs.map((x, j) => j === originalIndex ? { ...x, marks: n } : x))}
                        min={0}
                        step={0.25}
                        fallback={1}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Topic / Chapter</Label>
                      <Input
                        value={q.topic ?? ""}
                        onChange={(e) => setQuestions((qs) => qs.map((x, j) => j === originalIndex ? { ...x, topic: e.target.value || null } : x))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Floating Mobile Bottom Action Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border/80 bg-background/95 p-3 backdrop-blur-md lg:hidden flex items-center justify-between gap-3 shadow-lg">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-foreground truncate">
            {title.trim() || "Untitled Exam"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {questions.length} Questions · {config?.duration_minutes ?? 60} mins
          </div>
        </div>
        <Button size="sm" onClick={save} disabled={saving} className="shrink-0 shadow-sm px-4">
          {saving ? "Saving…" : "Save Exam"}
        </Button>
      </div>
    </div>
  </AppShell>
);
}
