import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RichContent } from "@/components/RichContent";
import {
  Search,
  Plus,
  Upload,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Trash2,
  Check,
  FolderOpen,
  BookOpen,
  RefreshCw,
  Copy,
  AlertTriangle,
  Database,
} from "lucide-react";
import {
  getIpeSubjectsAndChapters,
  getIpeQuestions,
  addIpeQuestion,
  importIpeQuestionsBulk,
  toggleVerifyIpeQuestion,
  bulkVerifyIpeQuestions,
  deleteIpeQuestion,
  addIpeSubject,
  addIpeChapter,
  reseedIpeQuestionBank,
  getIpeMigrationSql,
} from "@/lib/ipe.functions";
import { extractQuestions } from "@/lib/exams.functions";

type Subject = { id: string; name: string; year: "1st_year" | "2nd_year" };
type Chapter = { id: string; subject_id: string; chapter_name: string; chapter_order: number };
type Question = {
  id: string;
  chapter_id: string;
  question_type: "very_short_answer" | "short_answer" | "long_answer";
  question_text: string;
  marks: number;
  source: "previous_year" | "textbook" | "admin_added";
  source_year: string | null;
  verified: boolean;
  created_at: string;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function QuestionBankTab() {
  const [year, setYear] = useState<"1st_year" | "2nd_year">("1st_year");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter Bar state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterVerified, setFilterVerified] = useState<string>("all");

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);

  // Manual Question state
  const [manualText, setManualText] = useState("");
  const [manualType, setManualType] = useState<"very_short_answer" | "short_answer" | "long_answer">("very_short_answer");
  const [manualMarks, setManualMarks] = useState(2);
  const [manualSource, setManualSource] = useState<"previous_year" | "textbook" | "admin_added">("admin_added");
  const [manualSourceYear, setManualSourceYear] = useState("");
  const [manualSaving, setManualSaving] = useState(false);

  // Import state
  const [importBusy, setImportBusy] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);

  // Add Subject state
  const [newSubName, setNewSubName] = useState("");
  const [missingTables, setMissingTables] = useState(false);

  const fetchStructure = useCallback(async () => {
    try {
      const data = await getIpeSubjectsAndChapters();
      setSubjects(data.subjects as Subject[]);
      setChapters(data.chapters as Chapter[]);
      if ((data as any).missingTables) {
        setMissingTables(true);
      } else {
        setMissingTables(false);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCopySql = async () => {
    try {
      const sql = await getIpeMigrationSql();
      await navigator.clipboard.writeText(sql);
      toast.success("Copied SQL migration script! Paste it into your Supabase Dashboard SQL Editor & click Run.");
    } catch (e) {
      toast.error("Failed to copy SQL script");
    }
  };

  useEffect(() => {
    fetchStructure();
  }, [fetchStructure]);

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => s.year === year);
  }, [subjects, year]);

  useEffect(() => {
    if (filteredSubjects.length > 0 && (!selectedSubjectId || !filteredSubjects.some((s) => s.id === selectedSubjectId))) {
      setSelectedSubjectId(filteredSubjects[0].id);
    }
  }, [filteredSubjects, selectedSubjectId]);

  const currentSubjectChapters = useMemo(() => {
    if (!selectedSubjectId) return [];
    return chapters
      .filter((c) => c.subject_id === selectedSubjectId)
      .sort((a, b) => a.chapter_order - b.chapter_order);
  }, [chapters, selectedSubjectId]);

  useEffect(() => {
    if (currentSubjectChapters.length > 0 && (!selectedChapterId || !currentSubjectChapters.some((c) => c.id === selectedChapterId))) {
      setSelectedChapterId(currentSubjectChapters[0].id);
    } else if (currentSubjectChapters.length === 0) {
      setSelectedChapterId(null);
    }
  }, [currentSubjectChapters, selectedChapterId]);

  const fetchQuestions = useCallback(async () => {
    if (!selectedSubjectId) return;
    try {
      const res = await getIpeQuestions({
        data: {
          subjectId: selectedSubjectId,
          chapterId: selectedChapterId ?? undefined,
        },
      });
      setQuestions(res as Question[]);
      setSelectedIds(new Set());
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [selectedSubjectId, selectedChapterId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  // Display filtering
  const displayedQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (filterType !== "all" && q.question_type !== filterType) return false;
      if (filterSource !== "all" && q.source !== filterSource) return false;
      if (filterVerified === "verified" && !q.verified) return false;
      if (filterVerified === "unverified" && q.verified) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const textMatch = q.question_text.toLowerCase().includes(query);
        const yearMatch = (q.source_year ?? "").toLowerCase().includes(query);
        return textMatch || yearMatch;
      }
      return true;
    });
  }, [questions, filterType, filterSource, filterVerified, searchQuery]);

  const vsaQuestions = useMemo(
    () => displayedQuestions.filter((q) => q.question_type === "very_short_answer"),
    [displayedQuestions],
  );
  const saQuestions = useMemo(
    () => displayedQuestions.filter((q) => q.question_type === "short_answer"),
    [displayedQuestions],
  );
  const laQuestions = useMemo(
    () => displayedQuestions.filter((q) => q.question_type === "long_answer"),
    [displayedQuestions],
  );

  const handleToggleVerify = async (id: string, currentVerified: boolean) => {
    try {
      await toggleVerifyIpeQuestion({ data: { questionId: id, verified: !currentVerified } });
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, verified: !currentVerified } : q)),
      );
      toast.success(currentVerified ? "Marked as unverified" : "Marked as verified");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleBulkVerify = async () => {
    const unverifiedIds = Array.from(selectedIds).filter((id) => {
      const q = questions.find((item) => item.id === id);
      return q && !q.verified;
    });

    const targetIds = unverifiedIds.length ? unverifiedIds : displayedQuestions.filter((q) => !q.verified).map((q) => q.id);

    if (!targetIds.length) {
      toast.info("No unverified questions selected");
      return;
    }

    try {
      await bulkVerifyIpeQuestions({ data: { questionIds: targetIds } });
      setQuestions((prev) =>
        prev.map((q) => (targetIds.includes(q.id) ? { ...q, verified: true } : q)),
      );
      setSelectedIds(new Set());
      toast.success(`Marked ${targetIds.length} question(s) as verified`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteIpeQuestion({ data: { questionId: id } });
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      toast.success("Question deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleSaveManualQuestion = async () => {
    if (!selectedChapterId) {
      toast.error("Please select a chapter first");
      return;
    }
    if (!manualText.trim()) {
      toast.error("Question text is required");
      return;
    }
    setManualSaving(true);
    try {
      const newQ = await addIpeQuestion({
        data: {
          chapterId: selectedChapterId,
          questionType: manualType,
          questionText: manualText.trim(),
          marks: manualMarks,
          source: manualSource,
          sourceYear: manualSourceYear.trim() || null,
          verified: true,
        },
      });
      setQuestions((prev) => [newQ as Question, ...prev]);
      setShowAddModal(false);
      setManualText("");
      toast.success("Question added successfully");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setManualSaving(false);
    }
  };

  const handleExtractFile = async (file: File) => {
    setImportBusy(true);
    try {
      const b64 = await fileToBase64(file);
      const res = await extractQuestions({
        data: { fileBase64: b64, mimeType: file.type || "application/pdf", fileName: file.name },
      });

      const mapped = res.questions.map((q: any) => ({
        questionType: q.marks >= 8 ? "long_answer" : q.marks >= 4 ? "short_answer" : "very_short_answer",
        questionText: q.prompt,
        marks: q.marks >= 8 ? 8 : q.marks >= 4 ? 4 : 2,
        source: "previous_year" as const,
        sourceYear: null,
      }));

      setImportPreview(mapped);
      toast.success(`Extracted ${mapped.length} questions from file`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImportBusy(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedChapterId) return toast.error("Select a chapter to import into");
    if (!importPreview.length) return toast.error("No questions to import");
    setImportBusy(true);
    try {
      const inserted = await importIpeQuestionsBulk({
        data: {
          chapterId: selectedChapterId,
          questions: importPreview,
        },
      });
      setQuestions((prev) => [...(inserted as Question[]), ...prev]);
      setShowImportModal(false);
      setImportPreview([]);
      toast.success(`Imported ${inserted.length} questions (unverified by default)`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImportBusy(false);
    }
  };

  const handleAddSubject = async () => {
    if (!newSubName.trim()) return;
    try {
      const created = await addIpeSubject({
        data: { name: newSubName.trim(), year },
      });
      setSubjects((prev) => [...prev, created as Subject]);
      setSelectedSubjectId(created.id);
      setNewSubName("");
      setShowAddSubjectModal(false);
      toast.success("Subject added");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleReseedSyllabus = async () => {
    setLoading(true);
    try {
      await reseedIpeQuestionBank();
      await fetchStructure();
      await fetchQuestions();
      toast.success("TS Intermediate Syllabus & Question Bank populated!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleAiFillSyllabus = async (scope: "subject" | "year") => {
    if (scope === "subject" && !selectedSubjectId) return toast.error("Select a subject first");
    setAiFilling(true);
    const t = toast.loading(
      scope === "year"
        ? "AI is filling every chapter of this year — this can take a few minutes…"
        : "AI is filling every chapter of this subject…",
    );
    try {
      const res = await bulkFillIpeQuestionBank({
        data: {
          subjectId: scope === "year" ? "all" : selectedSubjectId!,
          year,
          perChapter: { very_short_answer: 4, short_answer: 3, long_answer: 2 },
          generationType: "exact_pyq",
          toughness: "medium",
          skipFilled: true,
        },
      });
      await fetchQuestions();
      toast.success(
        `Added ${res.inserted} questions across ${res.chaptersProcessed} chapters${res.failures.length ? ` (${res.failures.length} chapters failed)` : ""}`,
        { id: t },
      );
    } catch (e) {
      toast.error((e as Error).message, { id: t });
    } finally {
      setAiFilling(false);
    }
  };


  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      {missingTables && (
        <div className="lg:col-span-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm">
            <AlertTriangle className="h-5 w-5" /> Supabase Database Setup Required for IPE
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The IPE database tables (<code className="bg-muted px-1 py-0.5 rounded">ipe_subjects</code>, <code className="bg-muted px-1 py-0.5 rounded">ipe_chapters</code>, <code className="bg-muted px-1 py-0.5 rounded">ipe_questions</code>) haven't been created in your Supabase project yet.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" onClick={handleCopySql} className="text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium">
              <Copy className="h-3.5 w-3.5" /> Copy SQL Setup Script
            </Button>
            <Button size="sm" variant="outline" onClick={handleReseedSyllabus} disabled={loading} className="text-xs gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Seed Syllabus & Question Bank
            </Button>
          </div>
        </div>
      )}

      {/* Left Panel: Year → Subject → Chapter */}
      <Card className="lg:col-span-1 border-border/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-primary" /> Syllabus Tree
            </span>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowAddSubjectModal(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Subject
            </Button>
          </CardTitle>

          {/* Year Switcher */}
          <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-lg text-xs mt-2">
            <button
              className={`py-1.5 rounded-md font-medium transition ${year === "1st_year" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              onClick={() => setYear("1st_year")}
            >
              1st Year
            </button>
            <button
              className={`py-1.5 rounded-md font-medium transition ${year === "2nd_year" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              onClick={() => setYear("2nd_year")}
            >
              2nd Year
            </button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading syllabus...</p>
          ) : filteredSubjects.length === 0 ? (
            <div className="py-4 text-center space-y-2">
              <p className="text-xs text-muted-foreground">No subjects for {year === "1st_year" ? "1st Year" : "2nd Year"}.</p>
              <Button size="sm" variant="outline" onClick={handleReseedSyllabus} className="text-xs">
                <RefreshCw className="h-3 w-3 mr-1 text-primary" /> Seed Syllabus & Questions
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSubjects.map((sub) => {
                const subChapters = chapters.filter((c) => c.subject_id === sub.id);
                const isSelectedSub = selectedSubjectId === sub.id;

                return (
                  <div key={sub.id} className="rounded-lg border border-border/60 overflow-hidden">
                    <button
                      onClick={() => setSelectedSubjectId(sub.id)}
                      className={`w-full flex items-center justify-between p-2.5 text-left text-xs font-semibold transition ${isSelectedSub ? "bg-primary/10 text-primary" : "bg-muted/40 hover:bg-muted"}`}
                    >
                      <span className="flex items-center gap-1.5">
                        <FolderOpen className="h-3.5 w-3.5" />
                        {sub.name}
                      </span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                        {subChapters.length} chaps
                      </Badge>
                    </button>

                    {isSelectedSub && (
                      <div className="p-1.5 space-y-1 bg-background">
                        {subChapters.length === 0 ? (
                          <div className="p-2 text-[11px] text-muted-foreground text-center">No chapters yet.</div>
                        ) : (
                          subChapters.map((chap) => {
                            const isSelectedChap = selectedChapterId === chap.id;
                            return (
                              <button
                                key={chap.id}
                                onClick={() => setSelectedChapterId(chap.id)}
                                className={`w-full text-left p-2 rounded-md text-xs transition flex items-center justify-between ${isSelectedChap ? "bg-primary/15 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}
                              >
                                <span className="truncate pr-2">{chap.chapter_order}. {chap.chapter_name}</span>
                                {isSelectedChap && <ChevronRight className="h-3 w-3 shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Panel: Filter Bar + Collapsible Question Sections */}
      <div className="lg:col-span-3 space-y-4">
        {/* Top Control Bar */}
        <Card className="border-border/80">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">
                  {subjects.find((s) => s.id === selectedSubjectId)?.name || "Select Subject"}
                  {selectedChapterId && (
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      / {chapters.find((c) => c.id === selectedChapterId)?.chapter_name}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {displayedQuestions.length} total questions ({displayedQuestions.filter((q) => q.verified).length} verified)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={handleReseedSyllabus} disabled={loading} className="h-8 text-xs gap-1">
                  <RefreshCw className="h-3.5 w-3.5 text-primary" /> Populate TS Syllabus & Bank
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkVerify} className="h-8 text-xs gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Bulk Verify
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowImportModal(true)} className="h-8 text-xs gap-1">
                  <Upload className="h-3.5 w-3.5" /> Import Document
                </Button>
                <Button size="sm" onClick={() => setShowAddModal(true)} className="h-8 text-xs gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add Question
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search questions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>

              <select
                className="rounded-md border border-input bg-background px-2 py-1 text-xs h-8"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Question Types</option>
                <option value="very_short_answer">Very Short Answer (VSA - 2M)</option>
                <option value="short_answer">Short Answer (SA - 4M)</option>
                <option value="long_answer">Long Answer (LA - 8M)</option>
              </select>

              <select
                className="rounded-md border border-input bg-background px-2 py-1 text-xs h-8"
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
              >
                <option value="all">All Sources</option>
                <option value="previous_year">Previous Year</option>
                <option value="textbook">Textbook</option>
                <option value="admin_added">Admin Added</option>
              </select>

              <select
                className="rounded-md border border-input bg-background px-2 py-1 text-xs h-8"
                value={filterVerified}
                onChange={(e) => setFilterVerified(e.target.value)}
              >
                <option value="all">All Verification</option>
                <option value="verified">Verified Only</option>
                <option value="unverified">Unverified Only</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Collapsible Sections for VSA, SA, LA */}
        <div className="space-y-4">
          <QuestionSectionGroup
            title="Very Short Answer (VSA — 2 Marks)"
            questions={vsaQuestions}
            defaultOpen={true}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            onToggleVerify={handleToggleVerify}
            onDelete={handleDelete}
          />

          <QuestionSectionGroup
            title="Short Answer (SA — 4 Marks)"
            questions={saQuestions}
            defaultOpen={true}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            onToggleVerify={handleToggleVerify}
            onDelete={handleDelete}
          />

          <QuestionSectionGroup
            title="Long Answer (LA — 8 Marks)"
            questions={laQuestions}
            defaultOpen={true}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            onToggleVerify={handleToggleVerify}
            onDelete={handleDelete}
          />
        </div>
      </div>

      {/* Manual Add Question Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Add Question to Bank</span>
                <Button size="sm" variant="ghost" onClick={() => setShowAddModal(false)}>✕</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Question Type</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { type: "very_short_answer", label: "Very Short (2M)", marks: 2 },
                    { type: "short_answer", label: "Short (4M)", marks: 4 },
                    { type: "long_answer", label: "Long (8M)", marks: 8 },
                  ].map((t) => (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => {
                        setManualType(t.type as any);
                        setManualMarks(t.marks);
                      }}
                      className={`p-2 rounded-md border text-xs font-medium ${manualType === t.type ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Question Text (LaTeX supported with $...$)</Label>
                <Textarea
                  rows={4}
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Enter question prompt..."
                  className="text-xs mt-1"
                />
                {manualText.trim() && (
                  <div className="mt-2 p-2 rounded bg-muted/40 border border-border">
                    <div className="text-[10px] text-muted-foreground font-medium mb-1">Preview:</div>
                    <RichContent className="text-xs">{manualText}</RichContent>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Source</Label>
                  <select
                    className="w-full mt-1 rounded-md border border-input bg-background p-2 text-xs"
                    value={manualSource}
                    onChange={(e) => setManualSource(e.target.value as any)}
                  >
                    <option value="admin_added">Admin Added</option>
                    <option value="previous_year">Previous Year (PYQ)</option>
                    <option value="textbook">Textbook</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Source Year (Optional)</Label>
                  <Input
                    placeholder="e.g. 2023 / March 2022"
                    value={manualSourceYear}
                    onChange={(e) => setManualSourceYear(e.target.value)}
                    className="text-xs mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSaveManualQuestion} disabled={manualSaving}>
                  {manualSaving ? "Saving..." : "Save Question"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Import Document Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Import Questions from PDF / Document</span>
                <Button size="sm" variant="ghost" onClick={() => setShowImportModal(false)}>✕</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Upload a past paper or notes document. AI will extract structured questions into the bank marked as <Badge variant="outline" className="text-[10px]">Unverified</Badge> for your review.
              </p>

              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-primary transition-colors">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs font-medium">{importBusy ? "Extracting questions..." : "Click to upload PDF / Document / Image"}</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,image/*,text/*"
                  disabled={importBusy}
                  onChange={(e) => e.target.files?.[0] && handleExtractFile(e.target.files[0])}
                />
              </label>

              {importPreview.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>Extracted {importPreview.length} questions</span>
                    <Badge variant="destructive" className="text-[10px]">Will require verification</Badge>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 border border-border rounded-md p-2">
                    {importPreview.map((q, i) => (
                      <div key={i} className="text-xs p-2 rounded bg-muted/40 border border-border/50 space-y-1">
                        <div className="font-semibold text-primary">Q{i + 1} ({q.questionType.replace(/_/g, " ")})</div>
                        <RichContent className="text-xs">{q.questionText}</RichContent>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" onClick={handleConfirmImport} disabled={importBusy} className="w-full mt-2">
                    {importBusy ? "Saving..." : `Confirm & Save ${importPreview.length} Questions to Bank`}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Subject Modal */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Add Subject ({year === "1st_year" ? "1st Year" : "2nd Year"})</span>
                <Button size="sm" variant="ghost" onClick={() => setShowAddSubjectModal(false)}>✕</Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Subject Name</Label>
                <Input
                  placeholder="e.g. Physics / Chemistry"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="text-xs mt-1"
                />
              </div>
              <Button size="sm" onClick={handleAddSubject} className="w-full">
                Add Subject
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function QuestionSectionGroup({
  title,
  questions,
  defaultOpen,
  selectedIds,
  setSelectedIds,
  onToggleVerify,
  onDelete,
}: {
  title: string;
  questions: Question[];
  defaultOpen: boolean;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  onToggleVerify: (id: string, verified: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card className="border-border/80">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 text-left font-semibold text-sm hover:bg-muted/40 transition"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {title}
        </span>
        <Badge variant="secondary" className="text-xs">
          {questions.length} questions
        </Badge>
      </button>

      {open && (
        <CardContent className="pt-0 space-y-3">
          {questions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">No questions in this section.</p>
          ) : (
            questions.map((q, idx) => {
              const isSelected = selectedIds.has(q.id);

              return (
                <div
                  key={q.id}
                  className={`p-3 rounded-lg border transition ${
                    isSelected ? "border-primary bg-primary/5" : "border-border/70 hover:border-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(q.id)} className="mt-1" />
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-semibold text-muted-foreground">Q{idx + 1}.</span>
                          <Badge variant="outline" className="text-[10px]">
                            {q.marks} Marks
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {q.source.replace(/_/g, " ")} {q.source_year ? `(${q.source_year})` : ""}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onToggleVerify(q.id, q.verified)}
                            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border transition ${
                              q.verified
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {q.verified ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" /> Verified
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3" /> Unverified (Click to verify)
                              </>
                            )}
                          </button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => onDelete(q.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="text-xs font-medium">
                        <RichContent>{q.question_text}</RichContent>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      )}
    </Card>
  );
}
