# Exam Editor Page

## Route
- Authenticated route: `/exams/$examId`
- Implementation: [../../src/routes/_authenticated/exams/$examId.tsx](../../src/routes/_authenticated/exams/$examId.tsx)

## Purpose
This page is the admin editor for an existing exam. It lets the admin make changes to exam metadata, question content, and availability settings after creation.

## What the user sees
- Exam summary and status information
- A form for editing title, password, timing, and visibility
- The question list for the selected exam
- Controls to add or remove questions and update the exam state

## Key behaviors
- It loads the exam and its questions from the database.
- It saves updates back to the exam record and the linked questions.
- It supports publishing or making the exam available to students.

## Important implementation notes
- This page is used after the exam has already been created.
- The same data model is shared by the new exam flow and the editor flow.

## Data flow
1. Admin opens an existing exam.
2. The page loads exam configuration and questions.
3. Admin updates settings and saves them.
4. Student-facing behavior changes immediately if the exam is published.
