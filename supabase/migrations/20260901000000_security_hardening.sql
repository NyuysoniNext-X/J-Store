-- Security hardening for the marketplace schema.
-- RLS controls which rows a user can reach; these triggers additionally prevent
-- an owner from changing privileged columns on an otherwise editable row.

create or replace function public.prevent_user_role_transfer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.has_role(auth.uid(), 'super_admin')
     and new.user_id is distinct from old.user_id then
    raise exception 'role ownership cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists user_roles_prevent_transfer on public.user_roles;
create trigger user_roles_prevent_transfer
  before update on public.user_roles
  for each row execute function public.prevent_user_role_transfer();

create or replace function public.protect_seller_store_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_staff(auth.uid()) then
    if tg_op = 'INSERT' then
      if new.owner_id <> auth.uid() then
        raise exception 'store owner must be the current user';
      end if;
    else
      if new.owner_id is distinct from old.owner_id
         or new.commission_rate is distinct from old.commission_rate
         or new.is_established is distinct from old.is_established
         or new.rating is distinct from old.rating
         or new.total_sales is distinct from old.total_sales
         or new.is_suspended is distinct from old.is_suspended then
        raise exception 'protected store fields cannot be changed by sellers';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists seller_stores_protect_fields on public.seller_stores;
create trigger seller_stores_protect_fields
  before insert or update on public.seller_stores
  for each row execute function public.protect_seller_store_fields();

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
       or new.status is distinct from old.status
       or new.fraud_score is distinct from old.fraud_score
       or new.is_flagged is distinct from old.is_flagged
       or new.views_count is distinct from old.views_count
       or new.approved_by is distinct from old.approved_by
       or new.approved_at is distinct from old.approved_at
       or new.rejection_reason is distinct from old.rejection_reason then
      raise exception 'protected product fields cannot be changed by sellers';
    end if;
  elsif auth.uid() is not null and tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'new products must start as drafts';
  end if;
  return new;
end;
$$;

drop trigger if exists products_protect_moderation_fields on public.products;
create trigger products_protect_moderation_fields
  before insert or update on public.products
  for each row execute function public.protect_product_moderation_fields();

create or replace function public.protect_delivery_personnel_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_staff(auth.uid())
     and (new.user_id is distinct from old.user_id
       or new.id_document_url is distinct from old.id_document_url
       or new.is_approved is distinct from old.is_approved
       or new.rating is distinct from old.rating) then
    raise exception 'protected delivery fields cannot be changed by applicants';
  end if;
  return new;
end;
$$;

drop trigger if exists delivery_personnel_protect_fields on public.delivery_personnel;
create trigger delivery_personnel_protect_fields
  before update on public.delivery_personnel
  for each row execute function public.protect_delivery_personnel_fields();

-- Never expose payment-provider payloads to ordinary buyers.
revoke select (raw_response) on public.transactions from authenticated;
