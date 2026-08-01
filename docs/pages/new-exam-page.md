# New Exam Page

## Route
- Authenticated route: `/exams/new`
- Implementation: [../../src/routes/_authenticated/exams/new.tsx](../../src/routes/_authenticated/exams/new.tsx)

## Purpose
This page is the primary exam-creation wizard. It allows an admin to create the exam structure, choose a pattern, generate or upload questions, and save the exam as either a draft or a published exam.

## What the user sees
- Exam title input
- Pattern picker for exam presets such as NEET, EAMCET, JEE Main, or custom
- Question source panel for AI generation, note upload, extraction, or manual entry
- Toggle controls for result visibility, answer sheet, and answer book
- A preview list of generated questions

## Key behaviors
- It saves the draft automatically as the admin edits.
- It restores a draft when a `draftId` is supplied in the query string.
- It uses the `QuestionSource` component to generate questions from notes, descriptions, uploaded files, or manual data.
- It creates the exam with `createExam` and navigates to the exam detail page.

## Important implementation notes
- The page includes autosave logic with debounce and flush on tab hide or unmount.
- It supports a mobile split view for setup and questions.
- The default exam pattern presets come from [../../src/lib/exam-patterns.ts](../../src/lib/exam-patterns.ts).

## Data flow
1. Admin defines the exam title and pattern.
2. The page gathers question content through generation or upload.
3. The draft is saved automatically.
4. When finalized, the exam is published.
