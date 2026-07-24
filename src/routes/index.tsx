import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Brain, GraduationCap, LogIn, ListChecks, Clock, CalendarDays, ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { listStudentExams, startStudentAttempt } from "@/lib/student.functions";
import { getLastStudentId, setLastStudentId, clearLastStudentId } from "@/lib/lastStudentId";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ExamPrep — Take your exam" },
      {
        name: "description",
        content:
          "Students see their ongoing and upcoming exams, enter their ID and password to begin. Admins can create and analyse exams.",
      },
      { property: "og:title", content: "ExamPrep — Take your exam" },
      {
        property: "og:description",
        content:
          "See your ongoing and upcoming exams and start with your student ID and exam password.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

type ExamRow = Awaited<ReturnType<typeof listStudentExams>>["exams"][number];



function stateBadge(state: ExamRow["state"]) {
  switch (state) {
    case "ongoing":
      return <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400">Ongoing</Badge>;
    case "upcoming":
      return <Badge className="bg-sky-500/15 text-sky-600 hover:bg-sky-500/15 dark:text-sky-400">Upcoming</Badge>;
    case "closed":
      return <Badge variant="secondary">Closed</Badge>;
    case "completed":
      return <Badge variant="outline">Completed</Badge>;
  }
}

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function Landing() {
  const navigate = useNavigate();
  const [studentCode, setStudentCode] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [busy, setBusy] = useState(false);

  const [lookupCode, setLookupCode] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [exams, setExams] = useState<ExamRow[] | null>(null);
  const [studentName, setStudentName] = useState<string>("");
  const [lastId, setLastId] = useState<string | null>(null);

  useEffect(() => {
    const saved = getLastStudentId();
    setLastId(saved);
    if (saved) {
      setLookupCode(saved);
      setStudentCode(saved);
      void fetchExams(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchExams = async (code: string) => {
    const c = code.trim().toUpperCase();
    if (!c) return toast.error("Enter your student ID");
    setLoadingList(true);
    try {
      const r = await listStudentExams({ data: { studentCode: c } });
      setExams(r.exams);
      setStudentName(r.student.name);
      setLastStudentId(c);
      setLastId(c);
      setStudentCode(c);
    } catch (err) {
      setExams(null);
      toast.error((err as Error).message);
    } finally {
      setLoadingList(false);
    }
  };

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentCode.trim() || !accessCode.trim()) {
      return toast.error("Enter both student ID and exam password");
    }
    setBusy(true);
    try {
      const r = await startStudentAttempt({
        data: { studentCode: studentCode.trim(), accessCode: accessCode.trim() },
      });
      sessionStorage.setItem(`exam:${r.attemptId}`, r.sessionToken);
      navigate({ to: "/exam/$attemptId", params: { attemptId: r.attemptId } });
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">ExamPrep</span>
          </div>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <LogIn className="h-4 w-4" /> Admin sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Take your proctored exam
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Enter the student ID your teacher gave you and the exam password to begin. No account
              needed.
            </p>
          </div>

          <Card className="border-primary/30 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <GraduationCap className="h-5 w-5 text-primary" /> Start your exam
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={start} className="space-y-4">
                <div>
                  <Label htmlFor="sid">Student ID</Label>
                  <Input
                    id="sid"
                    autoComplete="off"
                    placeholder="ABCDEF"
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                    maxLength={6}
                  />
                  {lastId && lastId !== studentCode.toUpperCase() && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Last used:</span>
                      <button
                        type="button"
                        onClick={() => setStudentCode(lastId)}
                        className="rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs font-semibold text-foreground hover:bg-muted"
                      >
                        {lastId}
                      </button>
                      <button
                        type="button"
                        onClick={() => { clearLastStudentId(); setLastId(null); }}
                        className="text-xs text-muted-foreground/80 hover:text-foreground hover:underline"
                      >
                        Forget
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="ac">Exam password</Label>
                  <Input
                    id="ac"
                    autoComplete="off"
                    placeholder="6-character code"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                    maxLength={10}
                  />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={busy}>
                  {busy ? "Starting…" : "Start exam"}
                </Button>
                <div className="text-center text-xs text-muted-foreground">
                  Your teacher provides both the ID and the password.
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* My exams */}
        <section className="mt-14">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold sm:text-2xl">
                <ListChecks className="h-5 w-5 text-primary" /> My exams
              </h2>
              <p className="text-sm text-muted-foreground">
                See every ongoing and upcoming exam assigned to you.
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void fetchExams(lookupCode);
              }}
              className="flex w-full max-w-sm flex-col gap-1.5"
            >
              <div className="flex gap-2">
                <Input
                  placeholder="Student ID (ABCDEF)"
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
                <Button type="submit" disabled={loadingList}>
                  {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : "Show"}
                </Button>
              </div>
              {lastId && lastId !== lookupCode.toUpperCase() && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Last used:</span>
                  <button
                    type="button"
                    onClick={() => { setLookupCode(lastId); void fetchExams(lastId); }}
                    className="rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs font-semibold text-foreground hover:bg-muted"
                  >
                    {lastId}
                  </button>
                </div>
              )}
            </form>
          </div>

          {loadingList && !exams && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Loading your exams…
            </div>
          )}

          {exams && exams.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No exams assigned to <span className="font-medium">{studentName}</span> yet.
            </div>
          )}

          {exams && exams.length > 0 && (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{studentName}</span>
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {exams.map((row) => {
                  const latest = row.latest_attempt;
                  return (
                    <Card
                      key={row.exam.id}
                      className="flex h-full flex-col transition hover:border-primary/50 hover:shadow-md"
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base leading-tight">
                            {row.exam.title}
                          </CardTitle>
                          {stateBadge(row.state)}
                        </div>
                        {row.exam.pattern && (
                          <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                            {row.exam.pattern}
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col gap-3 text-sm">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {row.exam.duration_minutes} min · {row.exam.total_marks ?? 0} marks
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {row.exam.start_at ? fmt(row.exam.start_at) : "Anytime"}
                          </div>
                          {row.state === "upcoming" && row.exam.start_at && (
                            <div className="text-xs text-sky-600 dark:text-sky-400">
                              Opens {fmt(row.exam.start_at)}
                            </div>
                          )}
                          {row.state === "ongoing" && (
                            <div className="text-xs text-emerald-600 dark:text-emerald-400">
                              Available now
                              {row.exam.end_at ? ` · closes ${fmt(row.exam.end_at)}` : ""}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Attempts {row.attempts_used}/{row.max_attempts}
                          </div>
                        </div>

                        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
                          {row.state === "ongoing" && (
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={async () => {
                                try {
                                  const r = await startStudentAttempt({
                                    data: { studentCode, examId: row.exam.id },
                                  });
                                  sessionStorage.setItem(`exam:${r.attemptId}`, r.sessionToken);
                                  navigate({
                                    to: "/exam/$attemptId",
                                    params: { attemptId: r.attemptId },
                                  });
                                } catch (err) {
                                  toast.error((err as Error).message);
                                }
                              }}
                            >
                              {row.in_progress ? "Resume exam" : "Start exam"}
                            </Button>
                          )}
                          <Link
                            to="/exam-info/$examId"
                            params={{ examId: row.exam.id }}
                            search={{ student: studentCode }}
                            className="inline-flex items-center justify-between text-xs font-medium text-primary hover:underline"
                          >
                            Exam details <ArrowRight className="h-3 w-3" />
                          </Link>
                          {latest ? (
                            <Link
                              to="/history/$attemptId"
                              params={{ attemptId: latest.id }}
                              search={{ sid: studentCode }}
                              className="inline-flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                            >
                              View result <ArrowRight className="h-3 w-3" />
                            </Link>
                          ) : (
                            row.state !== "ongoing" && (
                              <div className="rounded-md border border-dashed border-border px-3 py-1.5 text-center text-xs text-muted-foreground">
                                No attempt yet
                              </div>
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
