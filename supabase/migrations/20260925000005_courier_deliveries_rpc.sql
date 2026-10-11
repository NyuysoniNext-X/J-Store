-- Couriers need the drop-off address and order total to do a delivery, but
-- the RLS on `orders` / `order_groups` only lets buyers, store owners and
-- staff read them (and widening those policies would expose every buyer's
-- address to every courier). This returns only the fields a courier needs,
-- only for deliveries they can act on: unassigned ones (to claim) and their
-- own. Staff see all.

create or replace function public.get_courier_deliveries()
returns table (
  id uuid,
  order_id uuid,
  delivery_personnel_id uuid,
  status public.delivery_status,
  assigned_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  proof_photo_url text,
  customer_signature_url text,
  delivery_fee numeric,
  created_at timestamptz,
  updated_at timestamptz,
  order_total numeric,
  ship_recipient text,
  ship_phone text,
  ship_city text,
  ship_quarter text,
  ship_landmark text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_personnel uuid;
  v_staff boolean := public.is_staff(auth.uid());
begin
  select dp.id into v_personnel
    from delivery_personnel dp
    where dp.user_id = auth.uid() and dp.is_approved;

  if v_personnel is null and not v_staff then
    return;
  end if;

  return query
    select d.id, d.order_id, d.delivery_personnel_id, d.status,
           d.assigned_at, d.picked_up_at, d.delivered_at,
           d.proof_photo_url, d.customer_signature_url, d.delivery_fee,
           d.created_at, d.updated_at,
           o.total,
           g.shipping_recipient_name, g.shipping_phone,
           g.shipping_city, g.shipping_quarter, g.shipping_landmark
      from deliveries d
      join orders o on o.id = d.order_id
      join order_groups g on g.id = o.order_group_id
     where d.status in ('unassigned', 'assigned', 'picked_up', 'in_transit')
       and (v_staff or d.delivery_personnel_id is null or d.delivery_personnel_id = v_personnel)
     order by d.created_at desc;
end;
$$;

grant execute on function public.get_courier_deliveries() to authenticated;
