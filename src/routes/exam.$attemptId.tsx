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
  const [endsAt, setEndsAt] = useState<string>("");
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [result, setResult] = useState<{
    score: number;
    maxScore: number;
    insight: Insight | null;
    auto: boolean;
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
    async (auto = false) => {
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
      toast.error("3 warnings reached — submitting exam");
      handleSubmit(true);
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

      <div className="mx-auto grid max-w-5xl gap-4 px-3 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:grid-cols-[200px_1fr]">
        <div className="space-y-1">
          <div className="mb-2 text-xs text-muted-foreground">
            {answered}/{questions.length} answered
          </div>
          <div className="grid grid-cols-8 gap-1 sm:grid-cols-10 lg:grid-cols-4">
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
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Question {current + 1} of {questions.length}
              </div>
              <CardTitle className="mt-2 text-base sm:text-lg">{q.prompt}</CardTitle>
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
                    <span className="text-sm">{opt}</span>
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
                    <span className="text-sm">{opt}</span>
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
