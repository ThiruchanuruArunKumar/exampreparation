# Exam Taking Page

## Route
- Public route: `/exam/$attemptId`
- Implementation: [src/routes/exam.$attemptId.tsx](src/routes/exam.$attemptId.tsx)

## Purpose
This is the main student exam experience. It loads questions, preserves answers, supports navigation and review flags, enforces time limits, and submits the attempt.

## What the user sees
- Exam header with timer and warning count
- Question palette for jumping between questions
- Current question prompt and answer input area
- Buttons for clear, mark for review, previous/next, and submit
- A start screen describing proctoring rules before the exam begins

## Key behaviors
- It uses `getStudentAttemptState` to load the attempt.
- It saves each answer with `saveStudentAnswer`.
- It tracks visited questions and reviewed questions.
- It uses [src/hooks/useProctoring.ts](src/hooks/useProctoring.ts) to enforce fullscreen and detect prohibited behavior.
- On submit, it calls `submitStudentAttempt` and renders the result screen.

## Important implementation notes
- The page uses `sessionStorage` to verify the student session.
- The question palette supports subject boundaries and subsection-based navigation when the exam pattern uses sections.
- The component supports multiple question types: MCQ, multi-select, true/false, and short answer.

## Data flow
1. The page boots by verifying the attempt token.
2. It loads the exam structure and questions.
3. User answers questions and the answers are persisted.
4. The timer and proctoring hooks drive submission or auto-submit.

## Security and anti-cheat behavior
- Fullscreen is requested automatically.
- Tab switch, blur, copy/paste, right-click, screenshot shortcuts, and other prohibited actions trigger warnings.
- After three warnings, the exam auto-submits.
