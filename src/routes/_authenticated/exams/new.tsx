import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Sparkles, Trash2 } from "lucide-react";
import { extractQuestions } from "@/lib/exams.functions";
import { createExam } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/exams/new")({
  head: () => ({
    meta: [
      { title: "New exam — ExamPrep" },
      { name: "description", content: "Upload a file and let AI generate an exam." },
      { property: "og:title", content: "New exam — ExamPrep" },
      { property: "og:description", content: "Upload a file and let AI generate an exam." },
    ],
  }),
  component: NewExam,
});

type Q = {
  type: "mcq" | "multi" | "tf" | "short";
  prompt: string;
  options: string[] | null;
  correct_answer: string[];
  marks: number;
  topic: string | null;
  difficulty: "easy" | "medium" | "hard";
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      resolve(s.split(",")[1] ?? "");
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function NewExam() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  const onFile = async (file: File) => {
    setExtracting(true);
    try {
      const b64 = await fileToBase64(file);
      const res = await extractQuestions({
        data: { fileBase64: b64, mimeType: file.type || "application/pdf", fileName: file.name },
      });
      if (!title) setTitle(res.title);
      setQuestions((prev) => [...prev, ...(res.questions as Q[])]);
      toast.success(`Extracted ${res.questions.length} questions`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  const save = async () => {
    if (!title.trim()) return toast.error("Title required");
    if (questions.length === 0) return toast.error("Add at least one question");
    setSaving(true);
    try {
      const r = await createExam({
        data: { title: title.trim(), duration_minutes: duration, questions },
      });
      toast.success(`Exam created — password ${r.access_code}`);
      navigate({ to: "/exams/$examId", params: { examId: r.id } });
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <AppShell title="New exam">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label htmlFor="t">Title</Label>
                <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="d">Duration (minutes)</Label>
                <Input
                  id="d"
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                A 6-character exam password is generated automatically. Share it with your students along with their ID.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload source</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm">
                  {extracting ? "Extracting with AI…" : "Drop or click to upload"}
                </span>
                <span className="text-xs text-muted-foreground">PDF, DOCX, PPTX, images</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,image/*,text/*"
                  disabled={extracting}
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
                />
              </label>
              <Button
                className="mt-4 w-full"
                variant="outline"
                onClick={() =>
                  setQuestions((q) => [
                    ...q,
                    {
                      type: "mcq",
                      prompt: "",
                      options: ["", "", "", ""],
                      correct_answer: [],
                      marks: 1,
                      topic: null,
                      difficulty: "medium",
                    },
                  ])
                }
              >
                <Sparkles className="mr-2 h-4 w-4" /> Add manually
              </Button>
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" onClick={save} disabled={saving || extracting}>
            {saving ? "Saving…" : `Save exam (${questions.length} questions)`}
          </Button>
        </div>

        <div className="space-y-3">
          {questions.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center text-sm text-muted-foreground">
                Upload a file to see extracted questions here.
              </CardContent>
            </Card>
          )}
          {questions.map((q, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Q{i + 1} · {q.type} · {q.marks}m {q.topic && `· ${q.topic}`}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  value={q.prompt}
                  onChange={(e) =>
                    setQuestions((qs) => qs.map((x, j) => (j === i ? { ...x, prompt: e.target.value } : x)))
                  }
                />
                {q.options && (
                  <div className="space-y-1">
                    {q.options.map((o, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={q.correct_answer.includes(o)}
                          onChange={(e) =>
                            setQuestions((qs) =>
                              qs.map((x, j) =>
                                j === i
                                  ? {
                                      ...x,
                                      correct_answer: e.target.checked
                                        ? [...x.correct_answer, o]
                                        : x.correct_answer.filter((v) => v !== o),
                                    }
                                  : x,
                              ),
                            )
                          }
                        />
                        <Input
                          value={o}
                          onChange={(e) =>
                            setQuestions((qs) =>
                              qs.map((x, j) => {
                                if (j !== i || !x.options) return x;
                                const opts = [...x.options];
                                const oldVal = opts[oi];
                                opts[oi] = e.target.value;
                                return {
                                  ...x,
                                  options: opts,
                                  correct_answer: x.correct_answer.map((v) =>
                                    v === oldVal ? e.target.value : v,
                                  ),
                                };
                              }),
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
                {q.type === "short" && (
                  <Input
                    placeholder="Accepted answer(s), comma-separated"
                    value={q.correct_answer.join(", ")}
                    onChange={(e) =>
                      setQuestions((qs) =>
                        qs.map((x, j) =>
                          j === i
                            ? { ...x, correct_answer: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }
                            : x,
                        ),
                      )
                    }
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
