-- Crisp Progress Tracking Database Schema
-- Run this in your Supabase SQL Editor: https://app.supabase.com/project/_/sql

-- Create sessions table
create table if not exists public.sessions (
  session_id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  anon_id uuid,
  timestamp timestamptz default now(),
  
  -- Derived metrics (0-1 scale)
  clarity_score float not null check (clarity_score >= 0 and clarity_score <= 1),
  filler_word_rate float not null check (filler_word_rate >= 0 and filler_word_rate <= 1),
  confidence_score float not null check (confidence_score >= 0 and confidence_score <= 1),
  
  -- Raw metrics
  pace_wpm int not null check (pace_wpm >= 0),
  total_words int not null check (total_words >= 0),
  talk_time_sec float not null check (talk_time_sec >= 0),
  pause_count int not null check (pause_count >= 0),
  
  -- Intent-driven scenario metadata (nullable for backward compatibility)
  scenario text,
  intent text
);

-- Enable Row Level Security
alter table public.sessions enable row level security;

-- Policy: Users can read their own sessions
create policy "Users view own sessions"
  on public.sessions
  for select
  using (auth.uid() = user_id);

-- Policy: Allow session inserts (authenticated or anonymous)
create policy "Allow session inserts"
  on public.sessions
  for insert
  with check (
    (auth.uid() = user_id)  -- Authenticated users can insert their own
    or 
    (user_id is null)       -- Anyone can insert anonymous sessions
  );

-- Policy: Users can update their own sessions
create policy "Users update own sessions"
  on public.sessions
  for update
  using (auth.uid() = user_id);

-- Policy: Users can delete their own sessions
create policy "Users delete own sessions"
  on public.sessions
  for delete
  using (auth.uid() = user_id);

-- Create index for efficient queries
create index if not exists idx_sessions_user_id_timestamp 
  on public.sessions(user_id, timestamp desc);

create index if not exists idx_sessions_anon_id 
  on public.sessions(anon_id) where anon_id is not null;

-- Function to auto-purge orphaned anonymous sessions after 7 days
-- (Optional - can be set up as a scheduled function in Supabase)
create or replace function purge_old_anon_sessions()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.sessions
  where anon_id is not null
    and user_id is null
    and timestamp < now() - interval '7 days';
end;
$$;

-- Grant necessary permissions
grant usage on schema public to anon, authenticated;
grant all on public.sessions to anon, authenticated;

-- Enable realtime (optional - for live updates)
-- alter publication supabase_realtime add table public.sessions;

-- Success message
do $$
begin
  raise notice '✅ Crisp database schema created successfully!';
  raise notice 'Next steps:';
  raise notice '1. Configure Google OAuth in Authentication > Providers';
  raise notice '2. Add your app URL to Authentication > URL Configuration';
  raise notice '3. Update your .env file with Supabase credentials';
end $$;

