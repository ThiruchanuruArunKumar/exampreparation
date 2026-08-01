# Landing Page

## Route
- Public route: `/`
- Implementation: [src/routes/index.tsx](src/routes/index.tsx)

## Purpose
This is the public entry page for students. It allows them to enter their student ID and exam password, begin an attempt, and view exams assigned to them.

## What the user sees
- Hero header with branding and admin sign-in link
- Student ID input field
- Exam password input field
- Start exam button
- A list of their assigned exams with statuses such as ongoing, upcoming, completed, or closed

## Key behaviors
- On load, it restores recent student IDs from local storage and optionally refreshes their exams.
- It calls `listStudentExams` to fetch exams for the student.
- It calls `startStudentAttempt` when the form is submitted.
- On success, it stores a session token in `sessionStorage` and navigates to the exam route.

## Important implementation notes
- Student IDs are normalized to uppercase.
- Recent IDs are tracked through [src/lib/lastStudentId.ts](src/lib/lastStudentId.ts).
- The page uses the `ThemeToggle` component and a polished hero layout.

## Data flow
1. User enters student ID and exam password.
2. The page calls the student server function to verify credentials and create or resume an attempt.
3. The route moves to the exam page with a session token attached.

## Edge cases
- Missing student ID or password shows a toast error.
- Invalid credentials or exam access produce an error toast and no navigation.
