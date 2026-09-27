-- ============================================================
-- J-STORE: Restrict Seller Boosts to Super Admin Only
-- Migration: 20260920_seller_boosts_super_admin_only
-- ============================================================

-- Update seller_boosts RLS policies to super_admin only
ALTER TABLE seller_boosts DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage boosts" ON seller_boosts;
DROP POLICY IF EXISTS "Sellers read own boost" ON seller_boosts;

ALTER TABLE seller_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage boosts" ON seller_boosts
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role = 'super_admin'
    )
  );

CREATE POLICY "Sellers read own boost" ON seller_boosts
  FOR SELECT USING (seller_id = auth.uid());

-- Note: Public can read boost status for shop display (handled by join queries)
-- but cannot directly query seller_boosts table
