import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NumberField } from "@/components/NumberField";
import { PatternPicker } from "@/components/PatternPicker";
import { QuestionSource } from "@/components/QuestionSource";
import { listStudents } from "@/lib/exams.functions";
import { reassignAttempt } from "@/lib/attempts.functions";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import {
  updateExam,
  saveQuestions,
  bulkAssign,
  getExamAnalytics,
  regenerateExamCode,
  appendQuestions,
} from "@/lib/admin.functions";
import {
  type ExamPattern,
  type PatternConfig,
  patternLabel,
} from "@/lib/exam-patterns";
import {
  Trash2, RotateCcw, UserPlus, Save, ArrowUp, ArrowDown, CheckCircle2, Copy, RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/exams/$examId")({
  head: () => ({
    meta: [
      { title: "Exam — ExamPrep" },
      { name: "description", content: "Manage exam, questions, assignments, and results." },
      { property: "og:title", content: "Exam — ExamPrep" },
      { property: "og:description", content: "Manage exam, questions, assignments, and results." },
    ],
  }),
  component: ExamDetail,
});

type Student = { id: string; student_code: string; name: string; email: string | null; class_name: string | null };
type Exam = {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  access_code: string;
  start_at: string | null;
  end_at: string | null;
  pattern: ExamPattern;
  pattern_config: PatternConfig | null;
  negative_mark_per_wrong: number;
  show_result_after_submit: boolean;
  show_answer_sheet: boolean;
  show_answer_book: boolean;
};

type Question = {
  id?: string;
  type: "mcq" | "multi" | "tf" | "short";
  prompt: string;
  options: string[] | null;
  correct_answer: string[];
  marks: number;
  topic: string | null;
  difficulty: "easy" | "medium" | "hard";
};
type Assignment = {
  id: string;
  student_id: string;
  due_at: string | null;
  max_attempts: number;
  attempts: { id: string; status: string; score: number | null; max_score: number | null }[];
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function ExamDetail() {
  const { examId } = Route.useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [due, setDue] = useState("");
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [analytics, setAnalytics] = useState<any>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);

  const reload = async () => {
    const [{ data: e }, { data: q }, { data: a }] = await Promise.all([
      supabase.from("exams").select("id, title, description, duration_minutes, shuffle_questions, shuffle_options, access_code, start_at, end_at, pattern, pattern_config, negative_mark_per_wrong, show_result_after_submit, show_answer_sheet, show_answer_book").eq("id", examId).single(),
      supabase.from("questions").select("id, type, prompt, options, correct_answer, marks, topic, difficulty").eq("exam_id", examId).order("order_index"),
      supabase.from("assignments")
        .select("id, student_id, due_at, max_attempts, attempts(id, status, score, max_score)")
        .eq("exam_id", examId),
    ]);
    setExam(e as Exam);
    setQuestions((q as Question[]) ?? []);
    setAssignments((a as Assignment[]) ?? []);
    try {
      setStudents((await listStudents()) as Student[]);
      setAnalytics(await getExamAnalytics({ data: { examId } }));
    } catch {
      /* not admin */
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [examId]);
  useRealtimeSync(["exams", "questions", "assignments", "attempts", "students"], reload);

  const patchExam = (p: Partial<Exam>) => setExam((prev) => (prev ? { ...prev, ...p } : prev));

  const saveSettings = async () => {
    if (!exam) return;
    setSavingSettings(true);
    try {
      await updateExam({
        data: {
          examId,
          title: exam.title,
          description: exam.description,
          duration_minutes: exam.duration_minutes,
          shuffle_questions: exam.shuffle_questions,
          shuffle_options: exam.shuffle_options,
          start_at: exam.start_at,
          end_at: exam.end_at,
          pattern: exam.pattern,
          pattern_config: exam.pattern_config,
          negative_mark_per_wrong: exam.negative_mark_per_wrong ?? 0,
          show_result_after_submit: exam.show_result_after_submit,
          show_answer_sheet: exam.show_answer_sheet,
          show_answer_book: exam.show_answer_book,
        },
      });
      toast.success("Settings saved");
    } catch (e) { toast.error((e as Error).message); }
    finally { setSavingSettings(false); }
  };

  const patchQ = (i: number, p: Partial<Question>) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...p } : q)));

  const move = (i: number, delta: number) => {
    setQuestions((qs) => {
      const j = i + delta;
      if (j < 0 || j >= qs.length) return qs;
      const copy = qs.slice();
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };

  const removeQ = (i: number) => {
    setQuestions((qs) => {
      const q = qs[i];
      if (q.id) setDeletedIds((d) => [...d, q.id!]);
      return qs.filter((_, idx) => idx !== i);
    });
  };

  const persistQuestions = async () => {
    setSavingQuestions(true);
    try {
      const valid = questions.filter((q) => q.prompt.trim());
      await saveQuestions({ data: { examId, questions: valid, deletedIds } });
      setDeletedIds([]);
      toast.success("Questions saved");
      reload();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSavingQuestions(false); }
  };

  const onAddQuestions = async (qs: Question[]) => {
    if (!qs.length) return;
    // For AI-generated batches persist immediately so the admin sees them in the editor
    // even if they haven't saved yet. Blank manual questions still just append locally.
    const hasContent = qs.some((q) => q.prompt.trim());
    if (hasContent) {
      try {
        await appendQuestions({
          data: {
            examId,
            questions: qs.filter((q) => q.prompt.trim()).map((q) => ({
              type: q.type,
              prompt: q.prompt,
              options: q.options,
              correct_answer: q.correct_answer,
              marks: q.marks,
              topic: q.topic,
              difficulty: q.difficulty,
            })),
          },
        });
        toast.success(`Added ${qs.length} question${qs.length === 1 ? "" : "s"}`);
        reload();
        return;
      } catch (e) {
        toast.error((e as Error).message);
        return;
      }
    }
    setQuestions((prev) => [...prev, ...qs]);
  };

  const assignedIds = new Set(assignments.map((a) => a.student_id));
  const availableStudents = students.filter((s) => !assignedIds.has(s.id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const selectAllAvail = () => setSelected(new Set(availableStudents.map((s) => s.id)));

  const doBulkAssign = async () => {
    if (!selected.size) return toast.error("Select at least one student");
    try {
      const r = await bulkAssign({
        data: {
          examId,
          studentIds: Array.from(selected),
          due_at: due || null,
          max_attempts: maxAttempts,
        },
      });
      toast.success(`Assigned to ${r.assigned}`);
      setSelected(new Set());
      setDue("");
      reload();
    } catch (e) { toast.error((e as Error).message); }
  };

  const removeAssignment = async (id: string) => {
    if (!confirm("Remove this assignment?")) return;
    await supabase.from("assignments").delete().eq("id", id);
    reload();
  };

  const reassign = async (id: string) => {
    if (!confirm("Reset all attempts for this student?")) return;
    try {
      await reassignAttempt({ data: { assignmentId: id } });
      toast.success("Reset");
      reload();
    } catch (e) { toast.error((e as Error).message); }
  };

  const deleteExam = async () => {
    if (!confirm("Delete this exam and all its data?")) return;
    await supabase.from("exams").delete().eq("id", examId);
    toast.success("Deleted");
    navigate({ to: "/dashboard" });
  };

  const studentName = (id: string) => {
    const s = students.find((x) => x.id === id);
    return s ? `${s.name} (${s.student_code})` : id.slice(0, 8);
  };

  const copyCode = () => {
    if (!exam) return;
    navigator.clipboard.writeText(exam.access_code);
    toast.success(`Copied ${exam.access_code}`);
  };

  const regenerate = async () => {
    if (!confirm("Regenerate exam password? Old password will stop working.")) return;
    try {
      const r = await regenerateExamCode({ data: { examId } });
      toast.success(`New password: ${r.access_code}`);
      reload();
    } catch (e) { toast.error((e as Error).message); }
  };

  if (!exam) return <AppShell><p>Loading…</p></AppShell>;

  const subjects = exam.pattern_config?.sections.map((s) => s.name) ?? [];

  return (
    <AppShell title={exam.title}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{exam.title}</h1>
          <p className="text-sm text-muted-foreground">
            {patternLabel(exam.pattern)} · {exam.duration_minutes} min · {questions.length} questions
            {exam.negative_mark_per_wrong ? ` · −${exam.negative_mark_per_wrong} per wrong` : ""}
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={deleteExam} className="shrink-0">
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </Button>
      </div>

      <Card className="mb-6 border-primary/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Exam password</div>
            <div className="font-mono text-2xl font-bold tracking-widest text-primary">{exam.access_code}</div>
            <p className="mt-1 text-xs text-muted-foreground">Students enter their ID + this password on the home page to start.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyCode}><Copy className="mr-2 h-4 w-4" />Copy</Button>
            <Button variant="ghost" size="sm" onClick={regenerate}><RefreshCw className="mr-2 h-4 w-4" />Regenerate</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="questions">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="assign">Assign</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* QUESTIONS */}
        <TabsContent value="questions" className="mt-4 space-y-4">
          <QuestionSource
            pattern={exam.pattern}
            subjects={subjects}
            onQuestions={(qs) => onAddQuestions(qs as Question[])}
          />

          <div className="flex justify-end">
            <Button onClick={persistQuestions} disabled={savingQuestions}>
              <Save className="mr-2 h-4 w-4" />{savingQuestions ? "Saving…" : "Save changes"}
            </Button>
          </div>

          {questions.map((q, i) => (
            <Card key={q.id ?? `new-${i}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <div className="flex items-center gap-2">
                  <Badge>Q{i + 1}</Badge>
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                    value={q.type}
                    onChange={(e) => {
                      const type = e.target.value as Question["type"];
                      patchQ(i, {
                        type,
                        options: type === "short" ? null : type === "tf" ? ["True", "False"] : (q.options ?? ["", "", "", ""]),
                        correct_answer: [],
                      });
                    }}
                  >
                    <option value="mcq">MCQ (single)</option>
                    <option value="multi">Multi-select</option>
                    <option value="tf">True/False</option>
                    <option value="short">Short answer</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => removeQ(i)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea placeholder="Question prompt" value={q.prompt} onChange={(e) => patchQ(i, { prompt: e.target.value })} />
                {q.type !== "short" && q.options && (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => {
                      const isCorrect = q.correct_answer.includes(opt);
                      return (
                        <div key={oi} className="flex items-center gap-2">
                          <Button
                            type="button" variant={isCorrect ? "default" : "outline"} size="sm"
                            onClick={() => {
                              const next = q.type === "multi"
                                ? (isCorrect ? q.correct_answer.filter((x) => x !== opt) : [...q.correct_answer, opt])
                                : [opt];
                              patchQ(i, { correct_answer: next });
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Input
                            value={opt}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              const newOpts = q.options!.slice();
                              const oldVal = newOpts[oi];
                              newOpts[oi] = newVal;
                              const newCorrect = q.correct_answer.map((c) => (c === oldVal ? newVal : c));
                              patchQ(i, { options: newOpts, correct_answer: newCorrect });
                            }}
                            disabled={q.type === "tf"}
                          />
                          {q.type === "mcq" && q.options!.length > 2 && (
                            <Button variant="ghost" size="icon" onClick={() => {
                              const opts = q.options!.filter((_, x) => x !== oi);
                              patchQ(i, { options: opts, correct_answer: q.correct_answer.filter((c) => opts.includes(c)) });
                            }}><Trash2 className="h-4 w-4" /></Button>
                          )}
                        </div>
                      );
                    })}
                    {(q.type === "mcq" || q.type === "multi") && (
                      <Button variant="ghost" size="sm" onClick={() => patchQ(i, { options: [...(q.options ?? []), ""] })}>
                        + Add option
                      </Button>
                    )}
                  </div>
                )}
                {q.type === "short" && (
                  <div>
                    <Label>Accepted answers (comma-separated)</Label>
                    <Input
                      value={q.correct_answer.join(", ")}
                      onChange={(e) => patchQ(i, { correct_answer: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                    />
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">Marks</Label>
                    <NumberField value={q.marks} onChange={(n) => patchQ(i, { marks: n })} min={0} step={0.25} fallback={1} />
                  </div>
                  <div>
                    <Label className="text-xs">Topic</Label>
                    <Input value={q.topic ?? ""} onChange={(e) => patchQ(i, { topic: e.target.value || null })} />
                  </div>
                  <div>
                    <Label className="text-xs">Difficulty</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                      value={q.difficulty}
                      onChange={(e) => patchQ(i, { difficulty: e.target.value as Question["difficulty"] })}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ASSIGN */}
        <TabsContent value="assign" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <Card>
              <CardHeader><CardTitle className="text-base">Bulk assign</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Due date</Label>
                    <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
                  </div>
                  <div>
                    <Label>Max attempts</Label>
                    <NumberField value={maxAttempts} onChange={setMaxAttempts} min={1} fallback={1} />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{selected.size} selected</p>
                  <Button variant="ghost" size="sm" onClick={selectAllAvail}>Select all available</Button>
                </div>
                <div className="max-h-72 space-y-1 overflow-auto rounded-md border border-border p-2">
                  {availableStudents.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground">All students already assigned.</p>
                  ) : availableStudents.map((s) => (
                    <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded p-2 text-sm hover:bg-muted">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{s.student_code}</span>
                    </label>
                  ))}
                </div>
                <Button className="w-full" onClick={doBulkAssign} disabled={!selected.size}>
                  <UserPlus className="mr-2 h-4 w-4" />Assign to {selected.size || "…"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Current assignments ({assignments.length})</CardTitle></CardHeader>
              <CardContent>
                {assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assignments yet.</p>
                ) : (
                  <div className="space-y-2">
                    {assignments.map((a) => {
                      const best = a.attempts.reduce(
                        (b, t) => ((t.score ?? -1) > (b?.score ?? -1) ? t : b),
                        null as Assignment["attempts"][number] | null,
                      );
                      return (
                        <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{studentName(a.student_id)}</div>
                            <div className="text-xs text-muted-foreground">
                              {a.attempts.length} attempt{a.attempts.length === 1 ? "" : "s"}
                              {best?.score != null && ` · best ${best.score}/${best.max_score}`}
                              {a.due_at && ` · due ${new Date(a.due_at).toLocaleDateString()}`}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {best && (
                              <Link to="/results/$attemptId" params={{ attemptId: best.id }}>
                                <Button variant="outline" size="sm">View</Button>
                              </Link>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => reassign(a.id)} title="Reset attempts">
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => removeAssignment(a.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* RESULTS */}
        <TabsContent value="results" className="mt-4 space-y-4">
          {!analytics ? <p className="text-sm text-muted-foreground">Loading analytics…</p> : (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Attempts" value={analytics.totalAttempts} />
                <StatCard label="Average" value={`${analytics.averageScore}/${analytics.totalMarks}`} />
                <StatCard label="Pass rate" value={`${analytics.passRate}%`} />
                <StatCard label="Topics" value={analytics.topics.length} />
              </div>
              <Card>
                <CardHeader><CardTitle className="text-base">Topic performance</CardTitle></CardHeader>
                <CardContent>
                  {analytics.topics.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No data yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {analytics.topics.map((t: any) => (
                        <div key={t.topic}>
                          <div className="mb-1 flex justify-between text-sm">
                            <span>{t.topic}</span>
                            <span className="text-muted-foreground">{t.accuracy}% ({t.total} answers)</span>
                          </div>
                          <div className="h-2 rounded bg-muted">
                            <div
                              className="h-2 rounded"
                              style={{
                                width: `${t.accuracy}%`,
                                background: t.accuracy >= 70 ? "hsl(var(--primary))" : t.accuracy >= 40 ? "orange" : "hsl(var(--destructive))",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* SETTINGS */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Exam pattern</CardTitle></CardHeader>
            <CardContent>
              <PatternPicker
                pattern={exam.pattern}
                config={exam.pattern_config}
                onChange={(p, c) =>
                  patchExam({
                    pattern: p,
                    pattern_config: c,
                    duration_minutes: c?.duration_minutes ?? exam.duration_minutes,
                    negative_mark_per_wrong: c?.negative_mark_per_wrong ?? exam.negative_mark_per_wrong,
                  })
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Exam details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={exam.title} onChange={(e) => patchExam({ title: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={exam.description ?? ""} onChange={(e) => patchExam({ description: e.target.value || null })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Duration (minutes)</Label>
                  <NumberField
                    value={exam.duration_minutes}
                    onChange={(n) => patchExam({ duration_minutes: n })}
                    min={1}
                    fallback={30}
                  />
                </div>
                <div>
                  <Label>Negative marks per wrong</Label>
                  <NumberField
                    value={exam.negative_mark_per_wrong ?? 0}
                    onChange={(n) => patchExam({ negative_mark_per_wrong: n })}
                    min={0}
                    step={0.25}
                    fallback={0}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Available from</Label>
                  <Input type="datetime-local" value={toLocalInput(exam.start_at)} onChange={(e) => patchExam({ start_at: fromLocalInput(e.target.value) })} />
                </div>
                <div>
                  <Label>Available until</Label>
                  <Input type="datetime-local" value={toLocalInput(exam.end_at)} onChange={(e) => patchExam({ end_at: fromLocalInput(e.target.value) })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Students can only start the exam within this window. Leave blank for always-available.</p>
              <div className="flex items-center justify-between">
                <Label>Shuffle questions</Label>
                <Switch checked={exam.shuffle_questions} onCheckedChange={(v) => patchExam({ shuffle_questions: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Shuffle options</Label>
                <Switch checked={exam.shuffle_options} onCheckedChange={(v) => patchExam({ shuffle_options: v })} />
              </div>

              <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">After submission</div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Show result to student</div>
                    <div className="text-xs text-muted-foreground">Score, %, and AI feedback right after submitting.</div>
                  </div>
                  <Switch checked={exam.show_result_after_submit} onCheckedChange={(v) => patchExam({ show_result_after_submit: v })} />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Show answer sheet</div>
                    <div className="text-xs text-muted-foreground">Correct answers alongside the student's response.</div>
                  </div>
                  <Switch checked={exam.show_answer_sheet} onCheckedChange={(v) => patchExam({ show_answer_sheet: v })} />
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Show answer book</div>
                    <div className="text-xs text-muted-foreground">Detailed AI explanations with formulas & step-by-step working.</div>
                  </div>
                  <Switch checked={exam.show_answer_book} onCheckedChange={(v) => patchExam({ show_answer_book: v })} />
                </div>
              </div>

              <Button onClick={saveSettings} disabled={savingSettings}>
                <Save className="mr-2 h-4 w-4" />{savingSettings ? "Saving…" : "Save settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}
