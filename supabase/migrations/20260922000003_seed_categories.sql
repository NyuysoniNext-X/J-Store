-- Seed categories for J-STORE marketplace
-- Based on common categories in Cameroon e-commerce

INSERT INTO public.categories (name, slug, parent_id) VALUES
  ('Fashion', 'fashion', NULL),
  ('Electronics', 'electronics', NULL),
  ('Home & Living', 'home-living', NULL),
  ('Beauty', 'beauty', NULL),
  ('Sports', 'sports', NULL),
  ('Accessories', 'accessories', NULL),
  ('School', 'school', NULL),
  ('Books', 'books', NULL)
ON CONFLICT (slug) DO NOTHING;

-- Add some subcategories (optional, using parent_id)
-- Fashion subcategories
INSERT INTO public.categories (name, slug, parent_id) VALUES
  ('Men''s Clothing', 'mens-clothing', (SELECT id FROM public.categories WHERE slug = 'fashion')),
  ('Women''s Clothing', 'womens-clothing', (SELECT id FROM public.categories WHERE slug = 'fashion')),
  ('Kids Clothing', 'kids-clothing', (SELECT id FROM public.categories WHERE slug = 'fashion')),
  ('Shoes', 'shoes', (SELECT id FROM public.categories WHERE slug = 'fashion'))
ON CONFLICT (slug) DO NOTHING;

-- Electronics subcategories  
INSERT INTO public.categories (name, slug, parent_id) VALUES
  ('Phones & Tablets', 'phones-tablets', (SELECT id FROM public.categories WHERE slug = 'electronics')),
  ('Computers', 'computers', (SELECT id FROM public.categories WHERE slug = 'electronics')),
  ('Audio & Video', 'audio-video', (SELECT id FROM public.categories WHERE slug = 'electronics'))
ON CONFLICT (slug) DO NOTHING;
