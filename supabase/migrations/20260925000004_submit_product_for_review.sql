-- Sellers can't change products.status directly (products_protect_moderation_fields
-- trigger, security_hardening.sql) and new products must start as 'draft'.
-- That's the right protection, but it left no way for a draft to ever reach
-- 'pending_approval', so no seller product could ever appear on the storefront.
-- This is the one sanctioned path: the owner submits their own product, and
-- only into the review queue — never straight to 'approved'.

-- The protection trigger blocks sellers from changing status. A SECURITY
-- DEFINER function doesn't help on its own (auth.uid() is still the seller),
-- so submit_product_for_review sets a transaction-local flag and the trigger
-- honors it ONLY for the draft/rejected -> pending_approval transition, with
-- every other protected field still locked.
create or replace function public.protect_product_moderation_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_staff(auth.uid())
     and tg_op = 'UPDATE' then
    if new.store_id is distinct from old.store_id
       or new.fraud_score is distinct from old.fraud_score
       or new.is_flagged is distinct from old.is_flagged
       or new.views_count is distinct from old.views_count
       or new.approved_by is distinct from old.approved_by
       or new.approved_at is distinct from old.approved_at then
      raise exception 'protected product fields cannot be changed by sellers';
    end if;

    if new.status is distinct from old.status
       or new.rejection_reason is distinct from old.rejection_reason then
      if not (
        coalesce(current_setting('app.submitting_product', true), '') = 'on'
        and old.status in ('draft', 'rejected')
        and new.status = 'pending_approval'
      ) then
        raise exception 'protected product fields cannot be changed by sellers';
      end if;
    end if;
  elsif auth.uid() is not null and tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'new products must start as drafts';
  end if;
  return new;
end;
$$;

create or replace function public.submit_product_for_review(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product record;
begin
  select p.* into v_product
    from products p
    join seller_stores s on s.id = p.store_id
    where p.id = p_product_id
      and s.owner_id = auth.uid();

  if not found then
    raise exception 'Product not found or not yours';
  end if;

  if v_product.status not in ('draft', 'rejected') then
    raise exception 'Product is already %', v_product.status;
  end if;

  if v_product.base_price is null or v_product.base_price <= 0 then
    raise exception 'Set a price greater than 0 before submitting';
  end if;

  if not exists (select 1 from product_variants where product_id = p_product_id) then
    raise exception 'Product has no stock record';
  end if;

  perform set_config('app.submitting_product', 'on', true);

  update products
    set status = 'pending_approval', rejection_reason = null
    where id = p_product_id;
end;
$$;

grant execute on function public.submit_product_for_review(uuid) to authenticated;
