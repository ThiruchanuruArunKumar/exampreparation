ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS marks_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS graded_at timestamptz,
  ADD COLUMN IF NOT EXISTS grader_notes text;

ALTER TABLE public.answers
  ADD COLUMN IF NOT EXISTS grader_feedback text;

ALTER TABLE public.ipe_questions
  ADD COLUMN IF NOT EXISTS expected_answer text;

CREATE INDEX IF NOT EXISTS idx_attempts_marks_published ON public.attempts (exam_id, marks_published);