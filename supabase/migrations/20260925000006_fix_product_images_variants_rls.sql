-- Fixes two live-database problems seen when a seller saves a product:
--
--  1. "new row violates row-level security policy for table product_images"
--     (HTTP 403). The ownership check in the original policies looks up
--     products + seller_stores from inside the policy, and those lookups are
--     themselves filtered by RLS, so any gap there silently fails the check.
--     Fix: ownership is resolved by a SECURITY DEFINER helper, AND the seller
--     page now saves image + stock through one function (save_product_media)
--     that does its own ownership check, so it works no matter what the table
--     policies look like on a drifted database.
--
--  2. The storefront query failed with PostgREST PGRST200: no foreign key
--     between products and seller_stores (and, defensively, categories) exists
--     on the live database. Without it the shop can't embed store/category
--     names and returns nothing. Fix: add the foreign keys if missing.
--
-- Safe to run more than once.

-- ── helper: does the caller own this product? ───────────────────────────────
create or replace function public.owns_product(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from products p
    join seller_stores s on s.id = p.store_id
    where p.id = p_product_id
      and s.owner_id = auth.uid()
  );
$$;

grant execute on function public.owns_product(uuid) to authenticated;

-- ── one call to save a product's image + stock ──────────────────────────────
create or replace function public.save_product_media(
  p_product_id uuid,
  p_image_url text default null,
  p_stock integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.owns_product(p_product_id) then
    raise exception 'Product not found or not yours';
  end if;

  if p_stock is not null and p_stock < 0 then
    raise exception 'Stock cannot be negative';
  end if;

  -- Single-image flow: a new upload replaces whatever was there.
  if p_image_url is not null and p_image_url <> '' then
    delete from product_images where product_id = p_product_id;
    insert into product_images (product_id, url, position)
    values (p_product_id, p_image_url, 0);
  end if;

  -- Stock lives on the product's default (first) variant.
  if p_stock is not null then
    update product_variants
       set stock_quantity = p_stock
     where id = (
       select id from product_variants
        where product_id = p_product_id
        order by created_at asc
        limit 1
     );

    if not found then
      insert into product_variants (product_id, name, value, stock_quantity)
      values (p_product_id, 'Default', 'Standard', p_stock);
    end if;
  end if;
end;
$$;

grant execute on function public.save_product_media(uuid, text, integer) to authenticated;

-- ── explicit per-operation policies (additive; old ones left untouched) ─────
drop policy if exists "owners select own product images" on public.product_images;
drop policy if exists "owners insert own product images" on public.product_images;
drop policy if exists "owners update own product images" on public.product_images;
drop policy if exists "owners delete own product images" on public.product_images;

create policy "owners select own product images" on public.product_images
  for select to authenticated using (public.owns_product(product_id));
create policy "owners insert own product images" on public.product_images
  for insert to authenticated with check (public.owns_product(product_id));
create policy "owners update own product images" on public.product_images
  for update to authenticated
  using (public.owns_product(product_id)) with check (public.owns_product(product_id));
create policy "owners delete own product images" on public.product_images
  for delete to authenticated using (public.owns_product(product_id));

drop policy if exists "owners select own product variants" on public.product_variants;
drop policy if exists "owners insert own product variants" on public.product_variants;
drop policy if exists "owners update own product variants" on public.product_variants;
drop policy if exists "owners delete own product variants" on public.product_variants;

create policy "owners select own product variants" on public.product_variants
  for select to authenticated using (public.owns_product(product_id));
create policy "owners insert own product variants" on public.product_variants
  for insert to authenticated with check (public.owns_product(product_id));
create policy "owners update own product variants" on public.product_variants
  for update to authenticated
  using (public.owns_product(product_id)) with check (public.owns_product(product_id));
create policy "owners delete own product variants" on public.product_variants
  for delete to authenticated using (public.owns_product(product_id));

-- ── missing foreign keys (needed for PostgREST embeds in the shop query) ────
-- NOT VALID: adds the link without scanning/rejecting any existing rows, so
-- it can't fail on old data. New and updated rows are still checked.
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.products'::regclass
      and c.contype = 'f'
      and c.confrelid = 'public.seller_stores'::regclass
  ) then
    alter table public.products
      add constraint products_store_id_fkey
      foreign key (store_id) references public.seller_stores(id) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.products'::regclass
      and c.contype = 'f'
      and c.confrelid = 'public.categories'::regclass
  ) then
    alter table public.products
      add constraint products_category_id_fkey
      foreign key (category_id) references public.categories(id) not valid;
  end if;
end $$;

-- Make PostgREST pick up the new functions / foreign keys immediately.
notify pgrst, 'reload schema';
