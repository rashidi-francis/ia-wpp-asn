-- Add sender_type column to whatsapp_messages table
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS sender_type TEXT DEFAULT 'client';

-- Update existing messages based on is_from_me
UPDATE public.whatsapp_messages 
SET sender_type = CASE 
  WHEN is_from_me = true THEN 'ai' 
  ELSE 'client' 
END
WHERE sender_type IS NULL OR sender_type = 'client';

-- Add comment for documentation
COMMENT ON COLUMN public.whatsapp_messages.sender_type IS 'Message sender type: client, ai, or human';