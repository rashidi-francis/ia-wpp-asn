-- Create table to store device fingerprints for anti-fraud
CREATE TABLE public.device_fingerprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_device_fingerprints_fingerprint ON public.device_fingerprints(fingerprint);

-- Enable RLS
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

-- Allow inserts from authenticated and anon users (for signup checking)
CREATE POLICY "Anyone can insert fingerprints"
ON public.device_fingerprints
FOR INSERT
WITH CHECK (true);

-- Only service role can select (for security)
CREATE POLICY "Service role can select fingerprints"
ON public.device_fingerprints
FOR SELECT
USING (true);

-- Create function to check if fingerprint can create account (max 3 accounts per fingerprint)
CREATE OR REPLACE FUNCTION public.can_create_account_with_fingerprint(p_fingerprint TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_count INTEGER;
  max_accounts INTEGER := 3;
BEGIN
  -- Count accounts with this fingerprint
  SELECT COUNT(*) INTO account_count
  FROM public.device_fingerprints
  WHERE fingerprint = p_fingerprint;
  
  RETURN json_build_object(
    'can_create', account_count < max_accounts,
    'current_count', account_count,
    'max_allowed', max_accounts
  );
END;
$$;