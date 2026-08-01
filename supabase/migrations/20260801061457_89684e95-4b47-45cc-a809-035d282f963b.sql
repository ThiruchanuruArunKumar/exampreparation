DROP POLICY IF EXISTS ipe_subjects_all ON public.ipe_subjects;
DROP POLICY IF EXISTS ipe_chapters_all ON public.ipe_chapters;
DROP POLICY IF EXISTS ipe_questions_all ON public.ipe_questions;
DROP POLICY IF EXISTS ipe_previous_papers_all ON public.ipe_previous_papers;
DROP POLICY IF EXISTS attempt_answer_sheet_images_all ON public.attempt_answer_sheet_images;

CREATE POLICY ipe_subjects_read ON public.ipe_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY ipe_subjects_write ON public.ipe_subjects FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

CREATE POLICY ipe_chapters_read ON public.ipe_chapters FOR SELECT TO authenticated USING (true);
CREATE POLICY ipe_chapters_write ON public.ipe_chapters FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

CREATE POLICY ipe_questions_read ON public.ipe_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY ipe_questions_write ON public.ipe_questions FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

CREATE POLICY ipe_papers_read ON public.ipe_previous_papers FOR SELECT TO authenticated USING (true);
CREATE POLICY ipe_papers_write ON public.ipe_previous_papers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'super_admin'));

CREATE POLICY answer_sheet_images_owner ON public.attempt_answer_sheet_images FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.attempts a JOIN public.exams e ON e.id = a.exam_id
                 WHERE a.id = attempt_answer_sheet_images.attempt_id AND e.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.attempts a JOIN public.exams e ON e.id = a.exam_id
                 WHERE a.id = attempt_answer_sheet_images.attempt_id AND e.created_by = auth.uid()));