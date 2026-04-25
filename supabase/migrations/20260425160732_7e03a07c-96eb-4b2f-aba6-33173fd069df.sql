-- Reagendar o cron de verificação de planos para rodar de hora em hora
-- (necessário para trial de 24 horas com expiração precisa)
SELECT cron.unschedule('check-expired-plans-daily');

SELECT cron.schedule(
  'check-expired-plans-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://gwuyvnzojocfebypqfff.supabase.co/functions/v1/check-plan-expiration',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3dXl2bnpvam9jZmVieXBxZmZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NDkxMzQsImV4cCI6MjA3ODMyNTEzNH0.PmADRcWcNxvhJZzNx-wjInyJCaXI2xBspTlHg1nAfWQ"}'::jsonb,
      body := '{}'::jsonb
    ) AS request_id;
  $$
);