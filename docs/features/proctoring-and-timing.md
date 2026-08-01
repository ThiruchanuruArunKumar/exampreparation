# Proctoring and Timing

## Purpose
The platform supports exam integrity features such as warnings, auto-submit behavior, and time-based completion.

## Core behaviors
- A timer begins when the student starts the exam.
- The app tracks warning events such as tab switches, copy/paste, or suspicious behavior.
- If warning thresholds are exceeded, the attempt may be auto-submitted or terminated.
- The app persists the student’s progress regularly.

## Implementation notes
- The exam-taking route uses proctoring hooks from [../../src/hooks/useProctoring.ts](../../src/hooks/useProctoring.ts).
- Attempt state is updated on the server to reflect warnings and completion.
