import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Save, Sparkles, Eye, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RichContent } from "@/components/RichContent";
import {
  getIpeGradingSheet,
  saveIpeGrades,
  setIpeMarksPublished,
  aiEvaluateIpeAnswerSheet,
} from "@/lib/ipe.functions";

type Sheet = Awaited<ReturnType<typeof getIpeGradingSheet>>;

export function IpeGradingPanel({ attemptId, onChanged }: { attemptId: string; onChanged?: () => void }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await getIpeGradingSheet({ data: { attemptId } });
      setSheet(s);
      setMarks(Object.fromEntries(s.questions.map((q) => [q.id, String(q.marksAwarded ?? 0)])));
      setFeedback(Object.fromEntries(s.questions.map((q) => [q.id, q.feedback ?? ""])));
      setNotes(s.attempt.graderNotes ?? "");
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading evaluation sheet…</p>;
  if (err || !sheet)
    return (
      <Card>
        <CardContent className="py-6 text-sm text-destructive">{err ?? "Could not load evaluation sheet."}</CardContent>
      </Card>
    );

  const total = sheet.questions.reduce((n, q) => n + (Number(marks[q.id]) || 0), 0);
  const maxScore = sheet.attempt.maxScore || sheet.exam.totalMarks || 0;

  const doSave = async () => {
    setSaving(true);
    try {
      await saveIpeGrades({
        data: {
          attemptId,
          notes,
          grades: sheet.questions.map((q) => ({
            questionId: q.id,
            marksAwarded: Math.max(0, Math.min(Number(q.marks ?? 0), Number(marks[q.id]) || 0)),
            feedback: feedback[q.id] ?? "",
          })),
        },
      });
      toast.success("Marks saved");
      await load();
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const runAi = async () => {
    setAiBusy(true);
    try {
      const r = await aiEvaluateIpeAnswerSheet({ data: { attemptId, apply: false } });
      setMarks((m) => ({ ...m, ...Object.fromEntries(r.grades.map((g) => [g.questionId, String(g.marksAwarded)])) }));
      setFeedback((f) => ({ ...f, ...Object.fromEntries(r.grades.map((g) => [g.questionId, g.feedback ?? ""])) }));
      setNotes(r.overallFeedback ?? notes);
      toast.success(`AI proposed ${r.proposedScore}/${r.maxScore}. Review and save.`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  const togglePublish = async () => {
    setPublishing(true);
    try {
      const r = await setIpeMarksPublished({ data: { attemptId, published: !sheet.attempt.marksPublished } });
      toast.success(r.published ? "Marks published to student" : "Marks hidden from student");
      await load();
      onChanged?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
            <span>Teacher evaluation</span>
            <Badge variant={sheet.attempt.marksPublished ? "default" : "outline"}>
              {sheet.attempt.marksPublished ? "Marks published" : "Not published"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <div className="text-4xl font-bold">
                {total}
                <span className="text-xl text-muted-foreground">/{maxScore}</span>
              </div>
              <p className="text-xs text-muted-foreground">Live total from the marks below</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={runAi} variant="outline" disabled={aiBusy}>
                {aiBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                AI evaluate answer sheet
              </Button>
              <Button onClick={doSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save marks
              </Button>
              <Button onClick={togglePublish} variant="secondary" disabled={publishing}>
                {sheet.attempt.marksPublished ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {sheet.attempt.marksPublished ? "Unpublish" : "Publish to student"}
              </Button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Overall remarks for the student</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      {sheet.answerSheetImages.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Answer booklet ({sheet.answerSheetImages.length} pages)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {sheet.answerSheetImages.map((img: any) => (
              <a key={img.id} href={img.image_url} target="_blank" rel="noreferrer" className="block">
                <img
                  src={img.image_url}
                  alt={`Answer sheet page ${img.page_number}`}
                  className="w-full rounded-md border border-border"
                  loading="lazy"
                />
                <div className="mt-1 text-xs text-muted-foreground">Page {img.page_number}</div>
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {sheet.questions.map((q, i) => (
          <Card key={q.id}>
            <CardContent className="space-y-3 pt-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Q{i + 1}
                    {q.section ? ` · ${q.section}` : ""}
                    {q.sourceRef ? ` · ${q.sourceRef}` : ""}
                  </div>
                  <RichContent className="mt-1 text-sm font-medium">{q.prompt}</RichContent>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={q.marks}
                    step="0.5"
                    value={marks[q.id] ?? "0"}
                    onChange={(e) => setMarks((m) => ({ ...m, [q.id]: e.target.value }))}
                    className="h-9 w-20"
                  />
                  <span className="text-sm text-muted-foreground">/ {q.marks}</span>
                </div>
              </div>
              {q.modelAnswer && (
                <details className="rounded-md border border-border p-2 text-sm">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Marking key</summary>
                  <RichContent className="mt-2 text-sm">{q.modelAnswer}</RichContent>
                </details>
              )}
              <Textarea
                value={feedback[q.id] ?? ""}
                onChange={(e) => setFeedback((f) => ({ ...f, [q.id]: e.target.value }))}
                rows={2}
                placeholder="Feedback for this answer…"
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
