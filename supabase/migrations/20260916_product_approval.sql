-- ============================================================
-- J-STORE: Product Approval System
-- Migration: 20260916_product_approval
-- ============================================================

-- Add approved column to products table
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Create index for filtering approved products
CREATE INDEX IF NOT EXISTS products_approved_idx ON products(approved, active);

-- Update RLS policies to ensure only approved products are visible to public
DROP POLICY IF EXISTS "Public can view active approved products" ON products;
CREATE POLICY "Public can view active approved products" ON products
  FOR SELECT USING (active = true AND approved = true);

-- Sellers can view their own products (regardless of approval status)
DROP POLICY IF EXISTS "Sellers view own products" ON products;
CREATE POLICY "Sellers view own products" ON products
  FOR SELECT USING (
    seller_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );

-- Admins can approve/unapprove products
DROP POLICY IF EXISTS "Admins manage product approval" ON products;
CREATE POLICY "Admins manage product approval" ON products
  FOR UPDATE USING (
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
