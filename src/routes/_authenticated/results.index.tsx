import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { adminListStudentsWithStats } from "@/lib/admin.functions";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { ChevronRight, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/results/")({
  head: () => ({
    meta: [
      { title: "Results — ExamPrep" },
      { name: "description", content: "Per-student exam results and history." },
      { property: "og:title", content: "Results — ExamPrep" },
      { property: "og:description", content: "Per-student exam results and history." },
    ],
  }),
  component: ResultsPage,
});

type Row = {
  id: string;
  student_code: string;
  name: string;
  email: string | null;
  class_name: string | null;
  attempts_total: number;
  attempts_finished: number;
  average_percent: number | null;
  last_attempt_at: string | null;
};

function ResultsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    adminListStudentsWithStats()
      .then((r) => setRows(r.students as Row[]))
      .catch((e) => setErr((e as Error).message));
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeSync(["students", "attempts", "insights"], load);

  if (err) return <AppShell title="Results"><p className="text-sm text-destructive">{err}</p></AppShell>;
  if (!rows) return <AppShell title="Results"><p className="text-sm text-muted-foreground">Loading…</p></AppShell>;

  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((r) =>
        [r.name, r.student_code, r.email ?? "", r.class_name ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      )
    : rows;

  return (
    <AppShell title="Results">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Student results</h1>
          <p className="text-sm text-muted-foreground">Click a student to view their full exam history.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, ID, class…"
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No students match.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <Link
              key={s.id}
              to="/results/$studentId"
              params={{ studentId: s.id }}
              className="block rounded-lg border border-border bg-card p-4 transition hover:border-primary hover:bg-accent/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    <Badge variant="secondary" className="font-mono text-xs">{s.student_code}</Badge>
                    {s.class_name && <span className="text-xs text-muted-foreground">· {s.class_name}</span>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {s.attempts_finished} completed · {s.attempts_total} total
                    {s.last_attempt_at && ` · last ${new Date(s.last_attempt_at).toLocaleDateString()}`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-lg font-semibold">
                      {s.average_percent == null ? "—" : `${s.average_percent}%`}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">avg</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
