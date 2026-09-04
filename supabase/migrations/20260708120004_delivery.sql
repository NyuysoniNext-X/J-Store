-- ============================================================================
-- 0005_delivery.sql
-- Delivery personnel and per-order delivery assignments.
-- ============================================================================

create type public.delivery_status as enum (
  'unassigned', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed'
);

-- ----------------------------------------------------------------------------
-- Delivery personnel
-- ----------------------------------------------------------------------------
create table public.delivery_personnel (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  vehicle_type text,
  id_document_url text not null,
  is_approved boolean not null default false,
  is_online boolean not null default false,
  current_zone_id uuid references public.delivery_zones(id),
  rating numeric(3,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.delivery_personnel enable row level security;

create policy "Delivery personnel view and update their own profile"
  on public.delivery_personnel for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Delivery personnel update their own availability"
  on public.delivery_personnel for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can apply as delivery personnel"
  on public.delivery_personnel for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Staff manage all delivery personnel"
  on public.delivery_personnel for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

create trigger delivery_personnel_set_updated_at
  before update on public.delivery_personnel
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Deliveries — one per (per-seller) order.
-- ----------------------------------------------------------------------------
create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  delivery_personnel_id uuid references public.delivery_personnel(id),
  status public.delivery_status not null default 'unassigned',
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  proof_photo_url text,
  customer_signature_url text,
  delivery_fee numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deliveries enable row level security;

create index deliveries_delivery_personnel_id_idx on public.deliveries(delivery_personnel_id);

create policy "Assigned delivery personnel view their own deliveries"
  on public.deliveries for select
  to authenticated
  using (
    exists (
      select 1 from public.delivery_personnel d
      where d.id = delivery_personnel_id and d.user_id = auth.uid()
    )
  );

create policy "Assigned delivery personnel update their own deliveries"
  on public.deliveries for update
  to authenticated
  using (
    exists (
      select 1 from public.delivery_personnel d
      where d.id = delivery_personnel_id and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.delivery_personnel d
      where d.id = delivery_personnel_id and d.user_id = auth.uid()
    )
  );

create policy "Buyers view delivery status on their own orders"
  on public.deliveries for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.order_groups g on g.id = o.order_group_id
      where o.id = order_id and g.buyer_id = auth.uid()
    )
  );

create policy "Store owners view delivery status on their own orders"
  on public.deliveries for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.seller_stores s on s.id = o.store_id
      where o.id = order_id and s.owner_id = auth.uid()
    )
  );

create policy "Staff manage all deliveries"
  on public.deliveries for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

create trigger deliveries_set_updated_at
  before update on public.deliveries
  for each row execute function public.set_updated_at();
