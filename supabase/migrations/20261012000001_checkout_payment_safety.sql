-- Keep delivery totals server-owned and release inventory when manual payments
-- are rejected or an instant-payment order expires.

create or replace function public.checkout_delivery_fee(
  p_city text,
  p_zone text,
  p_subtotal numeric
)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_fee numeric;
begin
  v_fee := case
    when p_city = 'Douala' and p_zone = 'Centre (Akwa, Bonanjo, Deido)' then 1000
    when p_city = 'Douala' and p_zone = 'Extended (Makepe, Bepanda, Bonaberi)' then 1500
    when p_city = 'Yaoundé' and p_zone = 'Centre (Bastos, Mvog-Mbi)' then 1500
    when p_city = 'Yaoundé' and p_zone = 'Extended (Obili, Efoulan)' then 2000
    when p_city = 'Buea' and p_zone = 'City centre' then 1500
    when p_city = 'Other' and p_zone = 'Seller-managed delivery' then 0
    else null
  end;

  if v_fee is null then
    raise exception 'Unsupported delivery city or zone';
  end if;

  if p_city <> 'Other' and p_subtotal >= 50000 then
    return 0;
  end if;

  return v_fee;
end;
$$;

-- Older versions of place_order omitted variant_id. They always used the
-- oldest variant, so backfill that same variant for stock recovery.
update public.order_items oi
set variant_id = (
  select pv.id
  from public.product_variants pv
  where pv.product_id = oi.product_id
  order by pv.created_at asc
  limit 1
)
where oi.variant_id is null
  and oi.product_id is not null;

create or replace function public.set_order_item_default_variant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.variant_id is null and new.product_id is not null then
    select pv.id into new.variant_id
    from public.product_variants pv
    where pv.product_id = new.product_id
    order by pv.created_at asc
    limit 1;
  end if;
  return new;
end;
$$;

-- Rebuild checkout creation around server-calculated shipping and lock each
-- selected stock row through reservation. Client-supplied delivery_fee is ignored.
drop function if exists public.place_order(jsonb, jsonb, text, text);

create or replace function public.place_order(
  p_cart jsonb,
  p_shipping jsonb,
  p_payment_method text,
  p_transaction_ref text default null,
  p_flow text default 'manual'
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
  v_delivery_fee numeric;
  v_total numeric;
  v_item jsonb;
  v_product record;
  v_variant record;
  v_order_id uuid;
  v_line_total numeric;
  v_orders_map jsonb := '{}'::jsonb;
  v_qty integer;
begin
  if v_buyer is null then
    raise exception 'Not authenticated';
  end if;
  if p_cart is null or jsonb_typeof(p_cart) <> 'array' or jsonb_array_length(p_cart) = 0 then
    raise exception 'Cart is empty';
  end if;
  if p_payment_method is null or p_payment_method not in ('mtn_momo', 'orange_money') then
    raise exception 'Unsupported payment method: %', p_payment_method;
  end if;
  if p_flow is null or p_flow not in ('manual', 'api') then
    raise exception 'Unsupported payment flow: %', p_flow;
  end if;
  if p_flow = 'manual' and coalesce(trim(p_transaction_ref), '') = '' then
    raise exception 'Transaction reference is required';
  end if;
  if coalesce(trim(p_shipping->>'recipient_name'), '') = ''
    or coalesce(trim(p_shipping->>'phone'), '') = ''
    or coalesce(trim(p_shipping->>'landmark'), '') = '' then
    raise exception 'Complete the recipient and delivery address';
  end if;

  for v_item in select * from jsonb_array_elements(p_cart)
  loop
    v_qty := (v_item->>'quantity')::integer;
    if v_qty is null or v_qty < 1 then
      raise exception 'Invalid quantity for product %', v_item->>'product_id';
    end if;

    select p.* into v_product
    from public.products p
    where p.id = (v_item->>'product_id')::uuid
      and p.status = 'approved';
    if not found then
      raise exception 'Product % is not available', v_item->>'product_id';
    end if;

    select pv.* into v_variant
    from public.product_variants pv
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

  select sum(
    coalesce(pv.price_override, p.base_price) * (cart_item->>'quantity')::integer
  )
  into v_subtotal
  from jsonb_array_elements(p_cart) cart_item
  join public.products p on p.id = (cart_item->>'product_id')::uuid
  join lateral (
    select variant.price_override
    from public.product_variants variant
    where variant.product_id = p.id
    order by variant.created_at asc
    limit 1
  ) pv on true;

  v_delivery_fee := public.checkout_delivery_fee(
    p_shipping->>'city',
    p_shipping->>'quarter',
    v_subtotal
  );
  v_total := v_subtotal + v_delivery_fee;
  v_group_number := 'JSG-' || to_char(now(), 'YYMMDDHH24MISS') || '-' ||
    upper(substr(md5(random()::text), 1, 4));

  insert into public.order_groups (
    group_number, buyer_id, shipping_recipient_name, shipping_phone,
    shipping_city, shipping_quarter, shipping_landmark, payment_method,
    payment_status, subtotal, delivery_fee_total, total
  ) values (
    v_group_number, v_buyer,
    trim(p_shipping->>'recipient_name'), trim(p_shipping->>'phone'),
    p_shipping->>'city', p_shipping->>'quarter', trim(p_shipping->>'landmark'),
    p_payment_method::public.payment_method, 'pending',
    v_subtotal, v_delivery_fee, v_total
  ) returning id into v_group_id;

  for v_item in select * from jsonb_array_elements(p_cart)
  loop
    v_qty := (v_item->>'quantity')::integer;
    select p.* into v_product
    from public.products p
    where p.id = (v_item->>'product_id')::uuid;

    select pv.* into v_variant
    from public.product_variants pv
    where pv.product_id = v_product.id
    order by pv.created_at asc
    limit 1
    for update;

    v_line_total := coalesce(v_variant.price_override, v_product.base_price) * v_qty;
    v_order_id := nullif(v_orders_map->>v_product.store_id::text, '')::uuid;
    if v_order_id is null then
      insert into public.orders (
        order_number, order_group_id, store_id, status, subtotal, delivery_fee, total
      ) values (
        'JS-' || to_char(now(), 'YYMMDDHH24MISS') || '-' ||
        upper(substr(md5(random()::text), 1, 4)),
        v_group_id, v_product.store_id, 'pending', 0, 0, 0
      ) returning id into v_order_id;
      v_orders_map := jsonb_set(
        v_orders_map,
        array[v_product.store_id::text],
        to_jsonb(v_order_id::text)
      );
    end if;

    insert into public.order_items (
      order_id, product_id, variant_id, product_title_snapshot,
      unit_price, quantity, line_total
    ) values (
      v_order_id, v_product.id, v_variant.id, v_product.title,
      coalesce(v_variant.price_override, v_product.base_price), v_qty, v_line_total
    );

    update public.product_variants
    set stock_quantity = stock_quantity - v_qty
    where id = v_variant.id;
  end loop;

  update public.orders o
  set subtotal = sub.total, total = sub.total
  from (
    select oi.order_id, sum(oi.line_total) as total
    from public.order_items oi
    where oi.order_id in (
      select value::text::uuid from jsonb_each_text(v_orders_map)
    )
    group by oi.order_id
  ) sub
  where o.id = sub.order_id;

  if p_flow = 'manual' then
    insert into public.payment_verifications (
      order_group_id, buyer_id, amount, payment_method, transaction_ref, status
    ) values (
      v_group_id, v_buyer, v_total, p_payment_method,
      trim(p_transaction_ref), 'pending'
    );

    insert into public.notifications (user_id, title, body)
    values (
      v_buyer,
      'Order received — payment under review',
      'Order ' || v_group_number ||
      ' is pending payment verification. We''ll confirm within 3 hours.'
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

drop trigger if exists order_items_default_variant on public.order_items;
create trigger order_items_default_variant
  before insert on public.order_items
  for each row execute function public.set_order_item_default_variant();

create or replace function public.restore_order_group_inventory(p_group uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_restored integer := 0;
begin
  for v_item in
    select oi.variant_id, sum(oi.quantity)::integer as quantity
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.order_group_id = p_group
      and oi.variant_id is not null
    group by oi.variant_id
  loop
    update public.product_variants
    set stock_quantity = stock_quantity + v_item.quantity
    where id = v_item.variant_id;

    if found then
      v_restored := v_restored + v_item.quantity;
    end if;
  end loop;

  return v_restored;
end;
$$;

revoke all on function public.restore_order_group_inventory(uuid) from public, anon, authenticated;

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
  v_group public.order_groups%rowtype;
  v_actor uuid := auth.uid();
begin
  if auth.role() <> 'service_role' and not public.is_staff(v_actor) then
    raise exception 'not allowed';
  end if;

  select * into v_group
  from public.order_groups
  where id = p_group
  for update;
  if not found then
    raise exception 'order group not found';
  end if;

  if v_group.payment_status in ('held_in_escrow', 'released') then
    return;
  end if;
  if v_group.payment_status <> 'pending' then
    raise exception 'order group is no longer awaiting payment';
  end if;

  update public.order_groups
  set payment_status = 'held_in_escrow'
  where id = p_group;

  update public.orders
  set status = 'confirmed'
  where order_group_id = p_group
    and status = 'pending';

  update public.payment_verifications
  set status = 'confirmed',
      verified_by = v_actor,
      verified_at = now()
  where order_group_id = p_group
    and status = 'pending';

  insert into public.notifications (user_id, title, body)
  values (
    v_group.buyer_id,
    'Payment confirmed',
    'Your payment of ' || v_group.total::bigint || ' FCFA for order ' ||
    v_group.group_number || ' was received. Your order is now being processed.'
  );
end;
$$;

revoke all on function public.confirm_order_group_payment(uuid, text) from public, anon;
grant execute on function public.confirm_order_group_payment(uuid, text) to authenticated, service_role;

create or replace function public.reject_manual_payment(
  p_verification uuid,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_verification public.payment_verifications%rowtype;
  v_payment_status public.payment_status;
begin
  if v_actor is null or not public.is_staff(v_actor) then
    raise exception 'not allowed';
  end if;

  select * into v_verification
  from public.payment_verifications
  where id = p_verification
  for update;

  if not found or v_verification.order_group_id is null then
    raise exception 'manual payment verification not found';
  end if;
  if v_verification.status <> 'pending' then
    raise exception 'payment verification is no longer pending';
  end if;

  select payment_status into v_payment_status
  from public.order_groups
  where id = v_verification.order_group_id
  for update;

  if v_payment_status is distinct from 'pending' then
    raise exception 'order is no longer awaiting payment';
  end if;

  update public.payment_verifications
  set status = 'rejected',
      reject_reason = nullif(trim(p_reason), ''),
      verified_by = v_actor,
      verified_at = now()
  where id = v_verification.id;

  update public.order_groups
  set payment_status = 'failed'
  where id = v_verification.order_group_id;

  update public.orders
  set status = 'cancelled',
      cancelled_reason = coalesce(nullif(trim(p_reason), ''), 'Manual payment was not verified')
  where order_group_id = v_verification.order_group_id
    and status = 'pending';

  perform public.restore_order_group_inventory(v_verification.order_group_id);

  insert into public.notifications (user_id, title, body)
   values (
    v_verification.buyer_id,
    'Payment reference not verified',
    case
      when nullif(trim(p_reason), '') is not null
        then 'We could not verify your transaction: ' || trim(p_reason) ||
             '. The order was cancelled and reserved stock was released. Please contact support.'
      else 'We could not verify your payment reference. The order was cancelled and reserved stock was released. Please contact support.'
    end
  );
end;
$$;

revoke all on function public.reject_manual_payment(uuid, text) from public, anon;
grant execute on function public.reject_manual_payment(uuid, text) to authenticated;

create or replace function public.cancel_unpaid_order_groups(p_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group record;
  v_cancelled integer := 0;
begin
  for v_group in
    select g.id, g.buyer_id, g.group_number
    from public.order_groups g
    where g.payment_status = 'pending'
      and g.created_at < now() - interval '1 hour'
      and not exists (
        select 1
        from public.payment_verifications pv
        where pv.order_group_id = g.id
      )
    order by g.created_at
    limit greatest(0, least(coalesce(p_limit, 50), 500))
    for update of g skip locked
  loop
    update public.order_groups
    set payment_status = 'failed'
    where id = v_group.id
      and payment_status = 'pending';

    if not found then
      continue;
    end if;

    update public.orders
    set status = 'cancelled',
        cancelled_reason = 'Payment was not completed within one hour'
    where order_group_id = v_group.id
      and status = 'pending';

    update public.payment_attempts
    set status = 'expired',
        failure_reason = 'Order expired before payment completed',
        updated_at = now()
    where order_group_id = v_group.id
      and status = 'pending';

    perform public.restore_order_group_inventory(v_group.id);

    insert into public.notifications (user_id, title, body)
    values (
      v_group.buyer_id,
      'Unpaid order cancelled',
      'Order ' || v_group.group_number ||
      ' was cancelled because payment was not completed within one hour. Reserved stock has been released.'
    );

    v_cancelled := v_cancelled + 1;
  end loop;

  return v_cancelled;
end;
$$;

revoke all on function public.cancel_unpaid_order_groups(integer) from public, anon, authenticated;
grant execute on function public.cancel_unpaid_order_groups(integer) to service_role;

notify pgrst, 'reload schema';
