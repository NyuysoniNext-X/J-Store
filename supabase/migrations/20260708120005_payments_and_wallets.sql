-- ============================================================================
-- 0005_payments_and_wallets.sql
-- Payment transactions, escrow wallets, wallet ledger, payouts.
--
-- All writes to transactions/wallets/wallet_ledger happen via the service
-- role from payment-provider webhooks and escrow-release jobs — never
-- directly from the client — so these tables have no client INSERT/UPDATE
-- policies at all, only SELECT for the relevant owner plus staff.
-- ============================================================================

create type public.wallet_owner_type as enum ('seller', 'delivery', 'platform');
create type public.payout_status as enum ('pending', 'processing', 'paid', 'rejected');
create type public.ledger_entry_type as enum ('credit', 'debit', 'payout', 'refund', 'commission', 'delivery_fee');

-- ----------------------------------------------------------------------------
-- Transactions — one row per payment attempt against an order_group.
-- ----------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  order_group_id uuid not null references public.order_groups(id) on delete cascade,
  provider public.payment_method not null,
  provider_reference text,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'XAF',
  status public.payment_status not null default 'pending',
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

create index transactions_order_group_id_idx on public.transactions(order_group_id);
create unique index transactions_provider_reference_idx
  on public.transactions(provider, provider_reference)
  where provider_reference is not null;

create policy "Buyers view transactions on their own order groups"
  on public.transactions for select
  to authenticated
  using (
    exists (
      select 1 from public.order_groups g
      where g.id = order_group_id and g.buyer_id = auth.uid()
    )
  );

create policy "Staff view all transactions"
  on public.transactions for select
  to authenticated
  using (public.is_staff(auth.uid()));

create policy "Staff manage all transactions"
  on public.transactions for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Wallets — one per seller store, one per delivery person, one singleton for
-- the platform itself (owner_id null identifies the platform wallet).
-- ----------------------------------------------------------------------------
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  owner_type public.wallet_owner_type not null,
  owner_id uuid,
  balance numeric(14,2) not null default 0,
  currency text not null default 'XAF',
  updated_at timestamptz not null default now(),
  unique (owner_type, owner_id)
);

alter table public.wallets enable row level security;

-- Enforce exactly one platform wallet (owner_id is null only for 'platform').
create unique index wallets_platform_singleton_idx
  on public.wallets(owner_type)
  where owner_type = 'platform';

create policy "Sellers view their own store wallet"
  on public.wallets for select
  to authenticated
  using (
    owner_type = 'seller' and exists (
      select 1 from public.seller_stores s
      where s.id = owner_id and s.owner_id = auth.uid()
    )
  );

create policy "Delivery personnel view their own wallet"
  on public.wallets for select
  to authenticated
  using (
    owner_type = 'delivery' and exists (
      select 1 from public.delivery_personnel d
      where d.id = owner_id and d.user_id = auth.uid()
    )
  );

create policy "Staff view all wallets"
  on public.wallets for select
  to authenticated
  using (public.is_staff(auth.uid()));

create policy "Staff manage all wallets"
  on public.wallets for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ----------------------------------------------------------------------------
-- Wallet ledger — append-only history behind each wallet.balance change.
-- ----------------------------------------------------------------------------
create table public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  order_id uuid references public.orders(id),
  entry_type public.ledger_entry_type not null,
  amount numeric(14,2) not null,
  description text,
  created_at timestamptz not null default now()
);

alter table public.wallet_ledger enable row level security;

create index wallet_ledger_wallet_id_idx on public.wallet_ledger(wallet_id);

create policy "Sellers view their own store ledger"
  on public.wallet_ledger for select
  to authenticated
  using (
    exists (
      select 1 from public.wallets w
      join public.seller_stores s on s.id = w.owner_id and w.owner_type = 'seller'
      where w.id = wallet_id and s.owner_id = auth.uid()
    )
  );

create policy "Delivery personnel view their own ledger"
  on public.wallet_ledger for select
  to authenticated
  using (
    exists (
      select 1 from public.wallets w
      join public.delivery_personnel d on d.id = w.owner_id and w.owner_type = 'delivery'
      where w.id = wallet_id and d.user_id = auth.uid()
    )
  );

create policy "Staff view all ledger entries"
  on public.wallet_ledger for select
  to authenticated
  using (public.is_staff(auth.uid()));

create policy "Staff manage all ledger entries"
  on public.wallet_ledger for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ----------------------------------------------------------------------------
-- Payouts — withdrawal requests against a wallet.
-- ----------------------------------------------------------------------------
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id),
  amount numeric(14,2) not null check (amount > 0),
  mobile_money_number text not null,
  status public.payout_status not null default 'pending',
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references auth.users(id),
  rejection_reason text
);

alter table public.payouts enable row level security;

create index payouts_wallet_id_idx on public.payouts(wallet_id);

create policy "Sellers view and request payouts on their own wallet"
  on public.payouts for select
  to authenticated
  using (
    exists (
      select 1 from public.wallets w
      join public.seller_stores s on s.id = w.owner_id and w.owner_type = 'seller'
      where w.id = wallet_id and s.owner_id = auth.uid()
    )
  );

create policy "Sellers request payouts on their own wallet"
  on public.payouts for insert
  to authenticated
  with check (
    exists (
      select 1 from public.wallets w
      join public.seller_stores s on s.id = w.owner_id and w.owner_type = 'seller'
      where w.id = wallet_id and s.owner_id = auth.uid()
    )
  );

create policy "Delivery personnel view and request payouts on their own wallet"
  on public.payouts for select
  to authenticated
  using (
    exists (
      select 1 from public.wallets w
      join public.delivery_personnel d on d.id = w.owner_id and w.owner_type = 'delivery'
      where w.id = wallet_id and d.user_id = auth.uid()
    )
  );

create policy "Delivery personnel request payouts on their own wallet"
  on public.payouts for insert
  to authenticated
  with check (
    exists (
      select 1 from public.wallets w
      join public.delivery_personnel d on d.id = w.owner_id and w.owner_type = 'delivery'
      where w.id = wallet_id and d.user_id = auth.uid()
    )
  );

create policy "Staff manage all payouts"
  on public.payouts for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));
