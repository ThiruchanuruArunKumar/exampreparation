-- Migration for IPE (TS Intermediate Public Examination) Exam Type

CREATE TABLE IF NOT EXISTS public.ipe_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year TEXT NOT NULL CHECK (year IN ('1st_year', '2nd_year')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ipe_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.ipe_subjects(id) ON DELETE CASCADE,
  chapter_name TEXT NOT NULL,
  chapter_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ipe_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.ipe_chapters(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL CHECK (question_type IN ('very_short_answer', 'short_answer', 'long_answer')),
  question_text TEXT NOT NULL,
  marks INT NOT NULL DEFAULT 2,
  source TEXT NOT NULL CHECK (source IN ('previous_year', 'textbook', 'admin_added')),
  source_year TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ipe_previous_papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.ipe_subjects(id) ON DELETE CASCADE,
  year TEXT NOT NULL,
  paper_file_url TEXT,
  structured_question_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attempt_answer_sheet_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  page_number INT NOT NULL DEFAULT 1,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.ipe_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipe_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipe_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipe_previous_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answer_sheet_images ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users & admins access
DROP POLICY IF EXISTS ipe_subjects_all ON public.ipe_subjects;
CREATE POLICY ipe_subjects_all ON public.ipe_subjects FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ipe_chapters_all ON public.ipe_chapters;
CREATE POLICY ipe_chapters_all ON public.ipe_chapters FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ipe_questions_all ON public.ipe_questions;
CREATE POLICY ipe_questions_all ON public.ipe_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ipe_previous_papers_all ON public.ipe_previous_papers;
CREATE POLICY ipe_previous_papers_all ON public.ipe_previous_papers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS attempt_answer_sheet_images_all ON public.attempt_answer_sheet_images;
CREATE POLICY attempt_answer_sheet_images_all ON public.attempt_answer_sheet_images FOR ALL TO authenticated USING (true) WITH CHECK (true);
