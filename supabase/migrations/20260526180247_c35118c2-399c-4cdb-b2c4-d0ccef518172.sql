CREATE POLICY "Anyone can submit forms"
ON public.form_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.forms f
    WHERE f.id = form_submissions.form_id
      AND f.active = true
  )
);

GRANT INSERT ON public.form_submissions TO anon;