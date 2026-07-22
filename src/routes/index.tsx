import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, ShieldCheck, Sparkles, Timer } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ExamPrep — AI Exams & Analytics" },
      {
        name: "description",
        content:
          "Upload any file, let AI generate exams, proctor attempts, and see exactly where each student is lagging.",
      },
      { property: "og:title", content: "ExamPrep — AI Exams & Analytics" },
      {
        property: "og:description",
        content:
          "Upload any file, let AI generate exams, proctor attempts, and see exactly where each student is lagging.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">ExamPrep</span>
          </div>
          <Link
            to="/auth"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            AI-powered exams. Real analytics.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Upload any PDF, doc, or image. AI extracts every question. Students take secure proctored
            exams. You see exactly where they're lagging.
          </p>
          <div className="mt-10 flex justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Get started
            </Link>
          </div>
        </section>

        <section className="grid gap-6 pb-24 sm:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: "AI question extraction",
              body: "Drop a file. AI identifies MCQ, multi-select, true/false, and short-answer questions with topics and difficulty.",
            },
            {
              icon: ShieldCheck,
              title: "Secure proctoring",
              body: "Fullscreen, tab-switch, copy-paste, and shortcut detection. Three warnings and the exam auto-submits.",
            },
            {
              icon: Timer,
              title: "Personalized insights",
              body: "Per-topic accuracy, mastery trends, and AI recommendations pinpoint what to study next.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-border p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
