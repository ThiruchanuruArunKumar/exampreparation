# Exam Information Page

## Route
- Public route: `/exam-info/$examId`
- Implementation: [src/routes/exam-info.$examId.tsx](src/routes/exam-info.$examId.tsx)

## Purpose
This page displays exam details, timing, rules, and assignments before a student starts the exam. It can also resume an in-progress attempt if one already exists.

## What the user sees
- Exam title and state badge
- Duration, total marks, start/end times
- Exam rules including proctoring and timing rules
- Assigned attempt limits and due date
- A button to start or resume the attempt

## Key behaviors
- It loads exam info from `getStudentExamInfo`.
- It uses a countdown timer for upcoming exams and an end-time countdown while ongoing.
- If there is already an in-progress attempt tied to the session, it routes directly to the live exam page.
- It can start a new attempt with `startStudentAttempt`.

## Important implementation notes
- The component stores the student code in local storage for convenience.
- The rules are constructed in-memory and include anti-cheat and review visibility details.
- The route validation expects an optional `student` search parameter.

## Data flow
1. Student enters or reuses their student code.
2. The page loads exam metadata and assignment state.
3. The student either resumes or starts the exam.

## Edge cases
- If the student is not assigned to the exam, the flow will fail with a toast error.
- If the exam is closed or past due, the UI reflects that state.
