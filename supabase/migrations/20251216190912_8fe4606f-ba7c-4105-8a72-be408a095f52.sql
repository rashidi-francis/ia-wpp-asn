-- Add plan expiration date to profiles
ALTER TABLE public.profiles 
ADD COLUMN plan_expires_at TIMESTAMP WITH TIME ZONE;

-- Add a comment explaining the column
COMMENT ON COLUMN public.profiles.plan_expires_at IS 'Date when the current plan expires. NULL means no expiration (free trial uses created_at + 3 days instead).';

-- Create index for efficient expiration queries
CREATE INDEX idx_profiles_plan_expires_at ON public.profiles(plan_expires_at);