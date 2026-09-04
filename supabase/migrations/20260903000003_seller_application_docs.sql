-- Seller application fields and private document storage.

alter table public.seller_applications
  add column if not exists business_type text,
  add column if not exists owner_name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists city text,
  add column if not exists tax_id text;

insert into storage.buckets (id, name, public)
values ('seller-docs', 'seller-docs', false)
on conflict (id) do nothing;

create policy "Applicants upload their own seller docs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'seller-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Staff view seller docs"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'seller-docs' and public.is_staff(auth.uid()));

create policy "Applicants view their own seller docs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'seller-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Applicants delete their own seller docs"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'seller-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
