
-- 1) Exam settings for what students see after submitting
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS show_result_after_submit boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_answer_sheet boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_answer_book boolean NOT NULL DEFAULT false;

-- 2) Convert existing student_code values (e.g. "STU-XXXXX") to plain 6-letter uppercase IDs.
--    Uses A-Z only (no digits, no ambiguous letters) so codes are always caps letters.
DO $$
DECLARE
  r record;
  new_code text;
  letters text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  i int;
BEGIN
  FOR r IN SELECT id FROM public.students LOOP
    LOOP
      new_code := '';
      FOR i IN 1..6 LOOP
        new_code := new_code || substr(letters, 1 + floor(random() * length(letters))::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.students WHERE student_code = new_code);
    END LOOP;
    UPDATE public.students SET student_code = new_code WHERE id = r.id;
  END LOOP;
END $$;

-- 3) Cache table for AI-generated detailed "Answer book" explanations, one per question.
CREATE TABLE IF NOT EXISTS public.question_explanations (
  question_id uuid PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
  explanation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.question_explanations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_explanations TO authenticated;
GRANT ALL ON public.question_explanations TO service_role;

ALTER TABLE public.question_explanations ENABLE ROW LEVEL SECURITY;

-- Anyone can read explanations (they are tied to public exam questions and only shown when the exam allows Answer Book).
CREATE POLICY "Anyone can read explanations"
  ON public.question_explanations FOR SELECT
  USING (true);

-- Only admins can write/update (server uses service role, but keep an explicit policy for authenticated admins too).
CREATE POLICY "Admins manage explanations"
  ON public.question_explanations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
