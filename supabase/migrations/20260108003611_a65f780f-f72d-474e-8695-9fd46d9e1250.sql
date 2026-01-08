-- Create short-lived OAuth state storage for Google Calendar connection
create table if not exists public.agent_calendar_oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  agent_id uuid not null,
  redirect_origin text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_calendar_oauth_states_created_at
  on public.agent_calendar_oauth_states (created_at desc);

create index if not exists idx_agent_calendar_oauth_states_agent_id
  on public.agent_calendar_oauth_states (agent_id);

alter table public.agent_calendar_oauth_states enable row level security;

-- No RLS policies on purpose: only backend functions (service role) should access this table.
