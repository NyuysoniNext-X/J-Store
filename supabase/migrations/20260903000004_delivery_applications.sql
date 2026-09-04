-- Delivery applications referenced by the delivery application and admin pages.

create table if not exists public.delivery_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  applicant_type text not null default 'individual'
    check (applicant_type in ('individual', 'company')),
  full_name text not null,
  phone text not null,
  city text not null,
  vehicle_type text,
  company_name text,
  company_registration text,
  fleet_size integer check (fleet_size is null or fleet_size > 0),
  coverage_zones text[] default '{}',
  experience text,
  availability text,
  motivation text,
  id_url text,
  license_url text,
  company_document_url text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.delivery_applications enable row level security;

create index delivery_applications_user_id_idx
  on public.delivery_applications(user_id);

create index delivery_applications_created_at_idx
  on public.delivery_applications(created_at desc);

create policy "Applicants view their own delivery applications"
  on public.delivery_applications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users create their own delivery applications"
  on public.delivery_applications for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Staff manage delivery applications"
  on public.delivery_applications for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

drop trigger if exists delivery_applications_set_updated_at on public.delivery_applications;
create trigger delivery_applications_set_updated_at
  before update on public.delivery_applications
  for each row execute function public.set_updated_at();
