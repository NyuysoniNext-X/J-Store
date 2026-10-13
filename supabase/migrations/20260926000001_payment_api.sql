-- Automatic MTN MoMo / Orange Money payments.
--  1. payment_attempts: one row per "pay now" try (written only by the payments
--     Edge Function with the service role; buyers can read their own).
--  2. confirm_order_group_payment(): the ONE place a paid order group is
--     confirmed. Used by the Edge Function (service role) and by the admin
--     "Confirm" button (staff). Idempotent.
--  3. place_order(): new optional p_flow param. 'api' skips the manual
--     transaction-reference requirement and the admin-review row.
-- Adds objects only; changes no existing data.

create table if not exists public.payment_attempts (
  id                 uuid primary key default gen_random_uuid(),
  order_group_id     uuid not null references public.order_groups(id) on delete cascade,
  buyer_id           uuid not null references auth.users(id),
  provider           text not null check (provider in ('mtn', 'orange', 'mock')),
  amount             numeric(12,2) not null,
  currency           text not null,
  status             text not null default 'pending'
                     check (status in ('pending', 'successful', 'failed', 'expired')),
  provider_reference text not null unique,   -- MTN X-Reference-Id / Orange order_id
  pay_token          text,
  notif_token        text,
  payment_url        text,
  payer_phone        text,
  provider_txn_id    text,
  failure_reason     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists payment_attempts_group_idx on public.payment_attempts(order_group_id);
create index if not exists payment_attempts_notif_idx on public.payment_attempts(notif_token);

alter table public.payment_attempts enable row level security;

drop policy if exists "buyers read own payment attempts" on public.payment_attempts;
create policy "buyers read own payment attempts" on public.payment_attempts
  for select to authenticated
  using (buyer_id = auth.uid() or public.is_staff(auth.uid()));
-- No insert/update/delete policies on purpose: only the service role writes.

create or replace function public.confirm_order_group_payment(
  p_group uuid,
  p_provider_txn text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group record;
  v_actor uuid := auth.uid();
begin
  if auth.role() <> 'service_role' and not public.is_staff(v_actor) then
    raise exception 'not allowed';
  end if;

  select * into v_group from order_groups where id = p_group for update;
  if not found then
    raise exception 'order group not found';
  end if;

  -- Already confirmed: nothing to do (webhook + polling can both arrive).
  if v_group.payment_status in ('held_in_escrow', 'released') then
    return;
  end if;

  update order_groups set payment_status = 'held_in_escrow' where id = p_group;

  update orders set status = 'confirmed'
   where order_group_id = p_group and status = 'pending';

  update payment_verifications
     set status = 'confirmed', verified_by = v_actor, verified_at = now()
   where order_group_id = p_group and status = 'pending';

  insert into notifications (user_id, title, body)
  values (
    v_group.buyer_id,
    'Payment confirmed',
    'Your payment of ' || v_group.total::bigint || ' FCFA for order ' || v_group.group_number ||
    ' was received. Your order is now being processed.'
  );
end;
$$;

grant execute on function public.confirm_order_group_payment(uuid, text) to authenticated, service_role;

-- place_order v2 (new signature => drop the old 4-argument version first).
drop function if exists public.place_order(jsonb, jsonb, text, text);

create or replace function public.place_order(
  p_cart jsonb,
  p_shipping jsonb,
  p_payment_method text,
  p_transaction_ref text default null,
  p_flow text default 'manual'   -- 'manual' (buyer sends money + reference) | 'api' (MTN/Orange prompt)
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer uuid := auth.uid();
  v_group_id uuid;
  v_group_number text;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := coalesce((p_shipping->>'delivery_fee')::numeric, 0);
  v_total numeric;
  v_item jsonb;
  v_product record;
  v_variant record;
  v_order_id uuid;
  v_line_total numeric;
  v_orders_map jsonb := '{}'::jsonb; -- store_id (text) -> order_id (text)
  v_qty int;
begin
  if v_buyer is null then
    raise exception 'Not authenticated';
  end if;

  if p_cart is null or jsonb_array_length(p_cart) = 0 then
    raise exception 'Cart is empty';
  end if;

  if p_payment_method not in ('mtn_momo', 'orange_money') then
    raise exception 'Unsupported payment method: %', p_payment_method;
  end if;

  if p_flow not in ('manual', 'api') then
    raise exception 'Unsupported payment flow: %', p_flow;
  end if;

  if p_flow = 'manual' and coalesce(trim(p_transaction_ref), '') = '' then
    raise exception 'Transaction reference is required';
  end if;

  -- Pass 1: validate every line — product must be approved, and its default
  -- variant must have enough stock. Locks the variant rows so two concurrent
  -- checkouts can't both oversell the same last unit.
  for v_item in select * from jsonb_array_elements(p_cart)
  loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty < 1 then
      raise exception 'Invalid quantity for product %', (v_item->>'product_id');
    end if;

    select p.* into v_product
      from products p
      where p.id = (v_item->>'product_id')::uuid
        and p.status = 'approved';

    if not found then
      raise exception 'Product % is not available', (v_item->>'product_id');
    end if;

    select pv.* into v_variant
      from product_variants pv
      where pv.product_id = v_product.id
      order by pv.created_at asc
      limit 1
      for update;

    if not found then
      raise exception 'Product "%" has no stock record', v_product.title;
    end if;

    if v_variant.stock_quantity < v_qty then
      raise exception 'Not enough stock for "%" (have %, want %)',
        v_product.title, v_variant.stock_quantity, v_qty;
    end if;
  end loop;

  -- Pass 2: the order_group — one per checkout, one payment.
  v_group_number := 'JSG-' || to_char(now(), 'YYMMDDHH24MISS') || '-' ||
    upper(substr(md5(random()::text), 1, 4));

  insert into order_groups (
    group_number, buyer_id, shipping_recipient_name, shipping_phone,
    shipping_city, shipping_quarter, shipping_landmark,
    payment_method, payment_status, subtotal, delivery_fee_total, total
  ) values (
    v_group_number, v_buyer,
    p_shipping->>'recipient_name', p_shipping->>'phone',
    p_shipping->>'city', p_shipping->>'quarter', p_shipping->>'landmark',
    p_payment_method::payment_method, 'pending', 0, v_delivery_fee, 0
  ) returning id into v_group_id;

  -- Pass 3: one `orders` row per distinct store, `order_items` per line,
  -- snapshotting title/price from the DB (never from the client), and
  -- decrementing stock.
  for v_item in select * from jsonb_array_elements(p_cart)
  loop
    v_qty := (v_item->>'quantity')::int;

    select p.* into v_product from products p where p.id = (v_item->>'product_id')::uuid;
    select pv.* into v_variant
      from product_variants pv
      where pv.product_id = v_product.id
      order by pv.created_at asc
      limit 1;

    v_line_total := coalesce(v_variant.price_override, v_product.base_price) * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    v_order_id := nullif(v_orders_map ->> v_product.store_id::text, '')::uuid;
    if v_order_id is null then
      insert into orders (order_number, order_group_id, store_id, status, subtotal, delivery_fee, total)
      values (
        'JS-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || upper(substr(md5(random()::text), 1, 4)),
        v_group_id, v_product.store_id, 'pending', 0, 0, 0
      )
      returning id into v_order_id;
      v_orders_map := jsonb_set(v_orders_map, array[v_product.store_id::text], to_jsonb(v_order_id::text));
    end if;

    insert into order_items (order_id, product_id, product_title_snapshot, unit_price, quantity, line_total)
    values (
      v_order_id, v_product.id, v_product.title,
      coalesce(v_variant.price_override, v_product.base_price),
      v_qty, v_line_total
    );

    update product_variants
      set stock_quantity = stock_quantity - v_qty
      where id = v_variant.id;
  end loop;

  -- Pass 4: roll per-store order_items totals up onto each `orders` row.
  update orders o
    set subtotal = sub.total, total = sub.total
    from (
      select oi.order_id, sum(oi.line_total) as total
      from order_items oi
      where oi.order_id in (
        select (value)::text::uuid from jsonb_each_text(v_orders_map)
      )
      group by oi.order_id
    ) sub
    where o.id = sub.order_id;

  v_total := v_subtotal + v_delivery_fee;

  update order_groups
    set subtotal = v_subtotal, total = v_total
    where id = v_group_id;

  -- Manual flow only: queue for admin review. In the 'api' flow the payment
  -- is confirmed automatically by the payments Edge Function instead.
  if p_flow = 'manual' then
    insert into payment_verifications (order_group_id, buyer_id, amount, payment_method, transaction_ref, status)
    values (v_group_id, v_buyer, v_total, p_payment_method, trim(p_transaction_ref), 'pending');

    insert into notifications (user_id, title, body)
    values (
      v_buyer,
      'Order received — payment under review',
      'Order ' || v_group_number || ' is pending payment verification. We''ll confirm within 3 hours.'
    );
  end if;

  return jsonb_build_object(
    'order_group_id', v_group_id,
    'group_number', v_group_number,
    'total', v_total
  );
end;
$$;

grant execute on function public.place_order(jsonb, jsonb, text, text, text) to authenticated;

notify pgrst, 'reload schema';
