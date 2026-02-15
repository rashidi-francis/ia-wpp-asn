-- Add file_type column to agent_photos to support PDFs alongside images
ALTER TABLE public.agent_photos 
ADD COLUMN file_type text NOT NULL DEFAULT 'image';

-- Add comment for clarity
COMMENT ON COLUMN public.agent_photos.file_type IS 'Type of file: image or pdf';