-- place_order(): the "checkout edge function, service role" that
-- cart_and_orders.sql assumed would exist, implemented as a SECURITY
-- DEFINER function instead of an edge function. This is the ONLY sanctioned
-- way for a buyer to create orders/order_items — there is intentionally no
-- client-facing INSERT policy on either table (see 0004_cart_and_orders.sql),
-- so price and stock are always taken from the database, never trusted from
-- the client.
--
-- p_cart: [{ "product_id": "<uuid>", "quantity": 2 }, ...]
-- p_shipping: { "recipient_name", "phone", "city", "quarter"?, "landmark"?, "delivery_fee"? }
-- p_payment_method: 'mtn_momo' | 'orange_money'
-- p_transaction_ref: the MoMo transaction reference the buyer submits

create or replace function public.place_order(
  p_cart jsonb,
  p_shipping jsonb,
  p_payment_method text,
  p_transaction_ref text
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

  if coalesce(trim(p_transaction_ref), '') = '' then
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

  insert into payment_verifications (order_group_id, buyer_id, amount, payment_method, transaction_ref, status)
  values (v_group_id, v_buyer, v_total, p_payment_method, trim(p_transaction_ref), 'pending');

  insert into notifications (user_id, title, body)
  values (
    v_buyer,
    'Order received — payment under review',
    'Order ' || v_group_number || ' is pending payment verification. We''ll confirm within 3 hours.'
  );

  return jsonb_build_object(
    'order_group_id', v_group_id,
    'group_number', v_group_number,
    'total', v_total
  );
end;
$$;

grant execute on function public.place_order(jsonb, jsonb, text, text) to authenticated;
