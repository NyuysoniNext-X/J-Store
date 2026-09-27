-- ============================================================================
-- product_images_bucket.sql
-- Creates the "product-images" storage bucket for product image uploads
-- Sellers can upload images for their products; images are publicly accessible
-- ============================================================================

-- Create the public bucket for product images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Policy: Authenticated users with seller role can upload product images
create policy "Sellers can upload product images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.user_roles 
      where user_id = auth.uid() 
      and role in ('seller', 'admin', 'super_admin')
    )
  );

-- Policy: Anyone can view product images (public bucket)
create policy "Anyone can view product images"
  on storage.objects for select
  to public
  using (bucket_id = 'product-images');

-- Policy: Sellers can update their own product images
create policy "Sellers can update product images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.user_roles 
      where user_id = auth.uid() 
      and role in ('seller', 'admin', 'super_admin')
    )
  );

-- Policy: Sellers can delete their own product images  
create policy "Sellers can delete product images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.user_roles 
      where user_id = auth.uid() 
      and role in ('seller', 'admin', 'super_admin')
    )
  );
