-- Allow admins to delete any profile
CREATE POLICY "Admins can delete any profile"
ON public.profiles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));