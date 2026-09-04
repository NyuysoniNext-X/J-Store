-- ============================================================================
-- 0010_partner_referrals.sql
-- Referral attribution + commission tracking for business/affiliate partners.
-- ============================================================================

-- A partner's own shareable referral code, who referred a given user (if
-- anyone) at signup, and that partner's commission rate. These live on
-- profiles rather than a join table: each user has at most one referral
-- code and was referred by at most one partner — a 1:1 relationship.
alter table public.profiles
    add column referral_code text unique,
  add column referred_by uuid references auth.users(id),
  add column commission_rate numeric(4,3) not null default 0.050; -- 5% default, per-partner override

create index profiles_referred_by_idx on public.profiles(referred_by);

-- Guard: the existing "Users can update their own profile" policy lets any
-- user update any column on their own row, including these two — which
-- would let a partner set their own commission rate. Block that at the
-- trigger level rather than relying on app-layer discipline (same
-- privilege-escalation concern the roles table comment already calls out).
create or replace function public.prevent_partner_field_tampering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff(auth.uid())
     and (new.referral_code is distinct from old.referral_code
          or new.commission_rate is distinct from old.commission_rate) then
    raise exception 'Only staff can set referral_code or commission_rate';
end if;
return new;
end;
$$;

create trigger profiles_prevent_partner_tampering
    before update on public.profiles
    for each row execute function public.prevent_partner_field_tampering();

-- ----------------------------------------------------------------------------
-- Capture referral attribution at signup from raw_user_meta_data ->> 'ref'.
-- Replaces the existing handle_new_user() body — the trigger itself
-- (on_auth_user_created) already points at this function, so no need to
-- recreate it.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
_referrer_id uuid;
begin
  if new.raw_user_meta_data ->> 'ref' is not null then
select id into _referrer_id
from public.profiles
where referral_code = new.raw_user_meta_data ->> 'ref';
end if;

insert into public.profiles (id, display_name, avatar_url, phone, referred_by)
values (
           new.id,
           coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
           new.raw_user_meta_data ->> 'avatar_url',
           new.raw_user_meta_data ->> 'phone',
           _referrer_id
       )
    on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
values (new.id, 'customer')
    on conflict (user_id, role) do nothing;

return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Commission ledger — one row per completed order attributable to a partner.
-- ----------------------------------------------------------------------------
create table public.partner_commissions (
                                            id uuid primary key default gen_random_uuid(),
                                            partner_id uuid not null references auth.users(id),
                                            referred_user_id uuid not null references auth.users(id),
                                            order_id uuid not null references public.orders(id) on delete cascade,
                                            commission_amount numeric(12,2) not null,
                                            status text not null default 'pending' check (status in ('pending', 'confirmed', 'paid')),
                                            created_at timestamptz not null default now(),
                                            unique (order_id) -- one commission row per order
);

alter table public.partner_commissions enable row level security;

create index partner_commissions_partner_id_idx on public.partner_commissions(partner_id);

create policy "Partners view their own commissions"
  on public.partner_commissions for select
                                               to authenticated
                                               using (auth.uid() = partner_id);

create policy "Staff manage all commissions"
  on public.partner_commissions for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- Auto-create a commission row when an order reaches 'completed' (not
-- 'delivered' — completed is the post-escrow, settled state, so a dispute
-- or refund before then never generates a payable commission).
create or replace function public.handle_order_completed_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
_buyer_id uuid;
  _referrer_id uuid;
  _rate numeric;
begin
  if new.status != 'completed' or old.status = 'completed' then
    return new;
end if;

select og.buyer_id into _buyer_id
from public.order_groups og
where og.id = new.order_group_id;

if _buyer_id is null then
    return new; -- guest checkout — no account, so no referral possible
end if;

select referred_by, commission_rate into _referrer_id, _rate
from public.profiles
where id = _buyer_id;

if _referrer_id is not null then
    insert into public.partner_commissions (partner_id, referred_user_id, order_id, commission_amount)
    values (_referrer_id, _buyer_id, new.id, round(new.total * _rate, 2))
    on conflict (order_id) do nothing;
end if;

return new;
end;
$$;

create trigger on_order_completed_commission
    after update on public.orders
    for each row execute function public.handle_order_completed_commission();
