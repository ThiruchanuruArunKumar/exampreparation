# Students Page

## Route
- Authenticated route: `/students`
- Implementation: [../../src/routes/_authenticated/students.tsx](../../src/routes/_authenticated/students.tsx)

## Purpose
This page is the admin view for managing student accounts and examining their activity history.

## What the user sees
- A searchable list of students
- Student-level metadata such as ID, name, and status
- Links into overall performance or exam history

## Key behaviors
- It loads student records from the database.
- It provides a route into the student results and attempts-related views.

## Important implementation notes
- The page is part of the admin workspace and is intended for operational visibility.

## Data flow
1. Admin loads the students list.
2. The admin selects a student to inspect results or attempt history.
3. The app routes into the appropriate results pages.
