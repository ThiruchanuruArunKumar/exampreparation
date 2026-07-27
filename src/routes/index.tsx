import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, LogIn, ListChecks, Clock, CalendarDays, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { listStudentExams, startStudentAttempt } from "@/lib/student.functions";
import { getLastStudentId, setLastStudentId, clearLastStudentId, getRecentStudentIds, removeRecentStudentId } from "@/lib/lastStudentId";
import { ThemeToggle } from "@/components/ThemeToggle";

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
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    const saved = getRecentStudentIds();
    setRecentIds(saved);
    if (saved.length > 0) {
      setLookupCode(saved[0]);
      setStudentCode(saved[0]);
      void fetchExams(saved[0]);
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
      setRecentIds(getRecentStudentIds());
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
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Ambient hero backdrop */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-gradient-hero" />
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-[-15%] -z-10 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-gradient-mesh opacity-30 blur-3xl"
      />

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-elegant">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              Exam<span className="text-gradient">Prep</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/50 px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-muted hover:text-primary"
            >
              <LogIn className="h-4 w-4" /> Admin sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
          <div className="animate-fade-in-up">
            <Badge className="mb-5 gap-1.5 border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
              <Sparkles className="h-3 w-3" /> AI-proctored exam platform
            </Badge>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
              Take your <span className="text-gradient">proctored exam</span> with confidence
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Enter the student ID your teacher gave you and the exam password to begin.
              Secure, fair, and instant — no account needed.
            </p>
            <div className="mt-8" />

          </div>

          <Card className="relative animate-scale-in overflow-hidden border-border/60 shadow-elegant card-glass">
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-primary" />
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <GraduationCap className="h-4 w-4" />
                </span>
                Start your exam
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
                    className="font-mono tracking-widest"
                  />
                  {recentIds.filter(id => id !== studentCode.toUpperCase()).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>Recent:</span>
                      {recentIds.filter(id => id !== studentCode.toUpperCase()).map(id => (
                        <div key={id} className="flex items-center rounded-md border border-border bg-muted/50 group transition-colors hover:border-primary/50">
                          <button
                            type="button"
                            onClick={() => setStudentCode(id)}
                            className="px-2 py-0.5 font-mono text-xs font-semibold text-foreground hover:text-primary rounded-l-md"
                          >
                            {id}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              removeRecentStudentId(id);
                              setRecentIds(getRecentStudentIds());
                            }}
                            className="px-1.5 py-0.5 border-l border-border/50 text-muted-foreground hover:text-destructive transition-colors rounded-r-md opacity-50 group-hover:opacity-100"
                            title="Forget this ID"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
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
                    className="font-mono tracking-widest"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-gradient-primary shadow-elegant transition-transform hover:scale-[1.01] hover:shadow-glow"
                  size="lg"
                  disabled={busy}
                >
                  {busy ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting…</>
                  ) : (
                    <>Start exam <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
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
              {recentIds.filter(id => id !== lookupCode.toUpperCase()).length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Recent:</span>
                  {recentIds.filter(id => id !== lookupCode.toUpperCase()).map(id => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => { setLookupCode(id); void fetchExams(id); }}
                      className="rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-xs font-semibold text-foreground hover:bg-muted transition-colors hover:border-primary/50"
                    >
                      {id}
                    </button>
                  ))}
                </div>
              )}
              <Link
                to="/parent"
                className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Parent / guardian progress report →
              </Link>
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
                {exams.map((row, idx) => {
                  const latest = row.latest_attempt;
                  return (
                    <Card
                      key={row.exam.id}
                      style={{ animationDelay: `${idx * 60}ms` }}
                      className="flex h-full animate-fade-in-up flex-col border-border/60 card-glass hover-lift"
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
