import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, Copy, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { listDrafts, deleteDraft } from "@/lib/drafts.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ExamPrep" },
      { name: "description", content: "Your ExamPrep admin dashboard." },
      { property: "og:title", content: "Dashboard — ExamPrep" },
      { property: "og:description", content: "Your ExamPrep admin dashboard." },
    ],
  }),
  component: Dashboard,
});

type Exam = {
  id: string;
  title: string;
  access_code: string;
  created_at: string;
  duration_minutes: number;
  questions: { count: number }[];
  assignments: { count: number }[];
};

type Draft = {
  id: string;
  title: string;
  pattern: string;
  questionCount: number;
  updated_at: string;
};

function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const load = useCallback(async () => {
    const [examsRes, draftsRes] = await Promise.all([
      supabase
        .from("exams")
        .select("id, title, access_code, duration_minutes, created_at, questions(count), assignments(count)")
        .order("created_at", { ascending: false }),
      listDrafts().catch(() => [] as Draft[]),
    ]);
    setExams((examsRes.data as Exam[]) ?? []);
    setDrafts(draftsRes as Draft[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useRealtimeSync(["exams", "questions", "assignments", "exam_drafts"], load);

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied ${code}`);
  };

  const discardDraft = async (id: string) => {
    if (!confirm("Discard this draft?")) return;
    try {
      await deleteDraft({ data: { id } });
      toast.success("Draft discarded");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to discard");
    }
  };

  return (
    <AppShell title="Admin">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Your exams</h1>
        <Button onClick={() => navigate({ to: "/exams/new" })}>
          <Plus className="mr-2 h-4 w-4" /> New exam
        </Button>
      </div>

      {drafts.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Drafts ({drafts.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {drafts.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-dashed border-border bg-muted/30 p-4 transition hover:border-primary"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">DRAFT</Badge>
                      <span className="text-xs uppercase text-muted-foreground">{d.pattern}</span>
                    </div>
                    <h3 className="mt-1 truncate font-semibold">{d.title || "Untitled exam"}</h3>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {d.questionCount} question{d.questionCount === 1 ? "" : "s"} · edited{" "}
                      {new Date(d.updated_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => navigate({ to: "/exams/new", search: { draftId: d.id } })}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Resume
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => discardDraft(d.id)}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Discard
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : exams.length === 0 && drafts.length === 0 ? (
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
      ) : exams.length === 0 ? null : (
        <div className="grid gap-4 sm:grid-cols-2">
          {exams.map((e) => (
            <div
              key={e.id}
              className="rounded-lg border border-border p-5 transition hover:border-primary"
            >
              <Link to="/exams/$examId" params={{ examId: e.id }}>
                <h3 className="font-semibold">{e.title}</h3>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">{e.questions?.[0]?.count ?? 0} questions</Badge>
                  <Badge variant="secondary">{e.assignments?.[0]?.count ?? 0} assigned</Badge>
                  <Badge variant="secondary">{e.duration_minutes} min</Badge>
                </div>
              </Link>
              <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Exam password</div>
                  <div className="font-mono text-base font-bold tracking-widest">{e.access_code}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => copy(e.access_code)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}

