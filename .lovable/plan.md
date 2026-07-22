
# ExamPrep — AI-Powered Exam Platform

A secure exam platform where you (admin) upload study material, AI extracts questions, students take proctored exams, and you get deep AI-driven analytics on where each student is lagging.

## Roles
- **Admin** (you): full control — upload/create exams, assign, reassign, view marks, manage students, view analytics.
- **Student** (sister + future students): take assigned exams, view own results and study recommendations.

## Core flows

### 1. Auth & accounts
- Email/password + Google sign-in (Lovable Cloud).
- First signup becomes admin; subsequent signups are students by default. Admin can promote/demote and invite via email.
- Roles stored in a separate `user_roles` table (security best practice), gated by `has_role()` SECURITY DEFINER function.

### 2. Exam creation (AI-powered)
- Admin uploads PDF / DOCX / TXT / image of question paper.
- File goes to storage → server function sends it to Lovable AI (`openai/gpt-5.5`, multimodal) with a structured-output schema.
- AI extracts questions with type (**MCQ, multi-select, true/false, short-answer**), options, correct answer(s), topic tag, difficulty (easy/medium/hard), and suggested marks.
- Admin reviews the extracted questions in an editor before publishing: fix wording, correct answer, add/remove questions, set marks & time limit.
- Admin can also create exams manually.

### 3. Assignment
- Admin assigns an exam to one or more students with a due date and attempt limit.
- Reassign: admin can reset a completed/expired attempt for a student.

### 4. Taking the exam (proctored)
- Fullscreen enforced on start; timer visible.
- **Warning system (3 strikes → auto-submit)** triggered by:
  - Tab switch / window blur
  - Exiting fullscreen
  - Right-click / copy / paste / keyboard shortcuts (Ctrl+C/V/T/W, F12, etc.)
  - Browser back / refresh (state persisted so refresh mid-exam still counts as warning + resumes)
- Each warning shows a modal with count; 3rd triggers auto-submit.
- Answers auto-saved to DB every few seconds (resume if network drops).
- Server-side timer enforcement — client clock is not trusted.

### 5. Grading
- MCQ / multi-select / true-false: auto-graded server-side.
- Short-answer: AI-graded via Lovable AI with rubric + admin can override any score.

### 6. Analytics — "where she is lagging" (Full AI insights)
- Per-attempt: score, time-per-question, accuracy by topic, accuracy by difficulty.
- Per-student dashboard: trend chart across attempts, strongest/weakest topics, mastery over time.
- **AI insights**: after each submission, Lovable AI generates a personalized report — weak topics, misconception patterns, recommended study focus, next-step practice suggestions.
- Admin sees aggregate view across all students; student sees own report only.

## Security
- RLS on every table; students can only read their own attempts/answers.
- Correct answers never sent to client during an active attempt.
- Server functions (`createServerFn`) handle: start attempt, save answer, submit, grade, generate insights.
- Zod validation on every input. File upload size/type limits.
- Warning counter tracked server-side, not just client-side.
- `has_role()` guard on all admin-only operations.

## Tech / stack details

- **Stack**: TanStack Start + React + Tailwind + shadcn/ui (already scaffolded).
- **Backend**: Lovable Cloud (Postgres + Auth + Storage).
- **AI**: Lovable AI Gateway, `openai/gpt-5.5` for question extraction, short-answer grading, and insights (structured output via JSON schema).
- **Routes**:
  - `/` — public landing with sign-in CTA
  - `/auth` — sign in / sign up
  - `/_authenticated/dashboard` — role-aware home
  - `/_authenticated/exams` — student: assigned exams list
  - `/_authenticated/exam/$attemptId` — proctored exam-taking UI
  - `/_authenticated/results/$attemptId` — result + AI insights
  - `/_authenticated/admin/exams` — admin: exam library, create/upload
  - `/_authenticated/admin/exams/$examId/edit` — question editor
  - `/_authenticated/admin/assignments` — assign / reassign
  - `/_authenticated/admin/students` — student list + per-student analytics
  - `/_authenticated/admin/students/$studentId` — deep analytics view

- **Tables**:
  - `profiles` (id, email, full_name)
  - `user_roles` (user_id, role) — separate for security
  - `exams` (id, title, description, duration_minutes, total_marks, created_by, status)
  - `questions` (id, exam_id, type, prompt, options jsonb, correct_answer jsonb, marks, topic, difficulty, order_index)
  - `assignments` (id, exam_id, student_id, due_at, max_attempts, assigned_by)
  - `attempts` (id, assignment_id, student_id, started_at, submitted_at, status, warning_count, score, auto_submitted)
  - `answers` (id, attempt_id, question_id, response jsonb, is_correct, marks_awarded, time_spent_seconds)
  - `insights` (id, attempt_id, weak_topics jsonb, recommendations text, generated_at)

- **Extra useful features included**:
  - Question randomization + option shuffling per attempt
  - Auto-save / resume
  - CSV export of results
  - Dark mode
  - Mobile-responsive exam UI

## Build order
1. Enable Lovable Cloud + auth (email/password + Google) + roles + profiles.
2. Landing page, auth page, `_authenticated` gate, role-aware dashboard.
3. Admin: exam CRUD + manual question editor.
4. AI file upload → question extraction pipeline.
5. Assignment + reassignment flows.
6. Student exam-taking UI with full proctoring (warnings, fullscreen, auto-save, server timer).
7. Auto-grading + AI short-answer grading + AI insights generation.
8. Analytics dashboards (student + admin) with charts.
9. Polish: CSV export, dark mode, responsive pass, SEO metadata per route.

Approve to start with step 1 (Cloud + auth + roles).
