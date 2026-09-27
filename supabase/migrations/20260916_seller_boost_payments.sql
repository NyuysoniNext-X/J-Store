-- ============================================================
-- J-STORE: Seller Boost + Manual Payment + Seller Wallet
-- Migration: 20260916_seller_boost_payments
-- ============================================================

-- ── 1. Seller boost tiers ────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE seller_boost_tier AS ENUM ('normal', 'featured', 'top_seller', 'sponsored');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS seller_boosts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier           seller_boost_tier NOT NULL DEFAULT 'normal',
  reason         text,
  boosted_by     uuid REFERENCES auth.users(id),
  starts_at      timestamptz NOT NULL DEFAULT now(),
  ends_at        timestamptz,            -- NULL = permanent
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seller_boosts_seller_idx ON seller_boosts(seller_id);
CREATE INDEX IF NOT EXISTS seller_boosts_active_idx ON seller_boosts(is_active, ends_at);

-- RLS
ALTER TABLE seller_boosts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage boosts" ON seller_boosts;
CREATE POLICY "Admins manage boosts" ON seller_boosts
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Sellers read own boost" ON seller_boosts;
CREATE POLICY "Sellers read own boost" ON seller_boosts
  FOR SELECT USING (seller_id = auth.uid());

-- ── 2. Seller application notes (admin internal notes) ───────
CREATE TABLE IF NOT EXISTS seller_application_notes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES seller_applications(id) ON DELETE CASCADE,
  author_id      uuid NOT NULL REFERENCES auth.users(id),
  body           text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS san_app_idx ON seller_application_notes(application_id);

ALTER TABLE seller_application_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage application notes" ON seller_application_notes;
CREATE POLICY "Admins manage application notes" ON seller_application_notes
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Add rejection_reason + reviewed_by to seller_applications if not present
ALTER TABLE seller_applications
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS requested_info_at timestamptz;

-- ── 3. Manual MoMo payment verifications ─────────────────────
CREATE TABLE IF NOT EXISTS payment_verifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id         uuid NOT NULL REFERENCES auth.users(id),
  amount           numeric(12,2) NOT NULL,
  payment_method   text NOT NULL DEFAULT 'mtn_momo',  -- 'mtn_momo' | 'orange_money'
  transaction_ref  text NOT NULL,
  status           text NOT NULL DEFAULT 'pending',   -- 'pending' | 'confirmed' | 'rejected'
  verified_by      uuid REFERENCES auth.users(id),
  verified_at      timestamptz,
  reject_reason    text,
  submitted_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pv_order_idx  ON payment_verifications(order_id);
CREATE INDEX IF NOT EXISTS pv_buyer_idx  ON payment_verifications(buyer_id);
CREATE INDEX IF NOT EXISTS pv_status_idx ON payment_verifications(status);

ALTER TABLE payment_verifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Buyers read own verifications" ON payment_verifications;
CREATE POLICY "Buyers read own verifications" ON payment_verifications
  FOR SELECT USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "Buyers insert verifications" ON payment_verifications;
CREATE POLICY "Buyers insert verifications" ON payment_verifications
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage verifications" ON payment_verifications;
CREATE POLICY "Admins manage verifications" ON payment_verifications
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- ── 4. Seller wallet transactions ────────────────────────────
CREATE TABLE IF NOT EXISTS seller_wallet_transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         text NOT NULL,   -- 'sale' | 'withdrawal' | 'refund' | 'platform_fee'
  amount       numeric(12,2) NOT NULL,
  description  text,
  order_id     uuid REFERENCES orders(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS swt_seller_idx ON seller_wallet_transactions(seller_id);

ALTER TABLE seller_wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sellers read own wallet" ON seller_wallet_transactions;
CREATE POLICY "Sellers read own wallet" ON seller_wallet_transactions
  FOR SELECT USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage wallet" ON seller_wallet_transactions;
CREATE POLICY "Admins manage wallet" ON seller_wallet_transactions
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- ── 5. Withdrawal requests ────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount         numeric(12,2) NOT NULL,
  momo_number    text NOT NULL,
  momo_provider  text NOT NULL DEFAULT 'mtn',  -- 'mtn' | 'orange'
  status         text NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'paid' | 'rejected'
  note           text,
  processed_by   uuid REFERENCES auth.users(id),
  processed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wr_seller_idx ON withdrawal_requests(seller_id);
CREATE INDEX IF NOT EXISTS wr_status_idx ON withdrawal_requests(status);

ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sellers manage own withdrawals" ON withdrawal_requests;
CREATE POLICY "Sellers manage own withdrawals" ON withdrawal_requests
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "Admins manage withdrawals" ON withdrawal_requests;
CREATE POLICY "Admins manage withdrawals" ON withdrawal_requests
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- ── 6. Add seller boost tier to products view helper ─────────
-- (we JOIN at query time, so no column needed on products)

-- ── 7. Notifications helper — ensure admin can insert ────────
DROP POLICY IF EXISTS "Admins insert notifications" ON notifications;
CREATE POLICY "Admins insert notifications" ON notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );
