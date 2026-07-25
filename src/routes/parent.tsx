import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Printer,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  Loader2,
  GraduationCap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getStudentHistory } from "@/lib/student.functions";
import { getLastStudentId, setLastStudentId } from "@/lib/lastStudentId";

export const Route = createFileRoute("/parent")({
  head: () => ({
    meta: [
      { title: "Parent progress report — ExamPrep" },
      {
        name: "description",
        content:
          "Parents and guardians: enter a student ID to see a printable summary of exam performance, trends and weak topics.",
      },
      { property: "og:title", content: "Parent progress report — ExamPrep" },
      {
        property: "og:description",
        content: "A printable, read-only overview of a student's exam performance and weak areas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://exampreparation.lovable.app/parent" }],
  }),
  component: ParentReport,
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
    weak_topics: string[] | null;
    strong_topics: string[] | null;
    recommendations: string;
  } | null;
};

type StudentInfo = { name: string; student_code: string; email: string | null; class_name: string | null };

const pct = (s: number | null, m: number | null) =>
  m && m > 0 && s !== null ? Math.round((s / m) * 1000) / 10 : null;

function topCounts(items: (string[] | null | undefined)[], limit = 6) {
  const map = new Map<string, number>();
  for (const list of items) {
    for (const raw of list ?? []) {
      const t = String(raw).trim();
      if (!t) continue;
      map.set(t, (map.get(t) ?? 0) + 1);
    }
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function ParentReport() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const fetchFor = useCallback(async (c: string) => {
    const r = await getStudentHistory({ data: { studentCode: c } });
    setStudent(r.student as StudentInfo);
    setHistory(r.history as HistoryItem[]);
    setLastStudentId(c);
  }, []);

  useEffect(() => {
    const saved = getLastStudentId();
    if (saved) {
      setCode(saved);
      void fetchFor(saved).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return toast.error("Enter the student ID");
    setBusy(true);
    try {
      await fetchFor(code.trim().toUpperCase());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load report");
      setStudent(null);
      setHistory([]);
    } finally {
      setBusy(false);
    }
  };

  const graded = history.filter((h) => h.status === "submitted" && pct(h.score, h.max_score) !== null);
  const scores = graded.map((h) => pct(h.score, h.max_score) as number);
  const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
  const best = scores.length ? Math.max(...scores) : null;
  const low = scores.length ? Math.min(...scores) : null;
  // history comes newest-first
  const recent = scores.slice(0, 3);
  const earlier = scores.slice(3, 6);
  const trend =
    recent.length && earlier.length
      ? Math.round(
          (recent.reduce((a, b) => a + b, 0) / recent.length -
            earlier.reduce((a, b) => a + b, 0) / earlier.length) *
            10,
        ) / 10
      : null;
  const warnings = history.reduce((a, h) => a + (h.warning_count ?? 0), 0);
  const weak = topCounts(graded.map((h) => h.insight?.weak_topics));
  const strong = topCounts(graded.map((h) => h.insight?.strong_topics));

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
        <div className="mb-6 flex items-center justify-between gap-3 print:hidden">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          {student && (
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
            </Button>
          )}
        </div>

        <header className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5" /> For parents &amp; guardians
          </div>
          <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight text-foreground">
            Progress report
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            A read-only overview of exam performance, improvement trend and the topics that need attention.
          </p>
        </header>

        <form onSubmit={submit} className="mb-8 flex max-w-sm gap-2 print:hidden">
          <Input
            placeholder="Student ID (ABCDEF)"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "View"}
          </Button>
        </form>

        {student && (
          <div className="animate-fade-in space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {student.name}{" "}
                  <span className="font-mono text-sm font-normal text-muted-foreground">
                    ({student.student_code})
                  </span>
                </CardTitle>
                {student.class_name && (
                  <p className="text-sm text-muted-foreground">Class: {student.class_name}</p>
                )}
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Exams taken" value={graded.length ? String(graded.length) : "0"} />
                <Stat label="Average score" value={avg !== null ? `${avg}%` : "—"} />
                <Stat label="Best" value={best !== null ? `${best}%` : "—"} icon={<TrendingUp className="h-4 w-4 text-emerald-600" />} />
                <Stat label="Lowest" value={low !== null ? `${low}%` : "—"} icon={<TrendingDown className="h-4 w-4 text-rose-600" />} />
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4" /> Recent trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {trend === null ? (
                    <p className="text-sm text-muted-foreground">
                      Needs at least 4 completed exams to compare recent performance with earlier attempts.
                    </p>
                  ) : (
                    <p className="text-sm">
                      <span
                        className={`text-2xl font-semibold ${trend >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                      >
                        {trend >= 0 ? "+" : ""}
                        {trend}%
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {trend >= 0 ? "improvement" : "drop"} in the last 3 exams vs the 3 before.
                      </span>
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldAlert className="h-4 w-4" /> Exam integrity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {warnings === 0
                      ? "No proctoring warnings recorded. All exams were taken without leaving the screen."
                      : `${warnings} proctoring warning${warnings === 1 ? "" : "s"} recorded across all attempts (leaving the exam screen or screenshot attempts).`}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TopicCard title="Needs attention" empty="No weak topics identified yet." items={weak} tone="weak" />
              <TopicCard title="Strong areas" empty="No strong areas identified yet." items={strong} tone="strong" />
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Exam-by-exam</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {graded.length === 0 && (
                  <p className="text-sm text-muted-foreground">No completed exams yet.</p>
                )}
                {graded.map((h) => {
                  const p = pct(h.score, h.max_score) as number;
                  return (
                    <div
                      key={h.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {h.exam?.title ?? "Exam"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {h.submitted_at ? new Date(h.submitted_at).toLocaleDateString() : "—"}
                          {h.auto_submitted ? " · auto-submitted" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(h.warning_count ?? 0) > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {h.warning_count} warning{(h.warning_count ?? 0) === 1 ? "" : "s"}
                          </Badge>
                        )}
                        <span
                          className={`text-sm font-semibold ${p >= 60 ? "text-emerald-600" : p >= 40 ? "text-amber-600" : "text-rose-600"}`}
                        >
                          {p}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground print:hidden">
              This report is generated from published exam data only. Detailed answer sheets stay in the
              student's own results section.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 font-heading text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TopicCard({
  title,
  items,
  empty,
  tone,
}: {
  title: string;
  items: [string, number][];
  empty: string;
  tone: "weak" | "strong";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {items.map(([topic, n]) => (
              <span
                key={topic}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  tone === "weak"
                    ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                }`}
              >
                {topic}
                {n > 1 ? ` ×${n}` : ""}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
