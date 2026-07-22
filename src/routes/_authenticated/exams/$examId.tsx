import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { listStudents } from "@/lib/exams.functions";
import { reassignAttempt } from "@/lib/attempts.functions";
import { Trash2, RotateCcw, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/exams/$examId")({
  head: () => ({
    meta: [
      { title: "Exam — ExamPrep" },
      { name: "description", content: "Manage exam, assignments, and results." },
      { property: "og:title", content: "Exam — ExamPrep" },
      { property: "og:description", content: "Manage exam, assignments, and results." },
    ],
  }),
  component: ExamDetail,
});

type Student = { id: string; email: string | null; full_name: string | null };
type Exam = { id: string; title: string; duration_minutes: number };
type Question = { id: string; prompt: string; type: string; marks: number; topic: string | null };
type Assignment = {
  id: string;
  student_id: string;
  due_at: string | null;
  max_attempts: number;
  attempts: { id: string; status: string; score: number | null; max_score: number | null }[];
};

function ExamDetail() {
  const { examId } = Route.useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Exam | null>(null);
  const [qs, setQs] = useState<Question[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [due, setDue] = useState("");

  const reload = async () => {
    const [{ data: e }, { data: q }, { data: a }] = await Promise.all([
      supabase.from("exams").select("id, title, duration_minutes").eq("id", examId).single(),
      supabase.from("questions").select("id, prompt, type, marks, topic").eq("exam_id", examId).order("order_index"),
      supabase
        .from("assignments")
        .select("id, student_id, due_at, max_attempts, attempts(id, status, score, max_score)")
        .eq("exam_id", examId),
    ]);
    setExam(e as Exam);
    setQs((q as Question[]) ?? []);
    setAssignments((a as Assignment[]) ?? []);
    try {
      const s = await listStudents();
      setStudents(s as Student[]);
    } catch {
      /* not admin */
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const assign = async () => {
    if (!studentId) return toast.error("Pick a student");
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("assignments").insert({
      exam_id: examId,
      student_id: studentId,
      due_at: due || null,
      assigned_by: u.user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Assigned");
    setStudentId("");
    setDue("");
    reload();
  };

  const removeAssignment = async (id: string) => {
    if (!confirm("Remove this assignment?")) return;
    await supabase.from("assignments").delete().eq("id", id);
    reload();
  };

  const reassign = async (id: string) => {
    if (!confirm("Reset all attempts for this student?")) return;
    try {
      await reassignAttempt({ data: { assignmentId: id } });
      toast.success("Reset");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const deleteExam = async () => {
    if (!confirm("Delete this exam and all its data?")) return;
    await supabase.from("exams").delete().eq("id", examId);
    toast.success("Deleted");
    navigate({ to: "/dashboard" });
  };

  const studentName = (id: string) => {
    const s = students.find((x) => x.id === id);
    return s?.full_name || s?.email || id.slice(0, 8);
  };

  if (!exam) return <AppShell><p>Loading…</p></AppShell>;

  return (
    <AppShell title={exam.title}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{exam.title}</h1>
          <p className="text-sm text-muted-foreground">
            {exam.duration_minutes} min · {qs.length} questions
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={deleteExam}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete exam
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Assign to student</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Student</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">Select student…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Due date (optional)</Label>
              <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
            </div>
            <Button onClick={assign} className="w-full">
              <UserPlus className="mr-2 h-4 w-4" /> Assign
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Assignments & results</CardTitle></CardHeader>
          <CardContent>
            {assignments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assignments yet.</p>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => {
                  const best = a.attempts.reduce(
                    (b, t) => ((t.score ?? -1) > (b?.score ?? -1) ? t : b),
                    null as Assignment["attempts"][number] | null,
                  );
                  return (
                    <div key={a.id} className="flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <div className="text-sm font-medium">{studentName(a.student_id)}</div>
                        <div className="text-xs text-muted-foreground">
                          {a.attempts.length} attempt{a.attempts.length === 1 ? "" : "s"}
                          {best?.score != null && ` · best ${best.score}/${best.max_score}`}
                          {a.due_at && ` · due ${new Date(a.due_at).toLocaleDateString()}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {best && (
                          <Link to="/results/$attemptId" params={{ attemptId: best.id }}>
                            <Button variant="outline" size="sm">View</Button>
                          </Link>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => reassign(a.id)} title="Reset attempts">
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => removeAssignment(a.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle>Questions</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {qs.map((q, i) => (
            <div key={q.id} className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Q{i + 1}</span>
                <Badge variant="secondary">{q.type}</Badge>
                <Badge variant="secondary">{q.marks}m</Badge>
                {q.topic && <Badge variant="outline">{q.topic}</Badge>}
              </div>
              <p className="mt-1 text-sm">{q.prompt}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </AppShell>
  );
}
