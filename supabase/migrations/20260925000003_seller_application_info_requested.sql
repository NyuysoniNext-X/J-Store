-- The seller-applications admin UI has a "request more info" action that
-- needs a third status beyond pending/approved/rejected, plus a timestamp
-- for when it was requested. Neither existed on the original enum/table.

ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'info_requested';

ALTER TABLE seller_applications
  ADD COLUMN IF NOT EXISTS requested_info_at timestamptz;
