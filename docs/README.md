# ExamPrep Documentation Bundle

This folder contains a practical documentation set for understanding the ExamPrep application end to end.

## Recommended reading order
1. [README.md](README.md) — overview and entry point
2. [pages/landing-page.md](pages/landing-page.md) — student landing experience
3. [pages/auth-page.md](pages/auth-page.md) — admin authentication flow
4. [pages/exam-info-page.md](pages/exam-info-page.md) — pre-exam information page
5. [pages/exam-taking-page.md](pages/exam-taking-page.md) — active exam experience
6. [pages/result-page.md](pages/result-page.md) — review and feedback experience
7. [pages/parent-report-page.md](pages/parent-report-page.md) — parent-facing report
8. [pages/admin-dashboard.md](pages/admin-dashboard.md) — admin workspace landing page
9. [pages/new-exam-page.md](pages/new-exam-page.md) — exam creation flow
10. [pages/exam-editor-page.md](pages/exam-editor-page.md) — exam editing flow
11. [pages/students-page.md](pages/students-page.md) — student management
12. [pages/results-pages.md](pages/results-pages.md) — results and attempt review
13. [pages/admins-page.md](pages/admins-page.md) — admin account management
14. [api/server-functions.md](api/server-functions.md) — core server logic
15. [features/exam-workflow.md](features/exam-workflow.md) — main workflow
16. [features/proctoring-and-timing.md](features/proctoring-and-timing.md) — integrity features
17. [features/ai-and-insights.md](features/ai-and-insights.md) — AI assistance
18. [roles/roles-and-access.md](roles/roles-and-access.md) — role model

## Project summary
ExamPrep is a web app for creating, publishing, and taking timed exams. It supports:
- Student exam participation
- Admin exam creation and editing
- Real-time exam state and progress persistence
- Proctoring-style warnings and auto-submit behavior
- AI-generated questions and feedback
- Parent report view for student history

## Architecture overview
- Frontend: React + TypeScript + TanStack Router + TanStack Start
- Backend/business logic: server functions under [../src/lib](../src/lib)
- Data: Supabase tables and realtime sync hooks
- UI: Tailwind + shadcn-style components

## Key route groups
- Public student routes: [../src/routes/index.tsx](../src/routes/index.tsx), [../src/routes/auth.tsx](../src/routes/auth.tsx), [../src/routes/exam-info.$examId.tsx](../src/routes/exam-info.$examId.tsx), [../src/routes/exam.$attemptId.tsx](../src/routes/exam.$attemptId.tsx), [../src/routes/parent.tsx](../src/routes/parent.tsx)
- Authenticated admin routes: [../src/routes/_authenticated](../src/routes/_authenticated)
