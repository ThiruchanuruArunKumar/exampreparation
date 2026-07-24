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
} from "lucide-react";
import { useProctoring } from "@/hooks/useProctoring";
import {
  getStudentAttemptState,
  saveStudentAnswer,
  reportStudentWarning,
  submitStudentAttempt,
} from "@/lib/student.functions";
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
  const [exam, setExam] = useState<{ title: string; duration_minutes: number } | null>(null);
  const [student, setStudent] = useState<{ name: string; student_code: string } | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [current, setCurrent] = useState(0);
  const [showPalette, setShowPalette] = useState(false);
  const [endsAt, setEndsAt] = useState<string>("");
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
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
          setExam(s.exam as { title: string; duration_minutes: number });
          setStudent(s.student as { name: string; student_code: string });
          setLoading(false);
          return;
        }
        setExam(s.exam as { title: string; duration_minutes: number });
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
    if (!endsAt || result) return;
    const tick = () => {
      const r = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
      setRemaining(r);
      if (r === 0) handleSubmit(true);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAt, result]);

  const handleSubmit = useCallback(
    async (auto = false, terminated = false) => {
      if (submittingRef.current || !token) return;
      submittingRef.current = true;
      setSubmitting(true);
      try {
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
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      } catch (e) {
        toast.error((e as Error).message);
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [attemptId, token],
  );

  const { warnings } = useProctoring({
    enabled: started && !submitting && !result,
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
  const resp = answers[q.id] ?? [];
  const answered = Object.values(answers).filter((v) => v.length > 0).length;

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

      <div className="mx-auto grid max-w-5xl gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {answered}/{questions.length} answered
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
          {showPalette && (
            <div className="grid grid-cols-8 gap-1 sm:grid-cols-10 lg:grid-cols-5">
              {questions.map((qq, i) => {
                const done = (answers[qq.id] ?? []).length > 0;
                return (
                  <button
                    key={qq.id}
                    onClick={() => setCurrent(i)}
                    className={`rounded-md border p-2 text-xs ${
                      i === current
                        ? "border-primary bg-primary text-primary-foreground"
                        : done
                          ? "border-primary/40 bg-primary/10"
                          : "border-border"
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
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

            <div className="flex justify-between pt-4">
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
          </CardContent>
        </Card>
      </div>
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
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                <CheckCircle2 className="h-6 w-6 text-primary" />
                {result.auto ? "Auto-submitted" : "Exam submitted"}
              </CardTitle>
              {student && exam && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {student.name} · {student.student_code} · {exam.title}
                </p>
              )}
            </div>
            <Link to="/">
              <Button variant="outline" size="sm">← Back to home</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!result.showResult ? (
            <p className="text-sm text-muted-foreground">
              Your responses have been recorded. Your teacher will share results when they are ready.
            </p>
          ) : (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-5xl font-bold sm:text-6xl">
                  {result.score}
                  <span className="text-2xl text-muted-foreground">/{result.maxScore}</span>
                </div>
                <div className="mt-1 text-base text-muted-foreground">{pct}%</div>
              </div>
              <Link to="/">
                <Button variant="outline">Done</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>


      {result.showResult && hasAnyReview && (
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

      {result.showResult && tab === "summary" && result.insight && (
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

      {result.showResult && tab !== "summary" && (
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
