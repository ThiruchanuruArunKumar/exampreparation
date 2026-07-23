import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NumberField } from "@/components/NumberField";
import { Upload, Sparkles, FileText, Plus } from "lucide-react";
import { extractQuestions } from "@/lib/exams.functions";
import { generateFromNotes, generateFromDescription } from "@/lib/admin.functions";
import { PATTERN_PRESETS, type ExamPattern } from "@/lib/exam-patterns";


export type GeneratedQuestion = {
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
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

type Props = {
  pattern: ExamPattern;
  subjects: string[];
  onQuestions: (qs: GeneratedQuestion[]) => void;
  onTitleSuggested?: (t: string) => void;
};

export function QuestionSource({ pattern, subjects, onQuestions, onTitleSuggested }: Props) {
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(10);
  const [subject, setSubject] = useState<string>(subjects[0] ?? "");
  const [description, setDescription] = useState("");

  const doExtract = async (file: File) => {
    setBusy(true);
    try {
      const b64 = await fileToBase64(file);
      const res = await extractQuestions({
        data: { fileBase64: b64, mimeType: file.type || "application/pdf", fileName: file.name },
      });
      if (onTitleSuggested && res.title) onTitleSuggested(res.title);
      onQuestions(res.questions as GeneratedQuestion[]);
      toast.success(`Extracted ${res.questions.length} questions`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doGenFromNotes = async (file: File) => {
    setBusy(true);
    try {
      const b64 = await fileToBase64(file);
      const res = await generateFromNotes({
        data: {
          pattern,
          count,
          subject: subject || null,
          fileBase64: b64,
          mimeType: file.type || "application/pdf",
          fileName: file.name,
        },
      });
      onQuestions(res.questions as GeneratedQuestion[]);
      toast.success(`Generated ${res.questions.length} ${pattern.toUpperCase()}-style questions`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doGenFromDesc = async () => {
    if (!description.trim()) return toast.error("Describe topics for the AI first");
    setBusy(true);
    try {
      const res = await generateFromDescription({
        data: { pattern, count, subject: subject || null, description: description.trim() },
      });
      onQuestions(res.questions as GeneratedQuestion[]);
      toast.success(`Generated ${res.questions.length} questions for ${subject || "the exam"}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doGenAllSubjects = async () => {
    if (!description.trim()) return toast.error("Describe topics for the AI first");
    const preset = pattern !== "custom" ? PATTERN_PRESETS[pattern] : null;
    const sections = preset ? preset.sections : subjects.map((s) => ({ name: s, count, marks_per_q: 1 }));
    if (!sections.length) return toast.error("No subjects configured");
    setBusy(true);
    try {
      let total = 0;
      for (const sec of sections) {
        toast.info(`Generating ${sec.count} for ${sec.name}…`);
        const res = await generateFromDescription({
          data: { pattern, count: sec.count, subject: sec.name, description: description.trim() },
        });
        onQuestions(res.questions as GeneratedQuestion[]);
        total += res.questions.length;
      }
      toast.success(`Generated ${total} questions across ${sections.length} subjects`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };


  const addManual = () => {
    onQuestions([
      {
        type: "mcq",
        prompt: "",
        options: ["", "", "", ""],
        correct_answer: [],
        marks: pattern === "neet" || pattern === "mains" ? 4 : 1,
        topic: subject || null,
        difficulty: "medium",
      },
    ]);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Add questions</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="notes">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="notes"><Sparkles className="mr-1 h-3 w-3" />From notes</TabsTrigger>
            <TabsTrigger value="describe"><FileText className="mr-1 h-3 w-3" />Describe</TabsTrigger>
            <TabsTrigger value="extract"><Upload className="mr-1 h-3 w-3" />Extract</TabsTrigger>
            <TabsTrigger value="manual"><Plus className="mr-1 h-3 w-3" />Manual</TabsTrigger>
          </TabsList>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <Label>How many questions</Label>
              <NumberField value={count} onChange={setCount} min={1} max={60} fallback={10} />
            </div>
            <div>
              <Label>Subject / topic</Label>
              {subjects.length ? (
                <select
                  className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  <option value="">Any</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Kinematics" />
              )}
            </div>
          </div>

          <TabsContent value="notes" className="mt-3">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm">{busy ? "Generating…" : `Upload notes — AI generates ${pattern.toUpperCase()}-style questions`}</span>
              <span className="text-xs text-muted-foreground">PDF, DOCX, PPTX, images</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,image/*,text/*"
                disabled={busy}
                onChange={(e) => e.target.files?.[0] && doGenFromNotes(e.target.files[0])}
              />
            </label>
          </TabsContent>

          <TabsContent value="describe" className="mt-3 space-y-3">
            <Textarea
              rows={5}
              placeholder="Describe the exam topics, chapters, or brief for the AI. E.g. 'Class 12 Physics — Ray Optics, mirrors and lenses, numerical + conceptual, hard'."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button onClick={doGenFromDesc} disabled={busy} className="w-full">
              <Sparkles className="mr-2 h-4 w-4" />{busy ? "Generating…" : `Generate ${count} questions`}
            </Button>
          </TabsContent>

          <TabsContent value="extract" className="mt-3">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm">{busy ? "Reading file…" : "Upload an existing question paper — AI extracts questions"}</span>
              <span className="text-xs text-muted-foreground">PDF, DOCX, PPTX, XLSX, images</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,image/*,text/*"
                disabled={busy}
                onChange={(e) => e.target.files?.[0] && doExtract(e.target.files[0])}
              />
            </label>
          </TabsContent>

          <TabsContent value="manual" className="mt-3">
            <Button onClick={addManual} variant="outline" className="w-full">
              <Plus className="mr-2 h-4 w-4" /> Add a blank question
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
