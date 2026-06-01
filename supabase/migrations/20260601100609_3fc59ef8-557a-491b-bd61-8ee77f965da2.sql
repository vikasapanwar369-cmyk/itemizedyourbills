
-- Make bucket private and restrict reads to owner folder
UPDATE storage.buckets SET public = false WHERE id = 'bill-images';
DROP POLICY IF EXISTS "bill images read" ON storage.objects;
CREATE POLICY "bill images own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bill-images' AND auth.uid()::text = (storage.foldername(name))[1]);
