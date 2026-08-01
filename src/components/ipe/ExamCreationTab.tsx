import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RichContent } from "@/components/RichContent";
import {
  Sparkles,
  FileText,
  Clock,
  Layers,
  Users,
  CheckCircle2,
  BookOpen,
  Calendar,
  KeyRound,
} from "lucide-react";
import {
  getIpeSubjectsAndChapters,
  getIpeQuestions,
  getIpePreviousPapers,
  createIpeExam,
} from "@/lib/ipe.functions";
import { listStudents } from "@/lib/exams.functions";

type Subject = { id: string; name: string; year: "1st_year" | "2nd_year" };
type Chapter = { id: string; subject_id: string; chapter_name: string; chapter_order: number };
type Question = {
  id: string;
  chapter_id: string;
  question_type: "very_short_answer" | "short_answer" | "long_answer";
  question_text: string;
  marks: number;
  source: string;
  source_year: string | null;
  verified: boolean;
};

type PreviousPaper = {
  id: string;
  subject_id: string;
  year: string;
  structured_question_ids: string[];
};

type Student = {
  id: string;
  name: string;
  student_code: string;
  class_name: string | null;
};

export function ExamCreationTab() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"mode_a" | "mode_b" | "mode_c">("mode_a");

  // Shared Config
  const [title, setTitle] = useState("TS IPE Intermediate Exam");
  const [year, setYear] = useState<"1st_year" | "2nd_year">("1st_year");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [accessCode, setAccessCode] = useState("");
  const [showResult, setShowResult] = useState(true);
  const [answerSheetRequired, setAnswerSheetRequired] = useState(true);

  // Student Assignment State
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [assignAll, setAssignAll] = useState(true);

  // Mode A specific state
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());
  const [vsaCount, setVsaCount] = useState(10);
  const [saCount, setSaCount] = useState(6);
  const [laCount, setLaCount] = useState(2);

  // Mode B specific state — AI reproduces the actual paper of this TS IPE session
  const [pyqSession, setPyqSession] = useState<string>(PYQ_SESSIONS[0]);


  // Mode C specific state
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());

  const [busy, setBusy] = useState(false);

  const fetchInitialData = useCallback(async () => {
    try {
      const [structData, stdList] = await Promise.all([
        getIpeSubjectsAndChapters(),
        listStudents(),
      ]);
      setSubjects(structData.subjects as Subject[]);
      setChapters(structData.chapters as Chapter[]);
      setStudents(stdList as Student[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => s.year === year);
  }, [subjects, year]);

  useEffect(() => {
    if (filteredSubjects.length > 0 && (!selectedSubjectId || !filteredSubjects.some((s) => s.id === selectedSubjectId))) {
      setSelectedSubjectId(filteredSubjects[0].id);
    }
  }, [filteredSubjects, selectedSubjectId]);

  const availableChapters = useMemo(() => {
    if (!selectedSubjectId) return [];
    if (selectedSubjectId === "all") {
      const yearSubIds = new Set(filteredSubjects.map((s) => s.id));
      return chapters.filter((c) => yearSubIds.has(c.subject_id));
    }
    return chapters.filter((c) => c.subject_id === selectedSubjectId);
  }, [chapters, filteredSubjects, selectedSubjectId]);




  // Fetch bank questions when Mode C is chosen or subject changes
  useEffect(() => {
    if (mode === "mode_c" && selectedSubjectId) {
      (async () => {
        try {
          const qs = await getIpeQuestions({ data: { subjectId: selectedSubjectId } });
          setBankQuestions(qs as Question[]);
        } catch (e) {
          toast.error((e as Error).message);
        }
      })();
    }
  }, [mode, selectedSubjectId]);

  const toggleChapter = (id: string) => {
    setSelectedChapterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleQuestionSelection = (id: string) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateExam = async () => {
    if (!title.trim()) return toast.error("Exam title is required");
    if (!selectedSubjectId) return toast.error("Select a subject");

    const studentIdsToAssign = assignAll ? students.map((s) => s.id) : Array.from(selectedStudentIds);

    setBusy(true);
    try {
      const res = await createIpeExam({
        data: {
          title: title.trim(),
          year,
          subjectId: selectedSubjectId,
          mode,
          durationMinutes: Number.isFinite(durationMinutes) && durationMinutes > 0 ? durationMinutes : 180,
          accessCode: accessCode.trim() || undefined,
          showResultAfterSubmit: showResult,
          answerSheetRequired,
          studentIds: studentIdsToAssign,
          chapterIds: Array.from(selectedChapterIds),
          useBlueprint: false,
          vsaCount,
          saCount,
          laCount,
          pyqSession: mode === "mode_b" ? pyqSession : undefined,
          questionIds: Array.from(selectedQuestionIds),
        },

      });

      toast.success(`Created IPE Exam! Password: ${res.accessCode}`);
      navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Selection Cards */}
      <Card className="border-border/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Select IPE Exam Creation Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                id: "mode_a" as const,
                title: "Mode A: Questions + PYQ Combination",
                desc: "Select chapters & standard blueprint (VSA 10, SA 6, LA 2). System pulls matching verified questions & PYQs.",
                icon: Sparkles,
              },
              {
                id: "mode_b" as const,
                title: "Mode B: Previous Year Paper (Verbatim)",
                desc: "Pick an exact TS Intermediate Previous Year Paper (e.g. March 2023) to run verbatim.",
                icon: Calendar,
              },
              {
                id: "mode_c" as const,
                title: "Mode C: Selected Questions + Custom Time",
                desc: "Manually pick individual questions from the question bank and set custom exam duration.",
                icon: CheckCircle2,
              },
            ].map((m) => {
              const Icon = m.icon;
              const isSelected = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`p-4 rounded-xl border text-left transition relative ${
                    isSelected ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-border/70 hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Icon className="h-4 w-4 shrink-0" />
                    {m.title}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{m.desc}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Shared Config Form */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Config */}
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">1. Exam Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs font-medium">Exam Title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. TS Inter 1st Year Physics Model Exam 1"
                  className="text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Year</Label>
                  <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-lg text-xs mt-1">
                    <button
                      type="button"
                      className={`py-1.5 rounded-md font-medium transition ${year === "1st_year" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                      onClick={() => setYear("1st_year")}
                    >
                      1st Year
                    </button>
                    <button
                      type="button"
                      className={`py-1.5 rounded-md font-medium transition ${year === "2nd_year" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                      onClick={() => setYear("2nd_year")}
                    >
                      2nd Year
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium">Subject</Label>
                  <select
                    className="w-full mt-1 rounded-md border border-input bg-background p-2 text-xs font-medium"
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                  >
                    <option value="all">
                      ⭐ All Subjects (Full Grand Test — MPC / BIPC)
                    </option>
                    {filteredSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Total Duration (Minutes)</Label>
                  <div className="relative mt-1">
                    <Clock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <NumberField
                      value={durationMinutes}
                      onChange={setDurationMinutes}
                      className="pl-8 text-xs"
                      min={15}
                      max={360}
                      fallback={180}
                    />
                  </div>

                </div>

                <div>
                  <Label className="text-xs font-medium">Exam Password / Access Code (Optional)</Label>
                  <div className="relative mt-1">
                    <KeyRound className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="Auto-generated if blank"
                      className="pl-8 text-xs font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold">Publish Result Immediately</div>
                    <div className="text-[11px] text-muted-foreground">Show evaluation state after submission</div>
                  </div>
                  <Switch checked={showResult} onCheckedChange={setShowResult} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold">Mandatory Answer Sheet Photo Upload</div>
                    <div className="text-[11px] text-muted-foreground">Require camera photos of handwritten paper</div>
                  </div>
                  <Switch checked={answerSheetRequired} onCheckedChange={setAnswerSheetRequired} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mode Specific Inputs */}
          {mode === "mode_a" && (
            <Card className="border-border/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">2. Mode A Blueprint & Chapters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold">Select Chapters (Leave empty for all chapters)</Label>
                  <div className="mt-2 max-h-40 overflow-y-auto space-y-1.5 border border-border p-2 rounded-md">
                    {availableChapters.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={selectedChapterIds.has(c.id)}
                          onCheckedChange={() => toggleChapter(c.id)}
                        />
                        <span>{c.chapter_order}. {c.chapter_name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">VSA Count (2 Marks)</Label>
                    <NumberField value={vsaCount} onChange={setVsaCount} min={0} max={20} fallback={10} className="text-xs mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">SA Count (4 Marks)</Label>
                    <NumberField value={saCount} onChange={setSaCount} min={0} max={20} fallback={8} className="text-xs mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">LA Count (8 Marks)</Label>
                    <NumberField value={laCount} onChange={setLaCount} min={0} max={20} fallback={3} className="text-xs mt-1" />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  If the bank is short of questions for these counts, the missing ones are AI-generated in TS board
                  style and saved back to the bank automatically.
                </p>

              </CardContent>
            </Card>
          )}

          {mode === "mode_b" && (
            <Card className="border-border/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">2. Mode B Previous Year Paper (AI reproduced)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  The AI reproduces the actual TS IPE paper of the selected session for this subject, with the exam
                  session labelled on every question in the result sheet.
                </p>
                <div>
                  <Label className="text-xs font-medium">Exam Session</Label>
                  <select
                    className="w-full mt-1 rounded-md border border-input bg-background p-2 text-xs"
                    value={pyqSession}
                    onChange={(e) => setPyqSession(e.target.value)}
                  >
                    {PYQ_SESSIONS.map((s) => (
                      <option key={s} value={s}>
                        TS Intermediate {year === "1st_year" ? "1st Year" : "2nd Year"} — {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">VSAQ Count</Label>
                    <NumberField value={vsaCount} onChange={setVsaCount} min={0} max={20} fallback={10} className="text-xs mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">SAQ Count</Label>
                    <NumberField value={saCount} onChange={setSaCount} min={0} max={20} fallback={8} className="text-xs mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">LAQ Count</Label>
                    <NumberField value={laCount} onChange={setLaCount} min={0} max={20} fallback={3} className="text-xs mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}


          {mode === "mode_c" && (
            <Card className="border-border/80">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">2. Mode C Manual Question Selection ({selectedQuestionIds.size} Selected)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {bankQuestions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No questions found in bank for this subject.</p>
                ) : (
                  <div className="max-h-60 overflow-y-auto space-y-2 border border-border p-2 rounded-md">
                    {bankQuestions.map((q) => (
                      <label key={q.id} className="flex items-start gap-2.5 text-xs p-2 rounded border border-border/60 hover:bg-muted/40 cursor-pointer">
                        <Checkbox
                          checked={selectedQuestionIds.has(q.id)}
                          onCheckedChange={() => toggleQuestionSelection(q.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px]">{q.marks}M</Badge>
                            <Badge variant="secondary" className="text-[10px]">{q.question_type.replace(/_/g, " ")}</Badge>
                          </div>
                          <RichContent className="text-xs">{q.question_text}</RichContent>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Student Assignment & Create Action */}
        <div className="space-y-6">
          <Card className="border-border/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>3. Assign to Students</span>
                <Users className="h-4 w-4 text-primary" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/30">
                <div>
                  <div className="text-xs font-semibold">Assign to All Registered Students</div>
                  <div className="text-[11px] text-muted-foreground">{students.length} active students</div>
                </div>
                <Switch checked={assignAll} onCheckedChange={setAssignAll} />
              </div>

              {!assignAll && (
                <div className="max-h-60 overflow-y-auto space-y-1.5 border border-border p-2 rounded-md">
                  {students.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted cursor-pointer">
                      <Checkbox
                        checked={selectedStudentIds.has(s.id)}
                        onCheckedChange={() => toggleStudentSelection(s.id)}
                      />
                      <span>{s.name} ({s.student_code})</span>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Button size="lg" onClick={handleCreateExam} disabled={busy} className="w-full font-semibold">
            {busy ? "Generating Exam..." : "Create & Publish IPE Exam"}
          </Button>
        </div>
      </div>
    </div>
  );
}
