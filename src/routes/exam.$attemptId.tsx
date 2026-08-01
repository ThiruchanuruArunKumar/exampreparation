import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  Brain,
  Sparkles,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Camera,
  Upload,
  Plus,
  ArrowUp,
  ArrowDown,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { useProctoring } from "@/hooks/useProctoring";
import {
  getStudentAttemptState,
  saveStudentAnswer,
  reportStudentWarning,
  submitStudentAttempt,
} from "@/lib/student.functions";
import {
  uploadAnswerSheetImages,
  getAttemptAnswerSheetImages,
} from "@/lib/ipe.functions";
import { RichContent } from "@/components/RichContent";


export const Route = createFileRoute("/exam/$attemptId")({
  head: () => ({
    meta: [
      { title: "Exam in progress — ExamPrep" },
      { name: "description", content: "Take your proctored exam." },
      { property: "og:title", content: "Exam in progress — ExamPrep" },
      { property: "og:description", content: "Take your proctored exam." },
    ],
  }),
  component: TakeExam,
});

type Question = {
  id: string;
  type: "mcq" | "multi" | "tf" | "short";
  prompt: string;
  options: string[] | null;
  marks: number;
  topic: string | null;
  difficulty: string | null;
};

type Insight = {
  summary: string;
  weak_topics: string[];
  strong_topics: string[];
  recommendations: string;
};

function TakeExam() {
  const { attemptId } = Route.useParams();
  const token = typeof window !== "undefined" ? sessionStorage.getItem(`exam:${attemptId}`) : null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [exam, setExam] = useState<{ title: string; duration_minutes: number; pattern_config?: any } | null>(null);
  const [student, setStudent] = useState<{ name: string; student_code: string } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState(0);
  const [showPalette, setShowPalette] = useState(false);
  const [endsAt, setEndsAt] = useState<string>("");
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const [result, setResult] = useState<{
    score: number;
    maxScore: number;
    insight: Insight | null;
    auto: boolean;
    terminated: boolean;
    showResult: boolean;
    showAnswerSheet: boolean;
    showAnswerBook: boolean;
  } | null>(null);
  const [showAnswerSheetStep, setShowAnswerSheetStep] = useState(false);
  const [answerPages, setAnswerPages] = useState<{ imageUrl: string; pageNumber: number }[]>([]);
  const [pendingAuto, setPendingAuto] = useState(false);
  const [pendingTerminated, setPendingTerminated] = useState(false);

  const subjectBoundaries = useMemo(() => {
    if (!exam?.pattern_config?.sections) return null;
    let offset = 0;
    return (exam.pattern_config.sections as any[]).map((sec) => {
      const start = offset;
      const count = sec.subsections
        ? sec.subsections.reduce((n: number, sub: any) => n + Number(sub.count), 0)
        : Number(sec.count);
      offset += count;
      return { name: sec.name, start, end: offset - 1, subsections: sec.subsections };
    });
  }, [exam?.pattern_config]);

  useEffect(() => {
    if (subjectBoundaries && !activeSubject) {
      setActiveSubject(subjectBoundaries[0].name);
    }
  }, [subjectBoundaries, activeSubject]);

  useEffect(() => {
    if (!token) {
      setError("Session expired. Please re-enter your ID and exam password.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const s = await getStudentAttemptState({ data: { attemptId, sessionToken: token } });
        if (s.attempt.status !== "in_progress") {
          setResult({
            score: Number(s.attempt.score ?? 0),
            maxScore: Number(s.attempt.maxScore ?? 0),
            insight: null,
            auto: false,
            terminated: false,
            showResult: true,
            showAnswerSheet: false,
            showAnswerBook: false,
          });
          setExam(s.exam as { title: string; duration_minutes: number; pattern_config?: any });
          setStudent(s.student as { name: string; student_code: string });
          setLoading(false);
          return;
        }
        setExam(s.exam as { title: string; duration_minutes: number; pattern_config?: any });
        setStudent(s.student as { name: string; student_code: string });
        setQuestions(s.questions as Question[]);
        setEndsAt(s.attempt.endsAt);
        const a: Record<string, string[]> = {};
        for (const r of s.answers) a[r.question_id] = (r.response as string[]) ?? [];
        setAnswers(a);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [attemptId, token]);

  useEffect(() => {
    if (!endsAt || result || showAnswerSheetStep) return;
    const tick = () => {
      const r = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
      setRemaining(r);
      if (r === 0) handleSubmit(true);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, result, showAnswerSheetStep]);

  const handleSubmit = useCallback(
    async (auto = false, terminated = false) => {
      if (submittingRef.current || !token) return;

      const isIpeExam =
        (exam as any)?.pattern === "ipe" ||
        exam?.pattern_config?.is_ipe ||
        exam?.pattern_config?.answer_sheet_required === true;

      if (isIpeExam && !showAnswerSheetStep) {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        setPendingAuto(auto);
        setPendingTerminated(terminated);
        setShowAnswerSheetStep(true);
        return;
      }

      submittingRef.current = true;
      setSubmitting(true);
      try {
        if (isIpeExam && answerPages.length > 0) {
          await uploadAnswerSheetImages({
            data: {
              attemptId,
              sessionToken: token,
              images: answerPages.map((p, idx) => ({ imageUrl: p.imageUrl, pageNumber: idx + 1 })),
            },
          });
        }

        const r = await submitStudentAttempt({
          data: { attemptId, sessionToken: token, autoSubmit: auto },
        });
        setResult({
          score: Number(r.score ?? 0),
          maxScore: Number(r.maxScore ?? 0),
          insight: (r.insight as Insight | null) ?? null,
          auto,
          terminated,
          showResult: r.showResult ?? true,
          showAnswerSheet: r.showAnswerSheet ?? false,
          showAnswerBook: r.showAnswerBook ?? false,
        });
        setShowAnswerSheetStep(false);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      } catch (e) {
        toast.error((e as Error).message);
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [attemptId, token, exam, showAnswerSheetStep, answerPages],
  );

  const { warnings } = useProctoring({
    enabled: started && !submitting && !result && !showAnswerSheetStep,
    maxWarnings: 3,
    onWarning: (count, reason) => {
      toast.warning(`Warning ${count}/3 — ${reason}`, { duration: 4000 });
      if (token) reportStudentWarning({ data: { attemptId, sessionToken: token, count } }).catch(() => {});
    },
    onLimit: () => {
      toast.error("3 warnings reached — exam terminated");
      handleSubmit(true, true);
    },
  });

  const setResp = async (qid: string, resp: string[]) => {
    if (resp.length > 0 && exam?.pattern_config?.sections) {
      const qIndex = questions.findIndex(q => q.id === qid);
      if (qIndex >= 0) {
        let offset = 0;
        for (const sec of (exam.pattern_config.sections as any[])) {
           if (sec.subsections) {
              for (const sub of sec.subsections) {
                 const count = Number(sub.count);
                 if (qIndex >= offset && qIndex < offset + count) {
                    const limit = Number(sub.attempt_limit ?? sub.count);
                    let answeredInSub = 0;
                    for (let i = offset; i < offset + count; i++) {
                       if (questions[i].id !== qid && (answers[questions[i].id]?.length ?? 0) > 0) {
                          answeredInSub++;
                       }
                    }
                    if (answeredInSub >= limit && (answers[qid]?.length ?? 0) === 0) {
                       toast.error(`You can only attempt ${limit} questions in ${sub.name}. Please clear an answer first.`);
                       return;
                    }
                 }
                 offset += count;
              }
           } else {
              offset += Number(sec.count);
           }
        }
      }
    }
    setAnswers((a) => ({ ...a, [qid]: resp }));
    if (!token) return;
    try {
      await saveStudentAnswer({ data: { attemptId, sessionToken: token, questionId: qid, response: resp } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const timeStr = useMemo(() => {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [remaining]);

  // Track visited questions as the student navigates.
  useEffect(() => {
    if (!started || !questions.length) return;
    const q = questions[current];
    if (!q) return;
    setVisited((s) => (s.has(q.id) ? s : new Set(s).add(q.id)));
  }, [current, started, questions]);

  if (loading) return <Frame><p>Loading exam…</p></Frame>;
  if (error) return <Frame><ErrorCard message={error} /></Frame>;

  if (result) {
    return (
      <Frame>
        <ResultScreen
          attemptId={attemptId}
          sessionToken={token}
          result={result}
          exam={exam}
          student={student}
        />
      </Frame>
    );
  }


  if (!started) {
    return (
      <Frame>
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle>{exam?.title}</CardTitle>
            {student && (
              <p className="text-sm text-muted-foreground">
                {student.name} · {student.student_code}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4">
              <div className="flex items-center gap-2 font-medium text-destructive">
                <ShieldAlert className="h-4 w-4" /> Proctoring rules
              </div>
              <ul className="mt-2 list-disc pl-5 text-sm text-foreground">
                <li>The exam runs in fullscreen. Do not exit.</li>
                <li>Do not switch tabs, minimize, or open other apps.</li>
                <li>Copy, paste, right-click, and shortcuts are blocked.</li>
                <li>You get 3 warnings. On the 3rd, the exam auto-submits.</li>
                <li>Time limit: {exam?.duration_minutes} minutes.</li>
              </ul>
            </div>
            <Button size="lg" className="w-full" onClick={() => setStarted(true)}>
              I understand — start exam
            </Button>
          </CardContent>
        </Card>
      </Frame>
    );
  }

  const q = questions[current];
  const isIpe = !!exam?.pattern_config?.is_ipe;
  const resp = answers[q.id] ?? [];
  const answered = Object.values(answers).filter((v) => v.length > 0).length;
  const reviewCount = reviewed.size;
  const isReviewed = reviewed.has(q.id);
  const activeSection = subjectBoundaries?.find((s) => current >= s.start && current <= s.end) ?? null;
  const activeSectionCfg = (exam?.pattern_config?.sections ?? []).find(
    (s: any) => s.name === activeSection?.name,
  );


  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-6 sm:py-3">
          <div className="min-w-0 flex-1 truncate text-sm font-medium">{exam?.title}</div>
          <div className="flex shrink-0 items-center gap-3 text-sm">
            <div className={`flex items-center gap-1 font-mono ${remaining < 60 ? "text-destructive" : ""}`}>
              <Clock className="h-4 w-4" /> {timeStr}
            </div>
            <div className="flex items-center gap-1 text-destructive">
              <AlertTriangle className="h-4 w-4" /> {warnings}/3
            </div>
            <Button size="sm" onClick={() => handleSubmit(false)} disabled={submitting}>
              Submit
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:grid-cols-[240px_1fr]">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {isIpe
                ? `${questions.length} questions · ${reviewCount} marked`
                : `${answered}/${questions.length} answered · ${reviewCount} marked`}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPalette((v) => !v)}
              className="h-7 px-2 text-xs"
            >
              {showPalette ? "Hide" : "Show"} all
            </Button>
          </div>
          {subjectBoundaries && subjectBoundaries.length > 1 && (
             <div className="flex flex-wrap gap-1 mb-2">
               {subjectBoundaries.map((s) => (
                  <Button
                    key={s.name}
                    variant={activeSubject === s.name ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                       setActiveSubject(s.name);
                    }}
                  >
                    {s.name}
                  </Button>
               ))}
             </div>
          )}
          {showPalette && (
            <>
              <div className="space-y-4">
                {subjectBoundaries && activeSubject ? (() => {
                   const activeSubjInfo = subjectBoundaries.find(s => s.name === activeSubject);
                   if (!activeSubjInfo) return null;
                   if (activeSubjInfo.subsections) {
                      return activeSubjInfo.subsections.map((sub: any, subIdx: number) => {
                         let subStart = activeSubjInfo.start;
                         for(let i=0; i<subIdx; i++) subStart += Number(activeSubjInfo.subsections[i].count);
                         const subCount = Number(sub.count);
                         return (
                            <div key={sub.name} className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                <span>{sub.name}</span>
                                {sub.attempt_limit && sub.attempt_limit < subCount && (
                                  <span className="text-destructive font-bold">Attempt {sub.attempt_limit} of {subCount}</span>
                                )}
                              </div>
                              <div className="grid grid-cols-8 gap-1 sm:grid-cols-10 lg:grid-cols-5">
                                {Array.from({length: subCount}).map((_, i) => {
                                   const qIdx = subStart + i;
                                   const qq = questions[qIdx];
                                   if (!qq) return null;
                                   const done = !isIpe && (answers[qq.id] ?? []).length > 0;
                                   const rev = reviewed.has(qq.id);
                                   const seen = visited.has(qq.id);
                                   let cls = "border-border bg-background text-foreground";
                                   if (rev && done) cls = "border-purple-500 bg-purple-500 text-white";
                                   else if (rev) cls = "border-purple-500 bg-purple-500 text-white";
                                   else if (done) cls = "border-green-500 bg-green-500 text-white";
                                   else if (seen) cls = "border-red-500 bg-red-500 text-white";
                                   const isCurrent = qIdx === current;
                                   return (
                                     <button
                                       key={qq.id}
                                       onClick={() => setCurrent(qIdx)}
                                       className={`relative rounded-md border p-2 text-xs font-medium transition ${cls} ${
                                         isCurrent ? "ring-2 ring-offset-1 ring-primary" : ""
                                       }`}
                                     >
                                       {qIdx + 1}
                                       {rev && done && (
                                         <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-green-400 ring-1 ring-white" />
                                       )}
                                     </button>
                                   );
                                })}
                              </div>
                            </div>
                         );
                      });
                   } else {
                      return (
                         <div className="grid grid-cols-8 gap-1 sm:grid-cols-10 lg:grid-cols-5">
                           {Array.from({length: activeSubjInfo.end - activeSubjInfo.start + 1}).map((_, i) => {
                              const qIdx = activeSubjInfo.start + i;
                              const qq = questions[qIdx];
                              if (!qq) return null;
                              const done = !isIpe && (answers[qq.id] ?? []).length > 0;
                              const rev = reviewed.has(qq.id);
                              const seen = visited.has(qq.id);
                              let cls = "border-border bg-background text-foreground";
                              if (rev && done) cls = "border-purple-500 bg-purple-500 text-white";
                              else if (rev) cls = "border-purple-500 bg-purple-500 text-white";
                              else if (done) cls = "border-green-500 bg-green-500 text-white";
                              else if (seen) cls = "border-red-500 bg-red-500 text-white";
                              const isCurrent = qIdx === current;
                              return (
                                <button
                                  key={qq.id}
                                  onClick={() => setCurrent(qIdx)}
                                  className={`relative rounded-md border p-2 text-xs font-medium transition ${cls} ${
                                    isCurrent ? "ring-2 ring-offset-1 ring-primary" : ""
                                  }`}
                                >
                                  {qIdx + 1}
                                  {rev && done && (
                                    <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-green-400 ring-1 ring-white" />
                                  )}
                                </button>
                              );
                           })}
                         </div>
                      );
                   }
                })() : (
                   <div className="grid grid-cols-8 gap-1 sm:grid-cols-10 lg:grid-cols-5">
                     {questions.map((qq, i) => {
                       const done = !isIpe && (answers[qq.id] ?? []).length > 0;
                       const rev = reviewed.has(qq.id);
                       const seen = visited.has(qq.id);
                       let cls = "border-border bg-background text-foreground";
                       if (rev && done) cls = "border-purple-500 bg-purple-500 text-white";
                       else if (rev) cls = "border-purple-500 bg-purple-500 text-white";
                       else if (done) cls = "border-green-500 bg-green-500 text-white";
                       else if (seen) cls = "border-red-500 bg-red-500 text-white";
                       const isCurrent = i === current;
                       return (
                         <button
                           key={qq.id}
                           onClick={() => setCurrent(i)}
                           className={`relative rounded-md border p-2 text-xs font-medium transition ${cls} ${
                             isCurrent ? "ring-2 ring-offset-1 ring-primary" : ""
                           }`}
                         >
                           {i + 1}
                           {rev && done && (
                             <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-green-400 ring-1 ring-white" />
                           )}
                         </button>
                       );
                     })}
                   </div>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
                <Legend color="bg-green-500" label="Answered" />
                <Legend color="bg-red-500" label="Not answered" />
                <Legend color="bg-purple-500" label="Marked for review" />
                <Legend color="bg-purple-500" label="Review + answered" dot />
              </div>
            </>
          )}
        </div>




        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Question {current + 1} of {questions.length}
              </div>
              <CardTitle className="mt-2 text-base sm:text-lg">
                <RichContent>{q.prompt}</RichContent>
              </CardTitle>

            </div>
            <Badge variant="secondary" className="shrink-0">
              {q.marks} marks
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {(q.type === "mcq" || q.type === "tf") && q.options && (
              <div className="space-y-2">
                {q.options.map((opt) => (
                  <label
                    key={opt}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 ${
                      resp.includes(opt) ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={resp.includes(opt)}
                      onChange={() => setResp(q.id, [opt])}
                    />
                    <RichContent inline className="text-sm">{opt}</RichContent>

                  </label>
                ))}
              </div>
            )}
            {q.type === "multi" && q.options && (
              <div className="space-y-2">
                {q.options.map((opt) => (
                  <label
                    key={opt}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 ${
                      resp.includes(opt) ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={resp.includes(opt)}
                      onChange={(e) =>
                        setResp(q.id, e.target.checked ? [...resp, opt] : resp.filter((v) => v !== opt))
                      }
                    />
                    <RichContent inline className="text-sm">{opt}</RichContent>
                  </label>
                ))}
              </div>
            )}
            {q.type === "short" && (
              <Textarea
                value={resp[0] ?? ""}
                onChange={(e) => setResp(q.id, e.target.value ? [e.target.value] : [])}
                rows={5}
                placeholder="Type your answer…"
              />
            )}

            <div className="flex flex-wrap items-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResp(q.id, [])}
                disabled={resp.length === 0}
              >
                Clear
              </Button>
              <Button
                variant={isReviewed ? "default" : "outline"}
                size="sm"
                className={isReviewed ? "bg-purple-600 text-white hover:bg-purple-700" : "border-purple-500 text-purple-700 hover:bg-purple-500/10 dark:text-purple-300"}
                onClick={() =>
                  setReviewed((s) => {
                    const n = new Set(s);
                    if (n.has(q.id)) n.delete(q.id);
                    else n.add(q.id);
                    return n;
                  })
                }
              >
                {isReviewed ? "Unmark review" : "Mark for review"}
              </Button>
              <div className="ml-auto flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                  disabled={current === 0}
                >
                  Previous
                </Button>
                {current < questions.length - 1 ? (
                  <Button onClick={() => setCurrent((c) => c + 1)}>Next</Button>
                ) : (
                  <Button onClick={() => handleSubmit(false)} disabled={submitting}>
                    {submitting ? "Submitting…" : "Submit exam"}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Legend({ color, label, dot }: { color: string; label: string; dot?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`relative inline-block h-3 w-3 rounded-sm ${color}`}>
        {dot && (
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-green-400 ring-1 ring-white" />
        )}
      </span>
      <span>{label}</span>
    </div>
  );
}


function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 sm:px-6">
          <Brain className="h-5 w-5 text-primary" />
          <span className="font-semibold">ExamPrep</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle className="text-destructive">Can't open this exam</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">{message}</p>
        <Link to="/">
          <Button>Back to start</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

/* -------- Result screen with Answer sheet + Answer book -------- */

type ReviewQ = {
  id: string;
  type: string;
  prompt: string;
  options: string[] | null;
  correct_answer: string[];
  marks: number;
  topic: string | null;
  response: string[];
  is_correct: boolean | null;
  marks_awarded: number | null;
};

function ResultScreen({
  attemptId,
  sessionToken,
  result,
  exam,
  student,
}: {
  attemptId: string;
  sessionToken: string | null;
  result: {
    score: number;
    maxScore: number;
    insight: Insight | null;
    auto: boolean;
    terminated: boolean;
    showResult: boolean;
    showAnswerSheet: boolean;
    showAnswerBook: boolean;
  };
  exam: { title: string; duration_minutes: number } | null;
  student: { name: string; student_code: string } | null;
}) {
  const [tab, setTab] = useState<"summary" | "sheet" | "book">("summary");
  const [review, setReview] = useState<ReviewQ[] | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [expBusy, setExpBusy] = useState<Record<string, boolean>>({});
  const [revealed, setRevealed] = useState(false);

  const hasAnyReview = result.showAnswerSheet || result.showAnswerBook;
  useEffect(() => {
    if (!sessionToken || !hasAnyReview || review) return;
    if (tab === "summary") return;
    setReviewLoading(true);
    import("@/lib/student.functions")
      .then(({ getStudentReview }) =>
        getStudentReview({ data: { attemptId, sessionToken } }),
      )
      .then((r) => setReview(r.questions as ReviewQ[]))
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setReviewLoading(false));
  }, [tab, sessionToken, attemptId, review, hasAnyReview]);

  const loadExplanation = async (qid: string) => {
    if (!sessionToken || explanations[qid] || expBusy[qid]) return;
    setExpBusy((b) => ({ ...b, [qid]: true }));
    try {
      const { getStudentExplanation } = await import("@/lib/student.functions");
      const r = await getStudentExplanation({
        data: { attemptId, sessionToken, questionId: qid },
      });
      setExplanations((e) => ({ ...e, [qid]: r.explanation }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExpBusy((b) => ({ ...b, [qid]: false }));
    }
  };

  const pct = result.maxScore ? Math.round((result.score / result.maxScore) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {result.terminated ? (
        <Card className="border-destructive/50">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="flex flex-wrap items-center gap-2 text-lg text-destructive">
                  <ShieldAlert className="h-6 w-6" />
                  Exam terminated
                </CardTitle>
                {student && exam && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {student.name} · {student.student_code} · {exam.title}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Your exam was <strong>auto-submitted</strong> after 3 proctoring warnings
              (tab switch, screenshot attempt, or exiting fullscreen).
            </p>
            <p className="text-muted-foreground">
              Whatever you answered so far has been saved. Please contact your teacher if
              you believe this was a mistake.
            </p>
            <div className="pt-1">
              <Link to="/">
                <Button>Back to home</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                  <span className="relative inline-flex">
                    <CheckCircle2 className="h-8 w-8 text-primary animate-scale-in" />
                    <span className="absolute inset-0 rounded-full bg-primary/30 blur-lg animate-pulse" aria-hidden />
                  </span>
                  {result.auto ? "Time's up — exam auto-submitted" : "Congratulations! Exam submitted"}
                </CardTitle>
                {student && exam && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {student.name} · {student.student_code} · {exam.title}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="animate-fade-in rounded-lg border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 animate-scale-in">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold">Thank you for submitting!</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {result.auto
                  ? "Your time ran out and we submitted your answers automatically."
                  : "Your answers have been recorded successfully. Well done on finishing the exam!"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Best of luck — your teacher will review your responses.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {result.showResult && !revealed && (
                <Button onClick={() => setRevealed(true)}>View result</Button>
              )}
              {!result.showResult && (
                <p className="text-sm text-muted-foreground">
                  Results are not published yet. You will be able to view them once your teacher enables it.
                </p>
              )}
              <Link to="/">
                <Button variant="outline">Back to home</Button>
              </Link>
            </div>

            {result.showResult && revealed && (
              <div className="animate-fade-in flex flex-wrap items-end justify-between gap-4 border-t border-border pt-4">
                <div>
                  <div className="text-5xl font-bold sm:text-6xl">
                    {result.score}
                    <span className="text-2xl text-muted-foreground">/{result.maxScore}</span>
                  </div>
                  <div className="mt-1 text-base text-muted-foreground">{pct}%</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}


      {result.showResult && revealed && hasAnyReview && (
        <div className="flex flex-wrap gap-2">
          <Button variant={tab === "summary" ? "default" : "outline"} size="sm" onClick={() => setTab("summary")}>
            Summary
          </Button>
          {result.showAnswerSheet && (
            <Button variant={tab === "sheet" ? "default" : "outline"} size="sm" onClick={() => setTab("sheet")}>
              Answer sheet
            </Button>
          )}
          {result.showAnswerBook && (
            <Button variant={tab === "book" ? "default" : "outline"} size="sm" onClick={() => setTab("book")}>
              Answer book
            </Button>
          )}
        </div>
      )}

      {result.showResult && revealed && tab === "summary" && result.insight && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" /> AI feedback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RichContent className="text-sm">{result.insight.summary}</RichContent>
            {result.insight.strong_topics.length > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-1 text-sm font-medium text-primary">
                  <TrendingUp className="h-4 w-4" /> Strong areas
                </div>
                <div className="flex flex-wrap gap-1">
                  {result.insight.strong_topics.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              </div>
            )}
            {result.insight.weak_topics.length > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-1 text-sm font-medium text-destructive">
                  <TrendingDown className="h-4 w-4" /> Needs work
                </div>
                <div className="flex flex-wrap gap-1">
                  {result.insight.weak_topics.map((t) => (
                    <Badge key={t} variant="destructive">{t}</Badge>
                  ))}
                </div>
              </div>
            )}
            {result.insight.recommendations && (
              <div>
                <div className="mb-1 text-sm font-medium">Study plan</div>
                <RichContent className="text-sm">{result.insight.recommendations}</RichContent>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result.showResult && revealed && tab !== "summary" && (
        <div className="space-y-3">
          {reviewLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {review?.map((q, i) => {
            const correct = q.correct_answer ?? [];
            const chose = q.response ?? [];
            return (
              <Card key={q.id}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      Q{i + 1} · {q.type} · {q.marks}m{q.topic ? ` · ${q.topic}` : ""}
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      {q.is_correct ? (
                        <span className="text-primary">✓ {q.marks_awarded ?? 0}/{q.marks}</span>
                      ) : (
                        <span className="text-destructive">✗ {q.marks_awarded ?? 0}/{q.marks}</span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-sm">
                  <div className="font-medium"><RichContent>{q.prompt}</RichContent></div>
                  {q.options && (
                    <ul className="ml-4 list-disc space-y-1 text-xs">
                      {q.options.map((o) => (
                        <li
                          key={o}
                          className={
                            correct.includes(o)
                              ? "font-semibold text-primary"
                              : chose.includes(o)
                                ? "text-destructive line-through"
                                : ""
                          }
                        >
                          <RichContent inline>{o}</RichContent>
                          {correct.includes(o) && " ✓"}
                          {!correct.includes(o) && chose.includes(o) && " (your answer)"}
                        </li>
                      ))}
                    </ul>
                  )}

                  {(q.type === "short" || q.type === "tf") && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-md border border-border p-2">
                        <div className="text-xs text-muted-foreground">Your answer</div>
                        <div className="flex flex-wrap gap-x-2">
                          {chose.length
                            ? chose.map((c, ci) => (
                                <span key={ci}><RichContent inline>{c}</RichContent>{ci < chose.length - 1 ? "," : ""}</span>
                              ))
                            : "—"}
                        </div>
                      </div>
                      <div className="rounded-md border border-border p-2">
                        <div className="text-xs text-muted-foreground">Correct answer</div>
                        <div className="flex flex-wrap gap-x-2 text-primary">
                          {correct.map((c, ci) => (
                            <span key={ci}><RichContent inline>{c}</RichContent>{ci < correct.length - 1 ? "," : ""}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}


                  {tab === "book" && (
                    <div className="rounded-md bg-muted/40 p-3">
                      {explanations[q.id] ? (
                        <RichContent className="text-sm leading-relaxed">
                          {explanations[q.id]}
                        </RichContent>

                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => loadExplanation(q.id)}
                          disabled={!!expBusy[q.id]}
                        >
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                          {expBusy[q.id] ? "Generating…" : "Show detailed explanation"}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnswerSheetUploadScreen({
  examTitle,
  studentName,
  studentCode,
  answerPages,
  setAnswerPages,
  uploading,
  onSubmit,
  required,
}: {
  examTitle: string;
  studentName?: string;
  studentCode?: string;
  answerPages: { imageUrl: string; pageNumber: number }[];
  setAnswerPages: React.Dispatch<React.SetStateAction<{ imageUrl: string; pageNumber: number }[]>>;
  uploading: boolean;
  onSubmit: () => void;
  required: boolean;
}) {
  const handleFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result);
        setAnswerPages((prev) => [
          ...prev,
          { imageUrl: base64, pageNumber: prev.length + 1 },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleRetake = (index: number) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result);
        setAnswerPages((prev) =>
          prev.map((item, idx) => (idx === index ? { ...item, imageUrl: base64 } : item)),
        );
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setAnswerPages((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((item, idx) => ({ ...item, pageNumber: idx + 1 }));
    });
  };

  const moveDown = (index: number) => {
    if (index === answerPages.length - 1) return;
    setAnswerPages((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((item, idx) => ({ ...item, pageNumber: idx + 1 }));
    });
  };

  const removePage = (index: number) => {
    setAnswerPages((prev) =>
      prev.filter((_, idx) => idx !== index).map((item, idx) => ({ ...item, pageNumber: idx + 1 })),
    );
  };

  const handleFinalSubmit = () => {
    if (required && answerPages.length === 0) {
      toast.error("Please photograph and attach at least one page of your answer sheet before submitting.");
      return;
    }
    onSubmit();
  };

  return (
    <Card className="mx-auto max-w-3xl border-border/80">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Camera className="h-6 w-6 text-primary" />
          Upload Answer Sheet Photos — {examTitle}
        </CardTitle>
        {studentName && (
          <p className="text-sm text-muted-foreground">
            {studentName} · {studentCode}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-xs space-y-1.5">
          <div className="font-semibold text-primary flex items-center gap-1.5">
            <Upload className="h-4 w-4" /> Photograph Your Handwritten Answer Sheet
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Please use your camera to capture clear photos of each page of your written answer sheet in page order (Page 1, Page 2, Page 3...).
          </p>
        </div>

        {/* Hidden Camera Input */}
        <input
          type="file"
          id="camera-page-input"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={handleFileCapture}
        />

        {/* Thumbnail Strip */}
        {answerPages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl text-center">
            <Camera className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">No pages photographed yet</p>
            <p className="text-xs text-muted-foreground mb-4">Click below to open device camera or upload image</p>
            <Button onClick={() => document.getElementById("camera-page-input")?.click()}>
              <Camera className="mr-2 h-4 w-4" /> Open Camera / Take Photo
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {answerPages.length} Page{answerPages.length === 1 ? "" : "s"} Captured
              </span>
              <Button size="sm" variant="outline" onClick={() => document.getElementById("camera-page-input")?.click()} className="text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Another Page
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {answerPages.map((page, idx) => (
                <div key={idx} className="relative rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>Page {idx + 1}</span>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveUp(idx)} disabled={idx === 0}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => moveDown(idx)} disabled={idx === answerPages.length - 1}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => removePage(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded border border-border bg-black/5 aspect-[3/4] max-h-56 flex items-center justify-center">
                    <img src={page.imageUrl} alt={`Page ${idx + 1}`} className="w-full h-full object-contain" />
                  </div>

                  <Button size="sm" variant="outline" onClick={() => handleRetake(idx)} className="w-full text-xs gap-1">
                    <RotateCcw className="h-3 w-3" /> Retake Photo
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-border flex flex-col sm:flex-row gap-3 justify-end">
          <Button size="lg" onClick={handleFinalSubmit} disabled={uploading} className="w-full sm:w-auto font-semibold">
            {uploading ? "Submitting Answer Sheet..." : "Submit Answer Sheet & Finalize Exam"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
