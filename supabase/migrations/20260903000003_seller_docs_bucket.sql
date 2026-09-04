-- ============================================================================
-- 0012_seller_docs_bucket.sql
-- Creates the "seller-docs" storage bucket for seller application uploads
-- (ID document + optional business registration/license) — same
-- "referenced in code but never created" gap as delivery-docs.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('seller-docs', 'seller-docs', false)
on conflict (id) do nothing;

-- Applicants upload under `${user.id}/...`, same convention as delivery-docs.
create policy "Applicants can upload their own seller docs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'seller-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Applicants can view their own seller docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'seller-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Staff need to review ID/business docs to approve seller applications
-- (mirrors "Staff manage applications" on seller_applications itself).
create policy "Staff can view all seller docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'seller-docs'
    and public.is_staff(auth.uid())
  );
