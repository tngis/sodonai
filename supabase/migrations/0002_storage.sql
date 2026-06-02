-- ============================================================
-- aistudio.mn — storage buckets + policies
-- ============================================================

-- Buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('uploads', 'uploads', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('outputs', 'outputs', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- uploads: owner can insert and read own files
-- Path convention: {userId}/{orderId}/{index}.{ext}
drop policy if exists "uploads: owner insert"  on storage.objects;
drop policy if exists "uploads: owner select"  on storage.objects;
drop policy if exists "uploads: owner delete"  on storage.objects;
drop policy if exists "outputs: owner select"  on storage.objects;
drop policy if exists "outputs: service role insert" on storage.objects;

create policy "uploads: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "uploads: owner select"
  on storage.objects for select
  using (
    bucket_id = 'uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "uploads: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- outputs: owner can read own generated files
-- Path convention: {userId}/{generationId}/{index}.jpg
create policy "outputs: owner select"
  on storage.objects for select
  using (
    bucket_id = 'outputs'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Service role can write outputs (AI backend / server action)
create policy "outputs: service role insert"
  on storage.objects for insert
  with check (bucket_id = 'outputs');
