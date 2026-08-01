# Results and Attempt Review Pages

## Routes
- Authenticated results index: `/results`
- Student-specific results: `/results/$studentId`
- Attempt review: `/attempt-results/$attemptId`

## Purpose
These pages provide admins with reporting and review tools for student performance, including per-student summaries, attempt-level reviews, and detailed answer analysis.

## What the user sees
- An overview of all result entries
- Per-student scorecards and attempt history
- Attempt-by-attempt answer review with score details

## Key behaviors
- They fetch results and attempt data from server functions.
- They show how a student performed against exam expectations and scoring rules.
- They support detailed review of answer data and generated explanations.

## Important implementation notes
- These pages are heavily tied to the data model for attempts, questions, and scoring.
- They are used by admins after students have completed exams.

## Data flow
1. Admin opens the results section.
2. The page loads student or attempt data from the server.
3. Admin reviews the outcomes and can inspect the answer detail.
