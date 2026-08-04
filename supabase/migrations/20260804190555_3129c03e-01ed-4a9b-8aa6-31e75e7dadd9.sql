ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS attachment_path text;

CREATE POLICY "own folder upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'submission-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own folder read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'submission-attachments' AND ((storage.foldername(name))[1] = auth.uid()::text OR private.has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "own folder update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'submission-attachments' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'submission-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);