import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AppShell } from "@/components/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuestionBankTab } from "@/components/ipe/QuestionBankTab";
import { ExamCreationTab } from "@/components/ipe/ExamCreationTab";
import { BookOpen, PlusCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ipe")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ tab: z.enum(["question-bank", "exam-creation"]).optional() }).parse(s),
  head: () => ({
    meta: [
      { title: "IPE (TS Intermediate) — ExamPrep" },
      { name: "description", content: "TS Intermediate Public Examination Question Bank and Exam Creation" },
      { property: "og:title", content: "IPE (TS Intermediate) — ExamPrep" },
      { property: "og:description", content: "TS Intermediate Public Examination Question Bank and Exam Creation" },
    ],
  }),
  component: IpeAdminPage,
});

function IpeAdminPage() {
  const search = Route.useSearch();
  const [activeTab, setActiveTab] = useState<"question-bank" | "exam-creation">(
    search.tab === "exam-creation" ? "exam-creation" : "question-bank",
  );

  return (
    <AppShell title="IPE (TS Intermediate)">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">TS Intermediate Public Examination (IPE)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Drillable chapter-wise question bank and 3-mode exam creation for TS Inter 1st & 2nd Year.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full space-y-6">
          <TabsList className="grid grid-cols-2 max-w-md">
            <TabsTrigger value="question-bank" className="gap-2 text-xs font-semibold">
              <BookOpen className="h-4 w-4" /> Question Bank
            </TabsTrigger>
            <TabsTrigger value="exam-creation" className="gap-2 text-xs font-semibold">
              <PlusCircle className="h-4 w-4" /> Exam Creation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="question-bank" className="mt-0">
            <QuestionBankTab />
          </TabsContent>

          <TabsContent value="exam-creation" className="mt-0">
            <ExamCreationTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
