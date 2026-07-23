import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { RichContent } from "@/components/RichContent";


export const Route = createFileRoute("/_authenticated/attempt-results/$attemptId")({
  head: () => ({
    meta: [
      { title: "Results — ExamPrep" },
      { name: "description", content: "Your exam results with AI insights." },
      { property: "og:title", content: "Results — ExamPrep" },
      { property: "og:description", content: "Your exam results with AI insights." },
    ],
  }),
  component: Results,
});

type Attempt = {
  id: string;
  score: number | null;
  max_score: number | null;
  status: string;
  warning_count: number;
  auto_submitted: boolean;
  submitted_at: string | null;
  exams: { title: string } | null;
};
type Answer = {
  question_id: string;
  response: string[];
  is_correct: boolean | null;
  marks_awarded: number | null;
  questions: {
    id: string;
    prompt: string;
    type: string;
    options: string[] | null;
    correct_answer: string[];
    marks: number;
    topic: string | null;
  } | null;
};
type Insight = {
  summary: string;
  weak_topics: string[];
  strong_topics: string[];
  recommendations: string;
};

function Results() {
  const { attemptId } = Route.useParams();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [insight, setInsight] = useState<Insight | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: ans }, { data: ins }] = await Promise.all([
        supabase
          .from("attempts")
          .select("id, score, max_score, status, warning_count, auto_submitted, submitted_at, exams(title)")
          .eq("id", attemptId)
          .single(),
        supabase
          .from("answers")
          .select(
            "question_id, response, is_correct, marks_awarded, questions(id, prompt, type, options, correct_answer, marks, topic)",
          )
          .eq("attempt_id", attemptId),
        supabase.from("insights").select("summary, weak_topics, strong_topics, recommendations").eq("attempt_id", attemptId).maybeSingle(),
      ]);
      setAttempt(a as unknown as Attempt);
      setAnswers((ans as unknown as Answer[]) ?? []);
      setInsight((ins as Insight) ?? null);
    })();
  }, [attemptId]);

  if (!attempt) return <AppShell><p>Loading…</p></AppShell>;

  const pct = attempt.max_score ? Math.round(((attempt.score ?? 0) / attempt.max_score) * 100) : 0;

  return (
    <AppShell title="Results">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold">{attempt.exams?.title}</h1>
          <p className="text-sm text-muted-foreground">
            {attempt.submitted_at && new Date(attempt.submitted_at).toLocaleString()}
            {attempt.auto_submitted && " · auto-submitted"}
            {attempt.warning_count > 0 && ` · ${attempt.warning_count} warning${attempt.warning_count === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link to="/dashboard">
          <Button variant="outline" size="sm">Back</Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Score</CardTitle></CardHeader>
          <CardContent>
            <div className="text-5xl font-bold">
              {attempt.score ?? 0}
              <span className="text-2xl text-muted-foreground">/{attempt.max_score ?? 0}</span>
            </div>
            <div className="mt-2 text-lg text-muted-foreground">{pct}%</div>
          </CardContent>
        </Card>

        {insight && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> AI insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>{insight.summary}</p>
              {insight.weak_topics.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center gap-1 font-medium text-destructive">
                    <TrendingDown className="h-4 w-4" /> Needs work
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {insight.weak_topics.map((t) => (
                      <Badge key={t} variant="destructive">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {insight.strong_topics.length > 0 && (
                <div>
                  <div className="mb-1 flex items-center gap-1 font-medium text-primary">
                    <TrendingUp className="h-4 w-4" /> Strong areas
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {insight.strong_topics.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-md border border-border p-3">
                <div className="mb-1 font-medium">Study recommendations</div>
                <p className="whitespace-pre-wrap">{insight.recommendations}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Answer review</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {answers.map((a, i) => {
            const q = a.questions;
            if (!q) return null;
            return (
              <div key={a.question_id} className="rounded-md border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      Q{i + 1}
                      <Badge variant="secondary">{q.type}</Badge>
                      {q.topic && <Badge variant="outline">{q.topic}</Badge>}
                    </div>
                    <div className="mt-1 text-sm font-medium"><RichContent>{q.prompt}</RichContent></div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-sm">
                    {a.is_correct ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    <span>{a.marks_awarded ?? 0}/{q.marks}</span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Your answer</div>
                    <div className="flex flex-wrap gap-x-2">
                      {a.response?.length
                        ? a.response.map((r: string, ri: number) => (
                            <span key={ri}><RichContent inline>{r}</RichContent>{ri < a.response.length - 1 ? "," : ""}</span>
                          ))
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Correct answer</div>
                    <div className="flex flex-wrap gap-x-2 text-primary">
                      {q.correct_answer.map((r: string, ri: number) => (
                        <span key={ri}><RichContent inline>{r}</RichContent>{ri < q.correct_answer.length - 1 ? "," : ""}</span>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </CardContent>
      </Card>
    </AppShell>
  );
}
