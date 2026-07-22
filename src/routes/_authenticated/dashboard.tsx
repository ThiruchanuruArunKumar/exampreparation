import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, PieChart, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ExamPrep" },
      { name: "description", content: "Your ExamPrep dashboard." },
      { property: "og:title", content: "Dashboard — ExamPrep" },
      { property: "og:description", content: "Your ExamPrep dashboard." },
    ],
  }),
  component: Dashboard,
});

type Assignment = {
  id: string;
  due_at: string | null;
  max_attempts: number;
  exams: { id: string; title: string; duration_minutes: number } | null;
  attempts: { id: string; status: string; score: number | null; max_score: number | null }[];
};

type Exam = {
  id: string;
  title: string;
  created_at: string;
  questions: { count: number }[];
  assignments: { count: number }[];
};

function Dashboard() {
  const navigate = useNavigate();
  const [role, setRole] = useState<"admin" | "student" | null>(null);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: r } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .maybeSingle();
      const myRole = (r?.role as "admin" | "student") ?? "student";
      setRole(myRole);

      if (myRole === "admin") {
        const { data } = await supabase
          .from("exams")
          .select("id, title, created_at, questions(count), assignments(count)")
          .order("created_at", { ascending: false });
        setExams((data as Exam[]) ?? []);
      } else {
        const { data } = await supabase
          .from("assignments")
          .select(
            "id, due_at, max_attempts, exams(id, title, duration_minutes), attempts(id, status, score, max_score)",
          )
          .eq("student_id", u.user.id)
          .order("assigned_at", { ascending: false });
        setAssignments((data as Assignment[]) ?? []);
      }
      setLoading(false);
    })();
  }, []);

  if (loading)
    return (
      <AppShell>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </AppShell>
    );

  if (role === "admin") {
    return (
      <AppShell title="Admin">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Your exams</h1>
          <Button onClick={() => navigate({ to: "/exams/new" })}>
            <Plus className="mr-2 h-4 w-4" /> New exam
          </Button>
        </div>

        {exams.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                No exams yet. Upload a file to generate your first exam.
              </p>
              <Button className="mt-4" onClick={() => navigate({ to: "/exams/new" })}>
                Create exam
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {exams.map((e) => (
              <Link
                key={e.id}
                to="/exams/$examId"
                params={{ examId: e.id }}
                className="rounded-lg border border-border p-5 transition hover:border-primary"
              >
                <h3 className="font-semibold">{e.title}</h3>
                <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{e.questions?.[0]?.count ?? 0} questions</Badge>
                  <Badge variant="secondary">{e.assignments?.[0]?.count ?? 0} assigned</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell title="Student">
      <h1 className="mb-6 text-2xl font-semibold">Your exams</h1>
      {assignments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No exams assigned yet. Your teacher will assign exams here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const done = a.attempts.filter((t) => t.status !== "in_progress");
            const inProg = a.attempts.find((t) => t.status === "in_progress");
            const best = done.reduce(
              (b, t) => ((t.score ?? 0) > (b?.score ?? -1) ? t : b),
              null as Assignment["attempts"][number] | null,
            );
            const remaining = a.max_attempts - done.length;
            return (
              <Card key={a.id}>
                <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="text-lg">{a.exams?.title}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.exams?.duration_minutes} min · {remaining} attempt{remaining === 1 ? "" : "s"} left
                      {a.due_at && ` · due ${new Date(a.due_at).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {best && (
                      <Link to="/results/$attemptId" params={{ attemptId: best.id }}>
                        <Button variant="outline" size="sm">
                          <PieChart className="mr-2 h-4 w-4" />
                          Best: {best.score}/{best.max_score}
                        </Button>
                      </Link>
                    )}
                    {inProg ? (
                      <Link to="/attempts/$attemptId" params={{ attemptId: inProg.id }}>
                        <Button size="sm">Resume</Button>
                      </Link>
                    ) : remaining > 0 ? (
                      <StartExamButton assignmentId={a.id} />
                    ) : (
                      <Button size="sm" disabled>
                        No attempts left
                      </Button>
                    )}
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function StartExamButton({ assignmentId }: { assignmentId: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const { startAttempt } = await import("@/lib/attempts.functions");
          const r = await startAttempt({ data: { assignmentId } });
          navigate({ to: "/attempts/$attemptId", params: { attemptId: r.attemptId } });
        } catch (e) {
          setBusy(false);
          alert((e as Error).message);
        }
      }}
    >
      {busy ? "Starting…" : "Start exam"}
    </Button>
  );
}
