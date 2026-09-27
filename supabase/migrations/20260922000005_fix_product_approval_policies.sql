-- Fix incorrect seller_id reference in product approval policies
-- The products table uses store_id, not seller_id

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Sellers view own products" ON products;

-- Recreate with correct column reference
CREATE POLICY "Sellers view own products" ON products
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM seller_stores
      WHERE seller_stores.id = products.store_id
        AND seller_stores.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );
