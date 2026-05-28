UPDATE public.whatsapp_conversations
SET last_message_from = 'ai',
    followup_due_at = now() + interval '1 minute',
    followup_sent = false,
    followup_count = 0
WHERE id = '6d85543e-684d-467e-9a2a-70da74618094';