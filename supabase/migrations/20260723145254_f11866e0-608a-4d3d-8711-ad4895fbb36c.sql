
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS pattern text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS negative_mark_per_wrong numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pattern_config jsonb;

ALTER TABLE public.exams
  DROP CONSTRAINT IF EXISTS exams_pattern_check;
ALTER TABLE public.exams
  ADD CONSTRAINT exams_pattern_check CHECK (pattern IN ('neet','eamcet','mains','custom'));
