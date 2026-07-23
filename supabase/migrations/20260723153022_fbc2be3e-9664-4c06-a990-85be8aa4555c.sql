
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_code TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.gen_admin_code()
RETURNS TEXT LANGUAGE plpgsql SET search_path=public AS $$
DECLARE alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code TEXT; ok BOOLEAN;
BEGIN
  LOOP
    code := 'ADM-';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random()*length(alphabet))::int, 1);
    END LOOP;
    SELECT NOT EXISTS(SELECT 1 FROM public.profiles WHERE admin_code = code) INTO ok;
    EXIT WHEN ok;
  END LOOP;
  RETURN code;
END $$;

UPDATE public.profiles p
SET admin_code = public.gen_admin_code()
WHERE admin_code IS NULL
  AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'admin');

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'super_admin'::public.app_role
FROM public.profiles p
JOIN public.user_roles r ON r.user_id = p.id AND r.role='admin'
ORDER BY p.created_at ASC
LIMIT 1
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email,''),'@',1)),
    'pending'
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.exams ALTER COLUMN created_by SET NOT NULL;
UPDATE public.students SET created_by = (
  SELECT user_id FROM public.user_roles WHERE role='super_admin' LIMIT 1
) WHERE created_by IS NULL;
ALTER TABLE public.students ALTER COLUMN created_by SET NOT NULL;

DROP POLICY IF EXISTS exams_admin_all ON public.exams;
CREATE POLICY exams_owner_all ON public.exams FOR ALL TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS students_admin_all ON public.students;
CREATE POLICY students_owner_all ON public.students FOR ALL TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS questions_admin_all ON public.questions;
CREATE POLICY questions_owner_all ON public.questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = questions.exam_id AND e.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = questions.exam_id AND e.created_by = auth.uid()));

DROP POLICY IF EXISTS assignments_admin_all ON public.assignments;
CREATE POLICY assignments_owner_all ON public.assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = assignments.exam_id AND e.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = assignments.exam_id AND e.created_by = auth.uid()));

DROP POLICY IF EXISTS attempts_admin_all ON public.attempts;
DROP POLICY IF EXISTS attempts_admin_read ON public.attempts;
CREATE POLICY attempts_owner_all ON public.attempts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = attempts.exam_id AND e.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.exams e WHERE e.id = attempts.exam_id AND e.created_by = auth.uid()));

DROP POLICY IF EXISTS answers_admin_all ON public.answers;
CREATE POLICY answers_owner_all ON public.answers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.attempts a JOIN public.exams e ON e.id=a.exam_id WHERE a.id = answers.attempt_id AND e.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.attempts a JOIN public.exams e ON e.id=a.exam_id WHERE a.id = answers.attempt_id AND e.created_by = auth.uid()));

DROP POLICY IF EXISTS insights_admin_all ON public.insights;
CREATE POLICY insights_owner_all ON public.insights FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.attempts a JOIN public.exams e ON e.id=a.exam_id WHERE a.id = insights.attempt_id AND e.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.attempts a JOIN public.exams e ON e.id=a.exam_id WHERE a.id = insights.attempt_id AND e.created_by = auth.uid()));

DROP POLICY IF EXISTS "Admins manage explanations" ON public.question_explanations;
CREATE POLICY qexpl_owner_all ON public.question_explanations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.questions q JOIN public.exams e ON e.id=q.exam_id WHERE q.id = question_explanations.question_id AND e.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.questions q JOIN public.exams e ON e.id=q.exam_id WHERE q.id = question_explanations.question_id AND e.created_by = auth.uid()));

DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_delete ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY profiles_super_delete ON public.profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

DROP POLICY IF EXISTS user_roles_read ON public.user_roles;
CREATE POLICY user_roles_read ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'));
