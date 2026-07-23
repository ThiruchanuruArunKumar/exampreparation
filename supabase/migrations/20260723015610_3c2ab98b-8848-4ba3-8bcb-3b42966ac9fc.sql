
-- 1. Students table
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code text UNIQUE NOT NULL,
  name text NOT NULL,
  email text,
  class_name text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY students_admin_all ON public.students FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER students_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.tg_updated_at();

-- 2. Exam access code (6 chars)
ALTER TABLE public.exams ADD COLUMN access_code text;
UPDATE public.exams SET access_code = upper(substr(md5(random()::text || id::text), 1, 6));
ALTER TABLE public.exams ALTER COLUMN access_code SET NOT NULL;
CREATE UNIQUE INDEX exams_access_code_key ON public.exams(access_code);

-- 3. Clear dependent data (previously tied to auth users)
TRUNCATE public.answers, public.insights, public.attempts, public.assignments;

-- 4. Repoint FKs from auth.users to public.students
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_student_id_fkey;
ALTER TABLE public.assignments ADD CONSTRAINT assignments_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.attempts DROP CONSTRAINT IF EXISTS attempts_student_id_fkey;
ALTER TABLE public.attempts ADD CONSTRAINT attempts_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

-- 5. Session token for anonymous attempt continuation
ALTER TABLE public.attempts ADD COLUMN session_token text;

-- 6. Drop old student-user policies; keep admin-only access
DROP POLICY IF EXISTS assignments_student_read ON public.assignments;
DROP POLICY IF EXISTS exams_assigned_read ON public.exams;
DROP POLICY IF EXISTS attempts_read ON public.attempts;
DROP POLICY IF EXISTS answers_read ON public.answers;
DROP POLICY IF EXISTS insights_read ON public.insights;

CREATE POLICY attempts_admin_read ON public.attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 7. Simpler profile trigger: no more pending students self-signing up.
-- First user becomes admin; subsequent signups become admins too (self-signup is only for admins now).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email,''), '@', 1)),
    'approved'
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  RETURN NEW;
END;
$$;
