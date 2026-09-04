-- ============================================================================
-- 0004_cart_and_orders.sql
-- Delivery zones, cart, and the checkout/order structure.
--
-- Checkout produces ONE order_group (one payment, one buyer, one shipping
-- address) which fans out into one "orders" row PER SELLER STORE in the
-- cart (needed because escrow release, fulfillment status, and delivery all
-- happen independently per seller). order_items are the line items within
-- each per-seller order.
-- ============================================================================

create type public.order_status as enum (
  'pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery',
  'delivered', 'completed', 'cancelled', 'disputed', 'refunded'
);

create type public.payment_method as enum ('mtn_momo', 'orange_money', 'card', 'cod');

create type public.payment_status as enum (
  'pending', 'processing', 'held_in_escrow', 'released', 'refunded', 'failed'
);

-- ----------------------------------------------------------------------------
-- Delivery zones (Phase 1: Douala, Yaoundé, Buea)
-- ----------------------------------------------------------------------------
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  zone_name text not null,
  fee numeric(12,2) not null check (fee >= 0),
  estimated_time text not null,
  is_platform_managed boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (city, zone_name)
);

alter table public.delivery_zones enable row level security;

create policy "Anyone can view active delivery zones"
  on public.delivery_zones for select
  to anon, authenticated
  using (is_active = true);

create policy "Staff manage delivery zones"
  on public.delivery_zones for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ----------------------------------------------------------------------------
-- Cart items
-- Guest checkout keeps the cart client-side only (no DB row) and is submitted
-- directly at checkout time, so this table is for signed-in users only —
-- keeps RLS simple and avoids anonymous-write abuse.
-- ----------------------------------------------------------------------------
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id, variant_id)
);

alter table public.cart_items enable row level security;

create policy "Users manage their own cart"
  on public.cart_items for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger cart_items_set_updated_at
  before update on public.cart_items
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Order groups (one per checkout/payment)
-- ----------------------------------------------------------------------------
create table public.order_groups (
  id uuid primary key default gen_random_uuid(),
  group_number text not null unique,
  buyer_id uuid references auth.users(id),
  guest_email text,
  guest_phone text,
  shipping_address_id uuid references public.addresses(id),
  -- Snapshot of the shipping address at time of order, so it survives the
  -- buyer later editing/deleting the address, and covers guest checkout
  -- (which has no addresses row at all).
  shipping_recipient_name text not null,
  shipping_phone text not null,
  shipping_city text not null,
  shipping_quarter text,
  shipping_landmark text,
  payment_method public.payment_method not null,
  payment_status public.payment_status not null default 'pending',
  coupon_id uuid references public.coupons(id),
  discount_amount numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  delivery_fee_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  currency text not null default 'XAF',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (buyer_id is not null or guest_email is not null)
);

alter table public.order_groups enable row level security;

create index order_groups_buyer_id_idx on public.order_groups(buyer_id);

create policy "Buyers view their own order groups"
  on public.order_groups for select
  to authenticated
  using (auth.uid() = buyer_id);

create policy "Staff view all order groups"
  on public.order_groups for select
  to authenticated
  using (public.is_staff(auth.uid()));

create policy "Buyers create their own order groups"
  on public.order_groups for insert
  to authenticated
  with check (auth.uid() = buyer_id);

create policy "Staff manage all order groups"
  on public.order_groups for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

create trigger order_groups_set_updated_at
  before update on public.order_groups
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Orders (per-seller sub-order within an order_group)
-- ----------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  order_group_id uuid not null references public.order_groups(id) on delete cascade,
  store_id uuid not null references public.seller_stores(id),
  delivery_zone_id uuid references public.delivery_zones(id),
  status public.order_status not null default 'pending',
  subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  deposit_amount numeric(12,2),
  total numeric(12,2) not null default 0,
  shipped_at timestamptz,
  delivered_at timestamptz,
  buyer_confirmed_at timestamptz,
  escrow_release_due_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create index orders_order_group_id_idx on public.orders(order_group_id);
create index orders_store_id_idx on public.orders(store_id);
create index orders_status_idx on public.orders(status);

create policy "Buyers view orders in their own order group"
  on public.orders for select
  to authenticated
  using (
    exists (
      select 1 from public.order_groups g
      where g.id = order_group_id and g.buyer_id = auth.uid()
    )
  );

create policy "Store owners view their own orders"
  on public.orders for select
  to authenticated
  using (
    exists (
      select 1 from public.seller_stores s
      where s.id = store_id and s.owner_id = auth.uid()
    )
  );

create policy "Staff view all orders"
  on public.orders for select
  to authenticated
  using (public.is_staff(auth.uid()));

create policy "Store owners update fulfillment on their own orders"
  on public.orders for update
  to authenticated
  using (
    exists (
      select 1 from public.seller_stores s
      where s.id = store_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.seller_stores s
      where s.id = store_id and s.owner_id = auth.uid()
    )
  );

create policy "Buyers can confirm receipt on their own orders"
  on public.orders for update
  to authenticated
  using (
    exists (
      select 1 from public.order_groups g
      where g.id = order_group_id and g.buyer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.order_groups g
      where g.id = order_group_id and g.buyer_id = auth.uid()
    )
  );

create policy "Staff manage all orders"
  on public.orders for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Order items — line-item snapshot so later price/title edits on the product
-- never change historical order data.
-- ----------------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_title_snapshot text not null,
  variant_snapshot text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

alter table public.order_items enable row level security;

create index order_items_order_id_idx on public.order_items(order_id);

create policy "Buyers view their own order items"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.order_groups g on g.id = o.order_group_id
      where o.id = order_id and g.buyer_id = auth.uid()
    )
  );

create policy "Store owners view items in their own orders"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      join public.seller_stores s on s.id = o.store_id
      where o.id = order_id and s.owner_id = auth.uid()
    )
  );

create policy "Staff view all order items"
  on public.order_items for select
  to authenticated
  using (public.is_staff(auth.uid()));

create policy "Staff manage all order items"
  on public.order_items for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- Order item inserts otherwise happen server-side (checkout edge function,
-- service role) so stock/price can be validated atomically against the cart.
