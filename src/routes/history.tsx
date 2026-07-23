import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Brain, History, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getStudentHistory } from "@/lib/student.functions";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "My results — ExamPrep" },
      { name: "description", content: "Enter your student ID to view your past exam results and AI feedback." },
      { property: "og:title", content: "My results — ExamPrep" },
      { property: "og:description", content: "View your past exam results and AI-generated study feedback." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

type HistoryItem = {
  id: string;
  status: string;
  score: number | null;
  max_score: number | null;
  submitted_at: string | null;
  started_at: string;
  auto_submitted: boolean | null;
  warning_count: number | null;
  exam: { id: string; title: string; duration_minutes: number } | null;
  insight: {
    summary: string;
    weak_topics: string[];
    strong_topics: string[];
    recommendations: string;
  } | null;
};

type StudentInfo = { name: string; student_code: string; email: string | null; class_name: string | null };

function HistoryPage() {
  const [studentCode, setStudentCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const load = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode.trim()) return toast.error("Enter your student ID");
    setBusy(true);
    try {
      const r = await getStudentHistory({ data: { studentCode: studentCode.trim() } });
      setStudent(r.student as StudentInfo);
      setHistory(r.history as HistoryItem[]);
      if (!r.history.length) toast.info("No exam attempts yet");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">ExamPrep</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <Card className="border-primary/30 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-primary" /> View your exam history
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={load} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="sid">Student ID</Label>
                <Input
                  id="sid"
                  autoComplete="off"
                  placeholder="STU-XXXXX"
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                />
              </div>
              <Button type="submit" disabled={busy} size="lg">
                {busy ? "Loading…" : "View results"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {student && (
          <div className="mt-8">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">{student.name}</h2>
              <p className="text-sm text-muted-foreground">
                {student.student_code}
                {student.class_name ? ` • ${student.class_name}` : ""}
              </p>
            </div>

            {history.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No exam attempts yet.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {history.map((h) => {
                  const pct =
                    h.score != null && h.max_score
                      ? Math.round((h.score / h.max_score) * 100)
                      : null;
                  const done = h.status !== "in_progress";
                  return (
                    <Card key={h.id}>
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base">
                              {h.exam?.title ?? "Exam"}
                            </CardTitle>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {new Date(h.submitted_at ?? h.started_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {done ? (
                              <Badge variant="secondary" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {h.score ?? 0} / {h.max_score ?? 0}
                                {pct != null && ` (${pct}%)`}
                              </Badge>
                            ) : (
                              <Badge variant="outline">In progress</Badge>
                            )}
                            {h.auto_submitted && (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" /> Auto-submitted
                              </Badge>
                            )}
                            {(h.warning_count ?? 0) > 0 && (
                              <Badge variant="outline">
                                {h.warning_count} warning{h.warning_count === 1 ? "" : "s"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      {h.insight && (
                        <CardContent className="space-y-3 pt-0 text-sm">
                          <p>{h.insight.summary}</p>
                          {h.insight.strong_topics?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-xs text-muted-foreground">Strong:</span>
                              {h.insight.strong_topics.map((t) => (
                                <Badge key={t} variant="secondary" className="text-xs">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {h.insight.weak_topics?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-xs text-muted-foreground">To improve:</span>
                              {h.insight.weak_topics.map((t) => (
                                <Badge key={t} variant="outline" className="text-xs">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {h.insight.recommendations && (
                            <div className="rounded-md bg-muted/50 p-3 text-xs">
                              <div className="mb-1 font-medium">Recommendations</div>
                              <p className="whitespace-pre-wrap text-muted-foreground">
                                {h.insight.recommendations}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
