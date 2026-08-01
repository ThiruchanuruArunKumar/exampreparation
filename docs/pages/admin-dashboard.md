# Admin Dashboard

## Route
- Authenticated route: `/dashboard`
- Implementation: [../../src/routes/_authenticated/dashboard.tsx](../../src/routes/_authenticated/dashboard.tsx)

## Purpose
This is the main admin workspace landing page. It shows the admin’s exams and drafts and enables quick navigation to create or edit exams.

## What the user sees
- A list of exams with counts of questions, assignments, and duration
- A list of drafts for unfinished exam work
- Buttons to create a new exam or resume a draft
- Exam password copy controls

## Key behaviors
- It queries the `exams` table and the `exam_drafts` table.
- It listens to realtime updates for exams and draft-related data.
- It allows deleting a draft.
- It copies the access code to the clipboard.

## Important implementation notes
- The dashboard is wrapped by the authenticated layout shell.
- It is the main entry into the exam creation workflow.

## Data flow
1. The page loads exams and drafts.
2. It displays them in the UI.
3. Admin can click into an exam editor or create a new exam.
