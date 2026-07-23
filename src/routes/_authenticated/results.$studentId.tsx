import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adminGetStudentHistory } from "@/lib/admin.functions";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/results/$studentId")({
  head: () => ({
    meta: [
      { title: "Student history — ExamPrep" },
      { name: "description", content: "Full exam history for a student." },
      { property: "og:title", content: "Student history — ExamPrep" },
      { property: "og:description", content: "Full exam history for a student." },
    ],
  }),
  component: StudentHistoryPage,
});

function StudentHistoryPage() {
  const { studentId } = Route.useParams();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    adminGetStudentHistory({ data: { studentId } })
      .then(setData)
      .catch((e) => setErr((e as Error).message));
  }, [studentId]);

  useEffect(() => { load(); }, [load]);
  useRealtimeSync(["attempts", "insights", "students"], load);

  if (err) return <AppShell title="Student history"><p className="text-sm text-destructive">{err}</p></AppShell>;
  if (!data) return <AppShell title="Student history"><p className="text-sm text-muted-foreground">Loading…</p></AppShell>;

  const s = data.student;
  const history: any[] = data.history;
  const finished = history.filter((h) => h.status !== "in_progress");
  const totalScore = finished.reduce((n, r) => n + Number(r.score ?? 0), 0);
  const totalMax = finished.reduce((n, r) => n + Number(r.max_score ?? 0), 0);
  const avg = totalMax ? Math.round((totalScore / totalMax) * 100) : null;

  return (
    <AppShell title="Student history">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/results"><ArrowLeft className="mr-1 h-4 w-4" /> All students</Link>
      </Button>

      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold">{s.name}</h1>
                <Badge variant="secondary" className="font-mono">{s.student_code}</Badge>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {s.email && <>{s.email} · </>}{s.class_name ?? "No class"}
              </div>
            </div>
            <div className="flex gap-6">
              <div>
                <div className="text-2xl font-semibold">{finished.length}</div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
              <div>
                <div className="text-2xl font-semibold">{avg == null ? "—" : `${avg}%`}</div>
                <div className="text-xs text-muted-foreground">Average</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Exam history ({history.length})</h2>
      {history.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No attempts yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {history.map((h) => {
            const pct = h.max_score ? Math.round((Number(h.score) / Number(h.max_score)) * 100) : 0;
            const inProgress = h.status === "in_progress";
            return (
              <Card key={h.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{h.exam?.title ?? "Exam"}</CardTitle>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {h.submitted_at ? (
                          <><CheckCircle2 className="h-3.5 w-3.5" /> Submitted {new Date(h.submitted_at).toLocaleString()}</>
                        ) : (
                          <><Clock className="h-3.5 w-3.5" /> Started {new Date(h.started_at).toLocaleString()}</>
                        )}
                        {h.auto_submitted && <Badge variant="destructive" className="text-[10px]">auto-submitted</Badge>}
                        {h.warning_count > 0 && (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" /> {h.warning_count} warning{h.warning_count > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      {inProgress ? (
                        <Badge variant="outline">In progress</Badge>
                      ) : (
                        <>
                          <div className="text-lg font-semibold">{h.score}/{h.max_score}</div>
                          <div className="text-xs text-muted-foreground">{pct}%</div>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {h.insight && (
                  <CardContent className="pt-0">
                    {h.insight.summary && (
                      <p className="text-sm text-muted-foreground">{h.insight.summary}</p>
                    )}
                    {(h.insight.weak_topics?.length || h.insight.strong_topics?.length) ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(h.insight.strong_topics ?? []).map((t: string) => (
                          <Badge key={`s-${t}`} variant="secondary" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">✓ {t}</Badge>
                        ))}
                        {(h.insight.weak_topics ?? []).map((t: string) => (
                          <Badge key={`w-${t}`} variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400">△ {t}</Badge>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
