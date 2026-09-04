-- ============================================================================
-- 0009_add_partner_role.sql
-- Adds the 'partner' role (business/affiliate partners — referral & B2B
-- deals, not day-to-day ops). Kept in its own migration: Postgres requires a
-- new enum value to be committed before it can be referenced by name
-- elsewhere (e.g. in a check constraint or another migration's DML).
-- ============================================================================

alter type public.app_role add value 'partner';
