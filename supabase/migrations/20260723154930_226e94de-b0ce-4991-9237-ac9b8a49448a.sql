
CREATE TABLE public.exam_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  pattern TEXT NOT NULL DEFAULT 'neet',
  pattern_config JSONB,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  show_result_after_submit BOOLEAN NOT NULL DEFAULT true,
  show_answer_sheet BOOLEAN NOT NULL DEFAULT true,
  show_answer_book BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_drafts TO authenticated;
GRANT ALL ON public.exam_drafts TO service_role;

ALTER TABLE public.exam_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own drafts" ON public.exam_drafts
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER update_exam_drafts_updated_at
  BEFORE UPDATE ON public.exam_drafts
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

CREATE INDEX exam_drafts_owner_updated_idx ON public.exam_drafts (owner_id, updated_at DESC);
