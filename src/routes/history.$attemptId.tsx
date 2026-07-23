import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";

import {
  Brain,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RichContent } from "@/components/RichContent";
import { getHistoryAttemptDetail, getHistoryExplanation } from "@/lib/student.functions";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

const searchSchema = z.object({ sid: z.string().trim().min(1).max(40).optional() });

export const Route = createFileRoute("/history/$attemptId")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Result details — ExamPrep" },
      { name: "description", content: "Detailed exam result with answer sheet and answer book." },
      { property: "og:title", content: "Result details — ExamPrep" },
      { property: "og:description", content: "Detailed exam result with answer sheet and answer book." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryDetail,
});

type Detail = Awaited<ReturnType<typeof getHistoryAttemptDetail>>;

function HistoryDetail() {
  const { attemptId } = Route.useParams();
  const { sid } = Route.useSearch();
  const navigate = useNavigate();
  const studentCode = sid?.toUpperCase() ?? "";

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<"summary" | "sheet" | "book">("summary");
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [expBusy, setExpBusy] = useState<Record<string, boolean>>({});

  const fetchDetail = useCallback(async () => {
    if (!studentCode) {
      setErr("Missing student ID. Open this page from your history list.");
      setLoading(false);
      return;
    }
    try {
      const d = await getHistoryAttemptDetail({ data: { attemptId, studentCode } });
      setDetail(d);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [attemptId, studentCode]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  useRealtimeSync(["attempts", "answers", "insights"], () => {
    fetchDetail().catch(() => {});
  });

  const loadExplanation = async (qid: string) => {
    if (!studentCode || explanations[qid] || expBusy[qid]) return;
    setExpBusy((b) => ({ ...b, [qid]: true }));
    try {
      const r = await getHistoryExplanation({ data: { attemptId, studentCode, questionId: qid } });
      setExplanations((e) => ({ ...e, [qid]: r.explanation }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExpBusy((b) => ({ ...b, [qid]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <span className="font-semibold">ExamPrep</span>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate({ to: "/history", search: { sid: studentCode || undefined } as never })
            }
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to history
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
        {loading && <p className="text-sm text-muted-foreground">Loading result…</p>}
        {err && !loading && (
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Can't open this result</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">{err}</p>
              <Link to="/history">
                <Button>Go to history</Button>
              </Link>
            </CardContent>
          </Card>
        )}
        {detail && detail.exam && <DetailBody
          detail={detail}
          tab={tab}
          setTab={setTab}
          explanations={explanations}
          expBusy={expBusy}
          loadExplanation={loadExplanation}
        />}
      </main>
    </div>
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
  const hasReview = exam.showAnswerSheet || exam.showAnswerBook;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            <CheckCircle2 className="h-6 w-6 text-primary" />
            {exam.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {student.name} · {student.student_code}
            {attempt.submitted_at
              ? ` · ${new Date(attempt.submitted_at).toLocaleString()}`
              : ""}
          </p>
        </CardHeader>
        <CardContent>
          {!exam.showResult ? (
            <p className="text-sm text-muted-foreground">
              Your teacher has not released the score for this exam yet.
            </p>
          ) : (
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-5xl font-bold sm:text-6xl">
                  {score}
                  <span className="text-2xl text-muted-foreground">/{maxScore}</span>
                </div>
                <div className="mt-1 text-base text-muted-foreground">{pct}%</div>
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
          )}
        </CardContent>
      </Card>

      {exam.showResult && hasReview && (
        <div className="flex flex-wrap gap-2">
          <Button variant={tab === "summary" ? "default" : "outline"} size="sm" onClick={() => setTab("summary")}>
            Summary
          </Button>
          {exam.showAnswerSheet && (
            <Button variant={tab === "sheet" ? "default" : "outline"} size="sm" onClick={() => setTab("sheet")}>
              Answer sheet
            </Button>
          )}
          {exam.showAnswerBook && (
            <Button variant={tab === "book" ? "default" : "outline"} size="sm" onClick={() => setTab("book")}>
              Answer book
            </Button>
          )}
        </div>
      )}

      {exam.showResult && tab === "summary" && (
        insight ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> AI feedback
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <RichContent className="text-sm">{insight.summary}</RichContent>
              {(insight.weak_topics?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-1 flex items-center gap-1 text-sm font-medium text-destructive">
                    <TrendingDown className="h-4 w-4" /> Needs work
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {insight.weak_topics!.map((t: string) => (
                      <Badge key={t} variant="destructive">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {(insight.strong_topics?.length ?? 0) > 0 && (
                <div>
                  <div className="mb-1 flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="h-4 w-4" /> Strong areas
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {insight.strong_topics!.map((t: string) => (
                      <Badge key={t} className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300">{t}</Badge>
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

      {exam.showResult && tab !== "summary" && (
        <div className="space-y-3">
          {questions.length === 0 && (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                Detailed review is not enabled for this exam.
              </CardContent>
            </Card>
          )}
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
                        <span className="text-emerald-600 dark:text-emerald-400">✓ {q.marks_awarded ?? 0}/{q.marks}</span>
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
                      {q.options.map((o: string) => {
                        const isCorrect = correct.includes(o);
                        const isChosen = chose.includes(o);
                        return (
                          <li
                            key={o}
                            className={
                              isCorrect
                                ? "font-semibold text-emerald-600 dark:text-emerald-400"
                                : isChosen
                                  ? "text-destructive line-through"
                                  : ""
                            }
                          >
                            <RichContent inline>{o}</RichContent>
                            {isCorrect && " ✓"}
                            {!isCorrect && isChosen && " (your answer)"}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {(q.type === "short" || q.type === "tf") && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-md border border-border p-2">
                        <div className="text-xs text-muted-foreground">Your answer</div>
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

                  {tab === "book" && exam.showAnswerBook && (
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
    </>
  );
}
