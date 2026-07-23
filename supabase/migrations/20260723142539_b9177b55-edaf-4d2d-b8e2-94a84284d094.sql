
CREATE INDEX IF NOT EXISTS attempts_student_id_idx ON public.attempts(student_id);
CREATE INDEX IF NOT EXISTS attempts_exam_id_idx ON public.attempts(exam_id);
CREATE INDEX IF NOT EXISTS attempts_started_at_idx ON public.attempts(started_at DESC);
CREATE INDEX IF NOT EXISTS answers_attempt_id_idx ON public.answers(attempt_id);
CREATE INDEX IF NOT EXISTS questions_exam_id_idx ON public.questions(exam_id);
CREATE INDEX IF NOT EXISTS assignments_student_id_idx ON public.assignments(student_id);
CREATE INDEX IF NOT EXISTS assignments_exam_id_idx ON public.assignments(exam_id);
