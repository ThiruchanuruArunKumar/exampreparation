import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGlobalAnalytics } from "@/lib/admin.functions";
import { Users, FileText, ClipboardList, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — ExamPrep" },
      { name: "description", content: "Class-wide performance overview and trends." },
      { property: "og:title", content: "Analytics — ExamPrep" },
      { property: "og:description", content: "Class-wide performance overview and trends." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    getGlobalAnalytics().then(setData).catch(() => setData({ error: true }));
  }, []);

  if (!data) return <AppShell title="Analytics"><p>Loading…</p></AppShell>;
  if (data.error) return <AppShell title="Analytics"><p className="text-sm text-destructive">Admin only.</p></AppShell>;

  const stats = [
    { label: "Exams", value: data.examCount, icon: FileText },
    { label: "Students", value: data.studentCount, icon: Users },
    { label: "Attempts", value: data.attemptCount, icon: ClipboardList },
    { label: "Avg score", value: `${data.averagePercent}%`, icon: TrendingUp },
  ];

  return (
    <AppShell title="Analytics">
      <h1 className="mb-6 text-2xl font-semibold">Class overview</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-5">
                <Icon className="mb-3 h-5 w-5 text-muted-foreground" />
                <div className="text-2xl font-semibold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader><CardTitle className="text-base">Recent attempts</CardTitle></CardHeader>
        <CardContent>
          {data.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No attempts yet.</p>
          ) : (
            <div className="space-y-2">
              {data.recent.map((a: any) => {
                const pct = a.max_score ? Math.round((Number(a.score) / Number(a.max_score)) * 100) : 0;
                return (
                  <div key={a.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                    <span className="text-muted-foreground">
                      {a.submitted_at ? new Date(a.submitted_at).toLocaleString() : "—"}
                    </span>
                    <span className="font-medium">{a.score}/{a.max_score} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
