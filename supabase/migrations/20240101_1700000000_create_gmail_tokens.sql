-- ============================================================
-- Migration: Create gmail_tokens and oauth_states tables
-- Purpose: Securely store Gmail refresh tokens and OAuth states
--          Frontend MUST NEVER access these tables
--          Only Edge Functions with service-role context may manage tokens/states
-- ============================================================

-- ============================================================
-- Table 1: gmail_tokens
-- Stores only the Google refresh token (never access tokens)
-- ============================================================

create table if not exists gmail_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz default now()
);

alter table gmail_tokens enable row level security;

-- Frontend users must have NO access
create policy "no_frontend_select" on gmail_tokens
  for select to anon, authenticated using (false);

create policy "no_frontend_insert" on gmail_tokens
  for insert to anon, authenticated with check (false);

create policy "no_frontend_update" on gmail_tokens
  for update to anon, authenticated with check (false);

create policy "no_frontend_delete" on gmail_tokens
  for delete to anon, authenticated using (false);

-- Service-role (Edge Functions) may manage tokens
create policy "service_role_manage_tokens" on gmail_tokens
  to service_role using (true)
  with check (true);

comment on table gmail_tokens is 'Stores Google refresh tokens for the authorized admin only. Frontend access blocked via RLS.';

-- ============================================================
-- Table 2: oauth_states
-- Short-lived OAuth state storage for CSRF protection
-- States expire after 10 minutes
-- ============================================================

create table if not exists oauth_states (
  state text primary key,
  user_id uuid references auth.users(id) not null,
  created_at timestamptz default now()
);

alter table oauth_states enable row level security;

-- Frontend users must have NO access
create policy "no_frontend_select" on oauth_states
  for select to anon, authenticated using (false);

create policy "no_frontend_insert" on oauth_states
  for insert to anon, authenticated with check (false);

create policy "no_frontend_update" on oauth_states
  for update to anon, authenticated with check (false);

create policy "no_frontend_delete" on oauth_states
  for delete to anon, authenticated using (false);

-- Service-role (Edge Functions) may manage states
create policy "service_role_manage_states" on oauth_states
  to service_role using (true)
  with check (true);

comment on table oauth_states is 'Short-lived OAuth states for CSRF protection. States auto-expire after 10 minutes. Frontend access blocked via RLS.';