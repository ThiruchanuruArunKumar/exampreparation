import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RichContent } from "@/components/RichContent";
import { adminGetAttemptDetail, adminGetAttemptExplanation } from "@/lib/admin.functions";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export const Route = createFileRoute("/_authenticated/attempt-results/$attemptId")({
  head: () => ({
    meta: [
      { title: "Attempt result — ExamPrep" },
      { name: "description", content: "Detailed exam attempt with answer sheet and answer book." },
      { property: "og:title", content: "Attempt result — ExamPrep" },
      { property: "og:description", content: "Detailed exam attempt with answer sheet and answer book." },
    ],
  }),
  component: AdminAttemptResult,
});

type Detail = Awaited<ReturnType<typeof adminGetAttemptDetail>>;

function AdminAttemptResult() {
  const { attemptId } = Route.useParams();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"summary" | "sheet" | "book">("summary");
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [expBusy, setExpBusy] = useState<Record<string, boolean>>({});

  const fetchDetail = useCallback(async () => {
    try {
      const d = await adminGetAttemptDetail({ data: { attemptId } });
      setDetail(d);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);
  useRealtimeSync(["attempts", "answers", "insights"], () => { fetchDetail().catch(() => {}); });

  const loadExplanation = async (qid: string) => {
    if (explanations[qid] || expBusy[qid]) return;
    setExpBusy((b) => ({ ...b, [qid]: true }));
    try {
      const r = await adminGetAttemptExplanation({ data: { attemptId, questionId: qid } });
      setExplanations((e) => ({ ...e, [qid]: r.explanation }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExpBusy((b) => ({ ...b, [qid]: false }));
    }
  };

  return (
    <AppShell title="Attempt result">
      {loading && <p className="text-sm text-muted-foreground">Loading result…</p>}
      {err && !loading && (
        <Card>
          <CardHeader><CardTitle className="text-destructive">Can't open this result</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{err}</p>
            <Link to="/results"><Button>Back to results</Button></Link>
          </CardContent>
        </Card>
      )}
      {detail && detail.exam && (
        <>
          <div className="mb-4">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link
                to="/results/$studentId"
                params={{ studentId: detail.student?.id ?? "" }}
              >
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to student history
              </Link>
            </Button>
          </div>
          <div className="space-y-4">
            <DetailBody
              detail={detail}
              tab={tab}
              setTab={setTab}
              explanations={explanations}
              expBusy={expBusy}
              loadExplanation={loadExplanation}
            />
          </div>
        </>
      )}
    </AppShell>
  );
}

function DetailBody({
  detail,
  tab,
  setTab,
  explanations,
  expBusy,
  loadExplanation,
}: {
  detail: Detail;
  tab: "summary" | "sheet" | "book";
  setTab: (t: "summary" | "sheet" | "book") => void;
  explanations: Record<string, string>;
  expBusy: Record<string, boolean>;
  loadExplanation: (qid: string) => void;
}) {
  const { exam, attempt, insight: rawInsight, questions, student } = detail;
  const insight = rawInsight as null | {
    summary: string;
    weak_topics: string[] | null;
    strong_topics: string[] | null;
    recommendations: string | null;
  };
  if (!exam) return null;
  const score = Number(attempt.score ?? 0);
  const maxScore = Number(attempt.max_score ?? 0);
  const pct = maxScore ? Math.round((score / maxScore) * 100) : 0;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            {exam.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {student?.name} · {student?.student_code}
            {attempt.submitted_at ? ` · ${new Date(attempt.submitted_at).toLocaleString()}` : ""}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-5xl font-bold sm:text-6xl">
                {score}
                <span className="text-2xl text-muted-foreground">/{maxScore}</span>
              </div>
              <div className="mt-1 text-base text-muted-foreground">{pct}%</div>
              {!exam.showResult && (
                <div className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Result not yet published to student
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {attempt.auto_submitted && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> Auto-submitted
                </Badge>
              )}
              {(attempt.warning_count ?? 0) > 0 && (
                <Badge variant="outline">
                  {attempt.warning_count} warning{attempt.warning_count === 1 ? "" : "s"}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant={tab === "summary" ? "default" : "outline"} size="sm" onClick={() => setTab("summary")}>
          Summary
        </Button>
        <Button variant={tab === "sheet" ? "default" : "outline"} size="sm" onClick={() => setTab("sheet")}>
          Answer sheet{exam.showAnswerSheet ? "" : " · Hidden from student"}
        </Button>
        <Button variant={tab === "book" ? "default" : "outline"} size="sm" onClick={() => setTab("book")}>
          Answer book{exam.showAnswerBook ? "" : " · Hidden from student"}
        </Button>
      </div>

      {tab === "summary" && (
        insight ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> AI feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RichContent className="text-sm">{insight.summary}</RichContent>
              {(insight.strong_topics?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-1 flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="h-4 w-4" /> Strong areas
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {insight.strong_topics!.map((t) => (
                      <Badge key={t} className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {(insight.weak_topics?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-1 flex items-center gap-1 text-sm font-medium text-destructive">
                    <TrendingDown className="h-4 w-4" /> Needs work
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {insight.weak_topics!.map((t) => (
                      <Badge key={t} variant="destructive">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {insight.recommendations && (
                <div>
                  <div className="mb-1 text-sm font-medium">Study plan</div>
                  <RichContent className="text-sm">{insight.recommendations}</RichContent>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No AI feedback saved for this attempt.
            </CardContent>
          </Card>
        )
      )}

      {tab === "sheet" && (
        <QuestionList
          questions={questions}
          mode="sheet"
          explanations={explanations}
          expBusy={expBusy}
          loadExplanation={loadExplanation}
          showBook={false}
        />
      )}

      {tab === "book" && (
        <QuestionList
          questions={questions}
          mode="book"
          explanations={explanations}
          expBusy={expBusy}
          loadExplanation={loadExplanation}
          showBook={true}
        />
      )}
    </>
  );
}

function QuestionList({
  questions,
  mode,
  explanations,
  expBusy,
  loadExplanation,
  showBook,
}: {
  questions: any[];
  mode: "sheet" | "book";
  explanations: Record<string, string>;
  expBusy: Record<string, boolean>;
  loadExplanation: (qid: string) => void;
  showBook: boolean;
}) {
  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          No questions available for review.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {questions.map((q: any, i: number) => {
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
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ✓ {q.marks_awarded ?? 0}/{q.marks}
                    </span>
                  ) : (
                    <span className="text-destructive">
                      ✗ {q.marks_awarded ?? 0}/{q.marks}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 text-sm">
              <div className="font-medium"><RichContent>{q.prompt}</RichContent></div>
              {q.options && (
                <ul className="space-y-1.5 text-xs">
                  {q.options.map((o: string) => {
                    const isCorrect = correct.includes(o);
                    const isChosen = chose.includes(o);
                    return (
                      <li
                        key={o}
                        className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 ${
                          isCorrect
                            ? "border-emerald-500/40 bg-emerald-500/10 font-semibold text-emerald-700 dark:text-emerald-300"
                            : isChosen
                              ? "border-destructive/40 bg-destructive/5 text-destructive line-through"
                              : "border-border/60"
                        }`}
                      >
                        {isCorrect ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        ) : isChosen ? (
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                        ) : (
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                        )}
                        <div className="min-w-0 flex-1">
                          <RichContent inline>{o}</RichContent>
                          {!isCorrect && isChosen && (
                            <span className="ml-1 text-[10px] font-normal uppercase tracking-wide opacity-70">(student's answer)</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {(q.type === "short" || q.type === "tf") && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md border border-border p-2">
                    <div className="text-xs text-muted-foreground">Student's answer</div>
                    <div className="flex flex-wrap gap-x-2">
                      {chose.length
                        ? chose.map((c: string, ci: number) => (
                            <span key={ci}>
                              <RichContent inline>{c}</RichContent>
                              {ci < chose.length - 1 ? "," : ""}
                            </span>
                          ))
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-md border border-border p-2">
                    <div className="text-xs text-muted-foreground">Correct answer</div>
                    <div className="flex flex-wrap gap-x-2 font-medium text-emerald-600 dark:text-emerald-400">
                      {correct.map((c: string, ci: number) => (
                        <span key={ci}>
                          <RichContent inline>{c}</RichContent>
                          {ci < correct.length - 1 ? "," : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {mode === "book" && showBook && (
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
  );
}
