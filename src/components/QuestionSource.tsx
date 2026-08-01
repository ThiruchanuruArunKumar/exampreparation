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
  difficulty: "easy" | "medium" | "hard" | "extreme";
  source_ref?: string | null;
};

export type GenMode = "ai" | "pyq";
export type Toughness = "easy" | "medium" | "hard" | "extreme";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function detectMime(file: File): string {
  if (file.type) return file.type;
  const n = file.name.toLowerCase();
  if (n.endsWith(".md") || n.endsWith(".markdown")) return "text/markdown";
  return "application/octet-stream";
}

type Props = {
  pattern: ExamPattern;
  subjects: string[];
  onQuestions: (qs: GeneratedQuestion[]) => void;
  onTitleSuggested?: (t: string) => void;
};

export function QuestionSource({ pattern, subjects, onQuestions, onTitleSuggested }: Props) {
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState(50);
  const [subject, setSubject] = useState<string>(subjects[0] ?? "");
  const [description, setDescription] = useState("");
  const [genMode, setGenMode] = useState<GenMode>("ai");
  const [toughness, setToughness] = useState<Toughness>("medium");

  const doExtract = async (file: File) => {
    setBusy(true);
    try {
      const b64 = await fileToBase64(file);
      const res = await extractQuestions({
        data: { fileBase64: b64, mimeType: detectMime(file), fileName: file.name },
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
          mimeType: detectMime(file),
          fileName: file.name,
          genMode,
          toughness,
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
    setBusy(true);
    try {
      const res = await generateFromDescription({
        data: { pattern, count, subject: subject || null, description: description.trim() || null, genMode, toughness },
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
    const preset = pattern !== "custom" && pattern in PATTERN_PRESETS ? PATTERN_PRESETS[pattern as keyof typeof PATTERN_PRESETS] : null;
    const sections = preset ? preset.sections : subjects.map((s) => ({ name: s, count, marks_per_q: 1 }));
    if (!sections.length) return toast.error("No subjects configured");
    setBusy(true);
    try {
      toast.info(`Generating ${sections.length} subjects in parallel…`);
      const results: number[] = await Promise.all(
        sections.map((sec) =>
          generateFromDescription({
            data: { pattern, count: sec.count, subject: sec.name, description: description.trim() || null, genMode, toughness },
          }).then((res) => {
            onQuestions(res.questions as GeneratedQuestion[]);
            return res.questions.length;
          }),
        ),
      );
      const total = results.reduce((a, b) => a + b, 0);
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
        difficulty: toughness,
        source_ref: null,
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
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="notes" className="text-xs px-1.5 gap-1">
              <Sparkles className="h-3 w-3 shrink-0" />
              <span className="hidden sm:inline">From notes</span>
              <span className="sm:hidden">Notes</span>
            </TabsTrigger>
            <TabsTrigger value="describe" className="text-xs px-1.5 gap-1">
              <FileText className="h-3 w-3 shrink-0" />
              <span className="hidden sm:inline">Describe</span>
              <span className="sm:hidden">AI</span>
            </TabsTrigger>
            <TabsTrigger value="extract" className="text-xs px-1.5 gap-1">
              <Upload className="h-3 w-3 shrink-0" />
              <span>Extract</span>
            </TabsTrigger>
            <TabsTrigger value="manual" className="text-xs px-1.5 gap-1">
              <Plus className="h-3 w-3 shrink-0" />
              <span>Manual</span>
            </TabsTrigger>
          </TabsList>

          {/* Shared controls: count + subject */}
          <div className="mt-3 grid gap-3 grid-cols-2">
            <div>
              <Label className="text-xs">How many</Label>
              <NumberField value={count} onChange={setCount} min={1} max={100} fallback={50} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Subject</Label>
              {subjects.length ? (
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                >
                  <option value="">Any</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Kinematics" className="mt-1" />
              )}
            </div>
          </div>

          {/* Generation type + toughness */}
          <div className="mt-3 space-y-3">
            <div>
              <Label className="text-xs">Generation type</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {([
                  { v: "ai", label: "AI generated", hint: "Close variants of real past questions" },
                  { v: "pyq", label: "Previous year", hint: "Actual PYQs with year & shift" },
                ] as const).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setGenMode(o.v)}
                    className={`rounded-lg border p-2.5 text-left text-xs transition ${
                      genMode === o.v ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="font-medium">{o.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{o.hint}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Toughness level</Label>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {([
                  { v: "easy", label: "Easy" },
                  { v: "medium", label: "Medium" },
                  { v: "hard", label: "Hard" },
                  { v: "extreme", label: "Extreme" },
                ] as const).map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setToughness(o.v)}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                      toughness === o.v ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/50"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {toughness === "extreme"
                  ? "Exact questions from previous years' hardest shifts."
                  : "Every generated question follows this difficulty."}
              </p>
            </div>
          </div>

          <TabsContent value="notes" className="mt-3">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-5 text-center hover:border-primary transition-colors">
              <Sparkles className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">{busy ? "Generating…" : `Upload notes`}</span>
              <span className="text-xs text-muted-foreground">AI generates {pattern.toUpperCase()}-style questions from your file</span>
              <span className="text-[11px] text-muted-foreground">PDF, DOCX, PPTX, images</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.md,.markdown,image/*,text/*"
                disabled={busy}
                onChange={(e) => e.target.files?.[0] && doGenFromNotes(e.target.files[0])}
              />
            </label>
          </TabsContent>

          <TabsContent value="describe" className="mt-3 space-y-3">
            <Textarea
              rows={3}
              placeholder="Optional: Describe specific topics or chapters (e.g. 'Class 12 Physics — Ray Optics'). Leave blank for full syllabus."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Pick a subject above → Generate. Repeat per subject or use "Generate all" for the full paper.
            </p>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
              <Button onClick={doGenFromDesc} disabled={busy} className="w-full">
                <Sparkles className="mr-2 h-4 w-4" />{busy ? "Generating…" : `Generate ${count}`}
              </Button>
              {subjects.length > 1 && (
                <Button onClick={doGenAllSubjects} disabled={busy} variant="outline" className="w-full">
                  <Sparkles className="mr-2 h-4 w-4" />{busy ? "Generating…" : `All ${subjects.length} subjects`}
                </Button>
              )}
            </div>
          </TabsContent>


          <TabsContent value="extract" className="mt-3">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-5 text-center hover:border-primary transition-colors">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">{busy ? "Reading file…" : "Upload a question paper"}</span>
              <span className="text-xs text-muted-foreground">AI extracts questions from your file</span>
              <span className="text-[11px] text-muted-foreground">PDF, DOCX, PPTX, XLSX, images</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.md,.markdown,image/*,text/*"
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
