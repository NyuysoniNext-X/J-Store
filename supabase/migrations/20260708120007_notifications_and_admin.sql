-- ============================================================================
-- 0008_notifications_and_admin.sql
-- Notifications, partnership inquiries, platform settings, audit logs.
-- ============================================================================

create type public.notification_channel as enum ('whatsapp', 'email', 'in_app');

-- ----------------------------------------------------------------------------
-- Notifications
-- ----------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel public.notification_channel not null default 'in_app',
  title text not null,
  body text,
  is_read boolean not null default false,
  related_order_id uuid references public.orders(id),
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create index notifications_user_id_idx on public.notifications(user_id);

create policy "Users view their own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users mark their own notifications read"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Staff manage all notifications"
  on public.notifications for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- Notification inserts happen server-side (edge functions triggering
-- WhatsApp/email/in-app sends), so there is no client INSERT policy.

-- ----------------------------------------------------------------------------
-- Partnership inquiries — public contact form, staff-only to read.
-- ----------------------------------------------------------------------------
create table public.partnership_inquiries (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  message text not null,
  status text not null default 'new' check (status in ('new', 'reviewing', 'responded', 'declined')),
  created_at timestamptz not null default now()
);

alter table public.partnership_inquiries enable row level security;

create policy "Anyone can submit a partnership inquiry"
  on public.partnership_inquiries for insert
  to anon, authenticated
  with check (true);

create policy "Staff manage all partnership inquiries"
  on public.partnership_inquiries for all
  to authenticated
  using (public.is_staff(auth.uid()))
  with check (public.is_staff(auth.uid()));

-- ----------------------------------------------------------------------------
-- Platform settings — key/value store for fees, policies, email config.
-- Only super_admins may write (commission rates, etc. are high-blast-radius);
-- admins may read.
-- ----------------------------------------------------------------------------
create table public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.platform_settings enable row level security;

create policy "Staff view all settings"
  on public.platform_settings for select
  to authenticated
  using (public.is_staff(auth.uid()));

create policy "Super admins manage settings"
  on public.platform_settings for all
  to authenticated
  using (public.has_role(auth.uid(), 'super_admin'))
  with check (public.has_role(auth.uid(), 'super_admin'));

create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Audit logs — super_admin visibility only; system/service-role inserts.
-- ----------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create index audit_logs_actor_id_idx on public.audit_logs(actor_id);
create index audit_logs_created_at_idx on public.audit_logs(created_at);

create policy "Super admins view audit logs"
  on public.audit_logs for select
  to authenticated
  using (public.has_role(auth.uid(), 'super_admin'));

-- No client INSERT policy — audit rows are written exclusively via the
-- service role from triggers/edge functions, never from user sessions.
