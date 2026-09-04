-- ============================================================================
-- 0001_roles_and_profiles.sql
-- Core identity layer: roles, profiles, and shared helper functions/triggers.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Shared helper: updated_at trigger, reused by every table that has the column.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Roles
-- Five roles total. NEVER store role on profiles (privilege-escalation risk if
-- a user can update their own profile row) — always a separate table.
-- ----------------------------------------------------------------------------
create type public.app_role as enum ('customer', 'seller', 'admin', 'super_admin', 'delivery');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Security-definer checker — avoids RLS self-recursion when policies need to
-- check role membership.
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Convenience: true for admin OR super_admin (most "staff" policies want this).
create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(_user_id, 'admin') or public.has_role(_user_id, 'super_admin')
$$;

create policy "Users can view their own roles"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Staff can view all roles"
  on public.user_roles for select
  to authenticated
  using (public.is_staff(auth.uid()));

-- Only super_admins grant/revoke admin or super_admin roles; admins can manage
-- lower-privilege roles (seller/delivery/customer). Enforced via WITH CHECK.
create policy "Super admins can manage any role"
  on public.user_roles for all
  to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create policy "Admins can manage non-privileged roles"
  on public.user_roles for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin') and role in ('customer', 'seller', 'delivery'))
  with check (public.has_role(auth.uid(), 'admin') and role in ('customer', 'seller', 'delivery'));

-- ----------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  phone text,
  city text,
  country text not null default 'Cameroon',
  preferred_language text not null default 'en' check (preferred_language in ('en', 'fr')),
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Staff can view all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_staff(auth.uid()));

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Staff can update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile + default 'customer' role on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Addresses (buyers can have several; sellers reuse this for pickup addresses)
-- ----------------------------------------------------------------------------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Home',
  recipient_name text not null,
  phone text not null,
  city text not null,
  quarter text,
  landmark text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.addresses enable row level security;

create policy "Users manage their own addresses"
  on public.addresses for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Staff can view all addresses"
  on public.addresses for select
  to authenticated
  using (public.is_staff(auth.uid()));

create trigger addresses_set_updated_at
  before update on public.addresses
  for each row execute function public.set_updated_at();
