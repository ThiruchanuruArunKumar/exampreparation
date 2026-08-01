# Result and Review Page

## Route
- Public route: `/exam/$attemptId` after submission
- Implementation: [../../src/routes/exam.$attemptId.tsx](../../src/routes/exam.$attemptId.tsx)

## Purpose
After submission, the student sees their score, submission status, and optionally their answer sheet, answer book, and AI feedback.

## What the user sees
- Submission success or auto-submit notice
- Total marks scored and percentage
- A button to reveal results
- Tabs for summary, answer sheet, and answer book when enabled by the exam settings

## Key behaviors
- `submitStudentAttempt` computes the score and stores it on the attempt.
- AI feedback is generated if the exam uses insights.
- `getStudentReview` and `getStudentExplanation` provide review and explanation content when enabled.
- The page shows the answer sheet and answer book only if the exam settings allow them.

## Important implementation notes
- The result view is rendered in the same route file as the exam-taking page.
- The answer book explanation is loaded on demand per question.
- If the exam was terminated due to warnings, the page shows that explicitly.

## Data flow
1. Student submits the exam.
2. The server grades the attempt and saves the score and insight.
3. The UI renders the summary and review tabs.
