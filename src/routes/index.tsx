import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Brain, ShieldCheck, Sparkles, GraduationCap, LogIn } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { startStudentAttempt } from "@/lib/student.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ExamPrep — Take your exam" },
      {
        name: "description",
        content:
          "Students enter their ID and exam password to start. Admins can create exams and analyse performance.",
      },
      { property: "og:title", content: "ExamPrep — Take your exam" },
      {
        property: "og:description",
        content:
          "Students enter their ID and exam password to start. Admins can create exams and analyse performance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [studentCode, setStudentCode] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [busy, setBusy] = useState(false);

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

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
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
                    placeholder="STU-XXXXX"
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                  />
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
                <p className="text-center text-xs text-muted-foreground">
                  Your teacher provides both the ID and the password.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
