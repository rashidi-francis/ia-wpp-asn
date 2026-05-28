
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-avatars', 'agent-avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Agent avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'agent-avatars');

CREATE POLICY "Users can upload their own agent avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'agent-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own agent avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'agent-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own agent avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'agent-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
