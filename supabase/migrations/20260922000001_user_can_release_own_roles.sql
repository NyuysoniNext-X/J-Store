-- Allow users to release their own non-admin roles
-- This lets users remove customer or seller roles they don't need anymore
-- Admin and super_admin roles can still only be managed by staff

CREATE POLICY "Users can release their own non-admin roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id 
    AND role NOT IN ('admin', 'super_admin')
  );
