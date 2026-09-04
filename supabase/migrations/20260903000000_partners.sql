-- Partner referrals and commission ledger.

alter type public.app_role add value if not exists 'partner';

alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references public.profiles(id),
  add column if not exists commission_rate numeric(6,5) not null default 0.05;

alter table public.profiles
  add constraint profiles_commission_rate_check
  check (commission_rate >= 0 and commission_rate <= 1);

create unique index if not exists profiles_referral_code_idx
  on public.profiles (lower(referral_code))
  where referral_code is not null;

create index if not exists profiles_referred_by_idx
  on public.profiles (referred_by);

create table public.partner_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  referred_user_id uuid references auth.users(id) on delete set null,
  commission_amount numeric(14,2) not null check (commission_amount >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'paid', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.partner_commissions enable row level security;

create index partner_commissions_partner_id_created_at_idx
  on public.partner_commissions (partner_id, created_at desc);

create policy "Partners view their own commissions"
  on public.partner_commissions for select
  to authenticated
  using (auth.uid() = partner_id);

create policy "Staff manage all partner commissions"
  on public.partner_commissions for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- Preserve the referral code passed in signup metadata when the profile is
-- created. Commission rows themselves are created by trusted server jobs.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referrer uuid;
begin
  select p.id into referrer
  from public.profiles p
  where p.referral_code is not null
    and lower(p.referral_code) = lower(new.raw_user_meta_data ->> 'ref')
  limit 1;

  insert into public.profiles (id, display_name, avatar_url, phone, referred_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'phone',
    referrer
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;
