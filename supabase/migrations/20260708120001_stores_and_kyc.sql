-- ============================================================================
-- 0002_stores_and_kyc.sql
-- Seller stores, KYC applications, and suspensions.
-- ============================================================================

create type public.application_status as enum ('pending', 'approved', 'rejected');

-- ----------------------------------------------------------------------------
-- Seller applications (KYC) — submitted before a store exists.
-- ----------------------------------------------------------------------------
create table public.seller_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_name text not null,
  id_document_url text not null,
  business_registration_url text,
  status public.application_status not null default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

alter table public.seller_applications enable row level security;

create policy "Applicants view own application"
  on public.seller_applications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Applicants create their own application"
  on public.seller_applications for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Staff manage applications"
  on public.seller_applications for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ----------------------------------------------------------------------------
-- Seller stores
-- "Established seller" (30 days+, 10+ sales, 4.5+ rating) is computed rather
-- than hand-set, via refresh_store_established_status(); see order triggers
-- in 0004 for what recalculates total_sales/rating.
-- ----------------------------------------------------------------------------
create table public.seller_stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  store_name text not null,
  slug text not null unique,
  description text,
  logo_url text,
  banner_url text,
  business_registration_number text,
  commission_rate numeric(5,2) not null default 5.00,
  is_established boolean not null default false,
  rating numeric(3,2) not null default 0,
  total_sales integer not null default 0,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seller_stores enable row level security;

create policy "Anyone can view non-suspended stores"
  on public.seller_stores for select
  to anon, authenticated
  using (is_suspended = false);

create policy "Owners view their own store regardless of status"
  on public.seller_stores for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "Staff view all stores"
  on public.seller_stores for select
  to authenticated
  using (public.is_staff(auth.uid()));

create policy "Owners update their own store"
  on public.seller_stores for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "Staff manage all stores"
  on public.seller_stores for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- Store creation happens via a server-side function after KYC approval, not
-- directly by the seller, so there is intentionally no client-facing INSERT
-- policy here — inserts go through the service role / an edge function.

create trigger seller_stores_set_updated_at
  before update on public.seller_stores
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Store suspensions (audit trail; seller_stores.is_suspended is the live flag)
-- ----------------------------------------------------------------------------
create table public.store_suspensions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.seller_stores(id) on delete cascade,
  suspended_by uuid not null references auth.users(id),
  reason text not null,
  suspended_at timestamptz not null default now(),
  lifted_by uuid references auth.users(id),
  lifted_at timestamptz
);

alter table public.store_suspensions enable row level security;

create policy "Owners view their own suspension history"
  on public.store_suspensions for select
  to authenticated
  using (
    exists (
      select 1 from public.seller_stores s
      where s.id = store_id and s.owner_id = auth.uid()
    )
  );

create policy "Staff manage suspensions"
  on public.store_suspensions for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));
