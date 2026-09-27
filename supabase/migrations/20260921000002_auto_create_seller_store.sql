-- ============================================================================
-- auto_create_seller_store.sql
-- Automatically creates a seller_store when a user gets the 'seller' role
-- This ensures sellers can immediately add products without manual store setup
-- ============================================================================

-- Function to create a default seller store
CREATE OR REPLACE FUNCTION public.auto_create_seller_store()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  store_slug text;
BEGIN
  -- Only proceed if the role being added is 'seller' or above
  IF NEW.role IN ('seller', 'admin', 'super_admin') THEN
    -- Check if seller store already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.seller_stores 
      WHERE owner_id = NEW.user_id
    ) THEN
      -- Generate unique slug from user_id
      store_slug := 'store-' || replace(NEW.user_id::text, '-', '');
      
      -- Create default seller store
      INSERT INTO public.seller_stores (
        owner_id,
        store_name,
        slug,
        description,
        rating,
        total_sales,
        is_established
      ) VALUES (
        NEW.user_id,
        'My Store',
        store_slug,
        'Welcome to my store',
        0,
        0,
        false
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to call the function when a role is inserted
DROP TRIGGER IF EXISTS create_seller_store_on_role ON public.user_roles;
CREATE TRIGGER create_seller_store_on_role
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_seller_store();

-- Also create stores for existing sellers who don't have one
INSERT INTO public.seller_stores (owner_id, store_name, slug, description, rating, total_sales, is_established)
SELECT DISTINCT 
  ur.user_id, 
  'My Store', 
  'store-' || replace(ur.user_id::text, '-', ''),
  'Welcome to my store', 
  0, 
  0,
  false
FROM public.user_roles ur
WHERE ur.role IN ('seller', 'admin', 'super_admin')
  AND NOT EXISTS (
    SELECT 1 FROM public.seller_stores ss 
    WHERE ss.owner_id = ur.user_id
  )
ON CONFLICT (owner_id) DO NOTHING;
