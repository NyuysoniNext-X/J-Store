-- Allow users to activate their own seller role if they have an approved application
-- This lets users who released their seller role reactivate it without admin intervention

CREATE POLICY "Users can activate seller role with approved application"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND role = 'seller'
    AND EXISTS (
      SELECT 1 FROM public.seller_applications
      WHERE user_id = auth.uid()
        AND status = 'approved'
    )
  );

-- Also allow users to self-activate customer role (basic role for anyone)
CREATE POLICY "Users can activate customer role"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND role = 'customer'
  );