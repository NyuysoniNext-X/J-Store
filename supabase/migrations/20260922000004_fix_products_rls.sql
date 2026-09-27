-- Fix products RLS policies to explicitly separate INSERT from other operations
-- The previous "for all" policy might be causing conflicts

-- Drop the old "for all" policy
DROP POLICY IF EXISTS "Store owners manage their own products" ON public.products;

-- Create separate policies for each operation

-- INSERT: Store owners can create products for their stores
CREATE POLICY "Store owners can create products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.seller_stores s
      WHERE s.id = products.store_id 
        AND s.owner_id = auth.uid()
    )
  );

-- SELECT: Already covered by existing policy "Store owners view their own products regardless of status"
-- (no need to recreate)

-- UPDATE: Store owners can update their own products
CREATE POLICY "Store owners can update own products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_stores s
      WHERE s.id = products.store_id 
        AND s.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.seller_stores s
      WHERE s.id = products.store_id 
        AND s.owner_id = auth.uid()
    )
  );

-- DELETE: Store owners can delete their own products
CREATE POLICY "Store owners can delete own products"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_stores s
      WHERE s.id = products.store_id 
        AND s.owner_id = auth.uid()
    )
  );
