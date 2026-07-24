import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  ShieldAlert,
  Award,
  ListChecks,
  Info,
  Play,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { getStudentExamInfo, startStudentAttempt } from "@/lib/student.functions";

export const Route = createFileRoute("/exam-info/$examId")({
  validateSearch: z.object({ student: z.string().optional() }),
  head: ({ params }) => ({
    meta: [
      { title: `Exam details — ExamPrep` },
      { name: "description", content: `Details, rules, and timing for exam ${params.examId}.` },
      { property: "og:title", content: "Exam details — ExamPrep" },
      { property: "og:description", content: "Review exam rules and timing before starting." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-center text-sm text-destructive">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-center text-sm text-muted-foreground">Exam not found.</div>
  ),
  component: ExamInfoPage,
});

type InfoResult = Awaited<ReturnType<typeof getStudentExamInfo>>;

function fmt(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function useCountdown(target: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!target) return null;
  const ms = new Date(target).getTime() - now;
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

function badge(state: InfoResult["state"]) {
  switch (state) {
    case "ongoing":
      return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Ongoing</Badge>;
    case "upcoming":
      return <Badge className="bg-sky-500/15 text-sky-600 dark:text-sky-400">Upcoming</Badge>;
    case "closed":
      return <Badge variant="secondary">Closed</Badge>;
    case "completed":
      return <Badge variant="outline">Completed</Badge>;
  }
}

function ExamInfoPage() {
  const { examId } = Route.useParams();
  const { student: studentParam } = Route.useSearch();
  const navigate = useNavigate();

  const [studentCode, setStudentCode] = useState(
    studentParam ?? (typeof window !== "undefined" ? localStorage.getItem("examprep:studentCode") ?? "" : ""),
  );
  const [info, setInfo] = useState<InfoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [accessCode, setAccessCode] = useState("");
  const [starting, setStarting] = useState(false);

  const load = async (code: string) => {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    try {
      const r = await getStudentExamInfo({ data: { studentCode: c, examId } });
      setInfo(r);
      localStorage.setItem("examprep:studentCode", c);
    } catch (err) {
      setInfo(null);
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (studentCode) void load(studentCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const countdown = useCountdown(info?.state === "upcoming" ? info.exam.start_at : null);
  const remaining = useCountdown(info?.state === "ongoing" ? info.exam.end_at : null);

  const rules = useMemo(() => {
    if (!info) return [];
    const r: string[] = [
      `Duration is ${info.exam.duration_minutes} minutes; timer is enforced.`,
      `Total marks: ${info.exam.total_marks ?? 0}.`,
    ];
    if (info.exam.negative_mark_per_wrong)
      r.push(`Negative marking: −${info.exam.negative_mark_per_wrong} per wrong answer.`);
    if (info.exam.shuffle_questions) r.push("Question order is shuffled.");
    if (info.exam.shuffle_options) r.push("Answer options are shuffled.");
    r.push("Do not exit the exam tab. You get 3 warnings; the exam auto-submits after that.");
    r.push("Copy, paste, right-click and dev tools are disabled during the exam.");
    if (info.exam.show_result_after_submit) r.push("Your score is shown immediately after submission.");
    if (info.exam.show_answer_sheet) r.push("You can review the answer sheet after submitting.");
    if (info.exam.show_answer_book) r.push("Step-by-step AI explanations are available after submitting.");
    return r;
  }, [info]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    if (info.in_progress_attempt_id) {
      const token = sessionStorage.getItem(`exam:${info.in_progress_attempt_id}`);
      if (token) {
        navigate({ to: "/exam/$attemptId", params: { attemptId: info.in_progress_attempt_id } });
        return;
      }
    }
    setStarting(true);
    try {
      const r = await startStudentAttempt({
        data: { studentCode, examId },
      });
      sessionStorage.setItem(`exam:${r.attemptId}`, r.sessionToken);
      navigate({ to: "/exam/$attemptId", params: { attemptId: r.attemptId } });
    } catch (err) {
      toast.error((err as Error).message);
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All exams
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {!studentCode && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Enter your student ID to view details</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void load(studentCode);
                }}
              >
                <Input
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                  placeholder="ABCDEF"
                  maxLength={6}
                />
                <Button type="submit">View</Button>
              </form>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Loading exam details…
          </div>
        )}

        {info && (
          <>
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-2">
                {badge(info.state)}
                {info.exam.pattern && (
                  <Badge variant="outline" className="uppercase">{info.exam.pattern}</Badge>
                )}
              </div>
              <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{info.exam.title}</h1>
              {info.exam.description && (
                <p className="mt-2 text-sm text-muted-foreground">{info.exam.description}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Clock className="h-4 w-4" /> Duration
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-lg font-semibold">
                  {info.exam.duration_minutes} minutes
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Award className="h-4 w-4" /> Total marks
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-lg font-semibold">
                  {info.exam.total_marks ?? 0}
                  {info.exam.negative_mark_per_wrong ? (
                    <span className="ml-2 text-xs font-normal text-destructive">
                      −{info.exam.negative_mark_per_wrong} per wrong
                    </span>
                  ) : null}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <CalendarDays className="h-4 w-4" /> Starts
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="font-medium">{fmt(info.exam.start_at)}</div>
                  {info.state === "upcoming" && countdown && (
                    <div className="mt-1 text-xs text-sky-600 dark:text-sky-400">Opens in {countdown}</div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <CalendarDays className="h-4 w-4" /> Ends
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="font-medium">{fmt(info.exam.end_at)}</div>
                  {info.state === "ongoing" && remaining && (
                    <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Closes in {remaining}</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="h-4 w-4 text-primary" /> Exam rules
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {rules.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="h-4 w-4 text-primary" /> Your attempts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Used</span>
                  <span className="font-medium">
                    {info.attempts_used} / {info.assignment.max_attempts}
                  </span>
                </div>
                {info.assignment.due_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Due date</span>
                    <span className="font-medium">{fmt(info.assignment.due_at)}</span>
                  </div>
                )}
                {info.attempts.length > 0 && (
                  <>
                    <Separator className="my-2" />
                    <ul className="space-y-1 text-xs">
                      {info.attempts.map((a) => {
                        const label =
                          a.status === "in_progress"
                            ? "in progress"
                            : `${a.score ?? 0}/${a.max_score ?? 0}`;
                        return (
                          <li key={a.id}>
                            {a.status === "in_progress" ? (
                              <div className="flex items-center justify-between">
                                <span>{fmt(a.started_at)}</span>
                                <span className="font-mono">{label}</span>
                              </div>
                            ) : (
                              <Link
                                to="/history/$attemptId"
                                params={{ attemptId: a.id }}
                                search={{ sid: studentCode }}
                                className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-muted"
                              >
                                <span>{fmt(a.started_at)}</span>
                                <span className="inline-flex items-center gap-1 font-mono text-primary">
                                  {label} <ArrowLeft className="h-3 w-3 rotate-180" />
                                </span>
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="mt-4 border-primary/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Play className="h-4 w-4 text-primary" />
                  {info.state === "ongoing"
                    ? info.in_progress_attempt_id
                      ? "Resume your exam"
                      : "Start the exam"
                    : info.state === "upcoming"
                      ? "This exam has not started yet"
                      : info.state === "completed"
                        ? "You have completed this exam"
                        : "This exam window has closed"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {info.state === "ongoing" ? (
                  <form onSubmit={start} className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      You are assigned to this exam — no password required.
                    </p>
                    <Button type="submit" className="w-full" size="lg" disabled={starting}>
                      {starting ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting…</>
                      ) : info.in_progress_attempt_id ? (
                        "Resume exam"
                      ) : (
                        "Start exam"
                      )}
                    </Button>
                  </form>

                ) : info.state === "upcoming" ? (
                  <div className="rounded-md bg-muted p-3 text-sm">
                    <Info className="mr-1 inline h-4 w-4 text-sky-500" />
                    Opens on <span className="font-medium">{fmt(info.exam.start_at)}</span>
                    {countdown ? <> · in <span className="font-medium">{countdown}</span></> : null}
                  </div>
                ) : (
                  <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                    {info.state === "completed"
                      ? "You have used all your attempts for this exam."
                      : "The exam window has closed and can no longer be started."}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
