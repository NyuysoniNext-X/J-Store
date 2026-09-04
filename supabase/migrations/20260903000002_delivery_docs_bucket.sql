-- ============================================================================
-- 0011_delivery_docs_bucket.sql
-- Creates the "delivery-docs" storage bucket that delivery.apply.tsx
-- uploads to — it was referenced in code but never actually created,
-- hence the "Bucket not found" error.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('delivery-docs', 'delivery-docs', false)
    on conflict (id) do nothing;

-- Applicants upload under `${user.id}/...` (see uploadDoc() in
-- delivery.apply.tsx) — storage.foldername(name) splits the object path by
-- "/", so [1] is that leading user-id folder.
create policy "Users can upload their own delivery docs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'delivery-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can view their own delivery docs"
  on storage.objects for select
                                           to authenticated
                                           using (
                                           bucket_id = 'delivery-docs'
                                           and (storage.foldername(name))[1] = auth.uid()::text
                                           );

-- Staff need to review uploaded ID/licence docs to approve applications.
create policy "Staff can view all delivery docs"
  on storage.objects for select
                                    to authenticated
                                    using (
                                    bucket_id = 'delivery-docs'
                                    and public.is_staff(auth.uid())
                                    );
