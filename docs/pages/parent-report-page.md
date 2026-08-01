# Parent Report Page

## Route
- Public route: `/parent`
- Implementation: [../../src/routes/parent.tsx](../../src/routes/parent.tsx)

## Purpose
This is a read-only report for parents or guardians. It shows a student's exam history, trend, proctoring warnings, and weak/strong topics.

## What the user sees
- A student ID input box
- Summary cards for attempted exams, average score, best score, and lowest score
- Trend analysis over recent vs earlier attempts
- Weak and strong topic summaries
- An exam-by-exam history list

## Key behaviors
- It calls `getStudentHistory` with the student ID.
- It caches the most recently used student ID.
- It computes trend and topic summaries from past attempts and insights.

## Important implementation notes
- This page does not require authentication.
- It is designed to be printable.

## Data flow
1. Parent enters the student ID.
2. The app loads the student history and insight data.
3. The page aggregates the metrics into a summary report.
