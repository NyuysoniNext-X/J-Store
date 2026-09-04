-- ============================================================================
-- 0003_catalog.sql
-- Categories, products, variants, images, wishlists, and coupons.
-- ============================================================================

create type public.product_status as enum (
  'draft', 'pending_approval', 'approved', 'rejected', 'flagged', 'archived'
);

-- ----------------------------------------------------------------------------
-- Categories (self-referencing for subcategories)
-- ----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.categories(id) on delete set null,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy "Anyone can view categories"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "Staff manage categories"
  on public.categories for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ----------------------------------------------------------------------------
-- Products
-- fraud_score / is_flagged feed the moderation queue (auto-flag at score >70,
-- per platform_settings — enforced in an edge function, not here).
-- ----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.seller_stores(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text not null,
  description text,
  base_price numeric(12,2) not null check (base_price >= 0),
  currency text not null default 'XAF',
  status public.product_status not null default 'draft',
  fraud_score smallint not null default 0 check (fraud_score between 0 and 100),
  is_flagged boolean not null default false,
  views_count integer not null default 0,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

alter table public.products enable row level security;

create index products_store_id_idx on public.products(store_id);
create index products_category_id_idx on public.products(category_id);
create index products_status_idx on public.products(status);

create policy "Anyone can view approved products"
  on public.products for select
  to anon, authenticated
  using (status = 'approved');

create policy "Store owners view their own products regardless of status"
  on public.products for select
  to authenticated
  using (
    exists (
      select 1 from public.seller_stores s
      where s.id = store_id and s.owner_id = auth.uid()
    )
  );

create policy "Staff view all products"
  on public.products for select
  to authenticated
  using (public.is_staff(auth.uid()));

create policy "Store owners manage their own products"
  on public.products for all
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

create policy "Staff manage all products"
  on public.products for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Product variants (size/color/weight) — stock lives here, not on products,
-- since a product with no variants still needs a saleable unit. Every product
-- gets at least one "default" variant row created by the application.
-- ----------------------------------------------------------------------------
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null default 'Default',
  value text not null default 'Standard',
  price_override numeric(12,2) check (price_override >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  sku text,
  created_at timestamptz not null default now()
);

alter table public.product_variants enable row level security;

create index product_variants_product_id_idx on public.product_variants(product_id);

create policy "Anyone can view variants of approved products"
  on public.product_variants for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'approved'
    )
  );

create policy "Store owners manage variants of their own products"
  on public.product_variants for all
  to authenticated
  using (
    exists (
      select 1 from public.products p
      join public.seller_stores s on s.id = p.store_id
      where p.id = product_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.products p
      join public.seller_stores s on s.id = p.store_id
      where p.id = product_id and s.owner_id = auth.uid()
    )
  );

create policy "Staff manage all variants"
  on public.product_variants for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ----------------------------------------------------------------------------
-- Product images
-- ----------------------------------------------------------------------------
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.product_images enable row level security;

create index product_images_product_id_idx on public.product_images(product_id);

create policy "Anyone can view images of approved products"
  on public.product_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'approved'
    )
  );

create policy "Store owners manage images of their own products"
  on public.product_images for all
  to authenticated
  using (
    exists (
      select 1 from public.products p
      join public.seller_stores s on s.id = p.store_id
      where p.id = product_id and s.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.products p
      join public.seller_stores s on s.id = p.store_id
      where p.id = product_id and s.owner_id = auth.uid()
    )
  );

create policy "Staff manage all images"
  on public.product_images for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ----------------------------------------------------------------------------
-- Wishlists
-- ----------------------------------------------------------------------------
create table public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

alter table public.wishlists enable row level security;

create policy "Users manage their own wishlist"
  on public.wishlists for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Coupons (platform-wide or store-specific)
-- ----------------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  store_id uuid references public.seller_stores(id) on delete cascade,
  description text,
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(12,2) not null check (discount_value > 0),
  min_order_amount numeric(12,2) not null default 0,
  max_uses integer,
  uses_count integer not null default 0,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.coupons enable row level security;

create policy "Anyone can view active coupons"
  on public.coupons for select
  to anon, authenticated
  using (is_active = true and (valid_until is null or valid_until > now()));

create policy "Store owners manage their own coupons"
  on public.coupons for all
  to authenticated
  using (
    store_id is not null and exists (
      select 1 from public.seller_stores s
      where s.id = store_id and s.owner_id = auth.uid()
    )
  )
  with check (
    store_id is not null and exists (
      select 1 from public.seller_stores s
      where s.id = store_id and s.owner_id = auth.uid()
    )
  );

create policy "Staff manage all coupons"
  on public.coupons for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));
