-- ============================================================================
-- 0007_disputes_reviews_fraud.sql
-- Disputes, product reviews, fraud reports.
-- ============================================================================

create type public.dispute_status as enum (
  'open', 'under_review', 'resolved_buyer', 'resolved_seller', 'closed'
);

-- ----------------------------------------------------------------------------
-- Disputes
-- ----------------------------------------------------------------------------
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  raised_by uuid not null references auth.users(id),
  reason text not null,
  status public.dispute_status not null default 'open',
  resolution_notes text,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.disputes enable row level security;

create index disputes_order_id_idx on public.disputes(order_id);

create policy "Buyers view disputes on their own orders"
  on public.disputes for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.order_groups g on g.id = o.order_group_id
      where o.id = order_id and g.buyer_id = auth.uid()
    )
  );

create policy "Buyers raise disputes on their own orders"
  on public.disputes for insert
  to authenticated
  with check (
    auth.uid() = raised_by
    and exists (
      select 1 from public.orders o
      join public.order_groups g on g.id = o.order_group_id
      where o.id = order_id and g.buyer_id = auth.uid()
    )
  );

create policy "Store owners view disputes on their own orders"
  on public.disputes for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.seller_stores s on s.id = o.store_id
      where o.id = order_id and s.owner_id = auth.uid()
    )
  );

create policy "Store owners raise disputes on their own orders"
  on public.disputes for insert
  to authenticated
  with check (
    auth.uid() = raised_by
    and exists (
      select 1 from public.orders o
      join public.seller_stores s on s.id = o.store_id
      where o.id = order_id and s.owner_id = auth.uid()
    )
  );

create policy "Staff manage all disputes"
  on public.disputes for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

create trigger disputes_set_updated_at
  before update on public.disputes
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Reviews — one per order_item, only after purchase.
-- ----------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  product_id uuid not null references public.products(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

create index reviews_product_id_idx on public.reviews(product_id);

create policy "Anyone can view reviews"
  on public.reviews for select
  to anon, authenticated
  using (true);

create policy "Buyers review their own purchased items"
  on public.reviews for insert
  to authenticated
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      join public.order_groups g on g.id = o.order_group_id
      where oi.id = order_item_id
        and g.buyer_id = auth.uid()
        and o.status = 'completed'
    )
  );

create policy "Reviewers update or delete their own review"
  on public.reviews for update
  to authenticated
  using (auth.uid() = reviewer_id)
  with check (auth.uid() = reviewer_id);

create policy "Reviewers delete their own review"
  on public.reviews for delete
  to authenticated
  using (auth.uid() = reviewer_id);

create policy "Staff manage all reviews"
  on public.reviews for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ----------------------------------------------------------------------------
-- Fraud reports — sellers reporting suspicious buyers, or staff-initiated.
-- ----------------------------------------------------------------------------
create table public.fraud_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id),
  reported_user_id uuid references auth.users(id),
  order_id uuid references public.orders(id),
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'confirmed', 'dismissed')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.fraud_reports enable row level security;

create policy "Reporters view their own fraud reports"
  on public.fraud_reports for select
  to authenticated
  using (auth.uid() = reporter_id);

create policy "Users can file fraud reports"
  on public.fraud_reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

create policy "Staff manage all fraud reports"
  on public.fraud_reports for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));
