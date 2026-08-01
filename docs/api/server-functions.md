# Core Server Functions

This document summarizes the server-side modules in [../../src/lib](../../src/lib) that power the application.

## Exam and attempt management
- `exams.functions.ts` manages exam creation, editing, publishing, fetching, and deletion.
- `attempts.functions.ts` manages attempt creation, resumption, answer saving, submission, and grading.
- `student.functions.ts` provides student-facing lookups and history.
- `drafts.functions.ts` handles draft persistence and restoration.

## Admin operations
- `admin.functions.ts` contains admin and role-related server helpers.
- `super-admin.functions.ts` contains privileged admin actions.

## AI and content generation
- `ai-gateway.server.ts` is the integration point for AI model invocations.
- `latex-repair.ts` is used to repair or normalize LaTeX content before display or parsing.

## Utility and platform support
- `utils.ts` holds shared helpers for formatting, data access, and platform utilities.
- `error-capture.ts` and `lovable-error-reporting.ts` provide observability and reporting.

## Important architectural note
The app uses server functions rather than client-only API calls for business logic. This keeps database updates, auth checks, and AI logic centralized and easier to reason about.
