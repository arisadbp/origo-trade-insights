-- ORIGO Authentication Schema (Supabase)
-- Run this in Supabase SQL Editor before using the unified login flow.
-- This app uses Supabase Auth for secure session/JWT and password reset emails.

create extension if not exists "pgcrypto";

-- =========================
-- 1) Users table
-- =========================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  username text not null unique,
  -- Supabase Auth handles password hashing internally.
  -- Keep this column to satisfy app-level schema requirements.
  password_hash text not null default crypt(gen_random_uuid()::text, gen_salt('bf')),
  role text not null check (role in ('ADMIN', 'CUSTOMER')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_role_idx on public.users (role);
create unique index if not exists users_username_lower_uniq on public.users ((lower(username)));

-- =========================
-- 2) Password reset tokens table (audit/custom flow support)
-- =========================
create table if not exists public.password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_tokens_user_idx on public.password_reset_tokens (user_id, created_at desc);
create index if not exists password_reset_tokens_expiry_idx on public.password_reset_tokens (expires_at);

-- =========================
-- 3) Login attempts (rate limit)
-- =========================
create table if not exists public.auth_login_attempts (
  identifier text primary key,
  attempts integer not null default 0,
  window_started_at timestamptz not null default now(),
  blocked_until timestamptz,
  last_attempt_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================
-- 4) Utility trigger
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
before update on public.users
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_login_attempts_updated_at on public.auth_login_attempts;
create trigger trg_login_attempts_updated_at
before update on public.auth_login_attempts
for each row execute procedure public.set_updated_at();

-- =========================
-- 5) Username/email resolver for unified login
-- =========================
create or replace function public.resolve_login_email(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := lower(trim(p_identifier));
  resolved_email text;
begin
  if normalized is null or normalized = '' then
    return null;
  end if;

  if position('@' in normalized) > 0 then
    return normalized;
  end if;

  select u.email
  into resolved_email
  from public.users u
  where lower(u.username) = normalized
    and u.is_active = true
  limit 1;

  return resolved_email;
end;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

-- =========================
-- 6) Rate-limit functions
-- =========================
create or replace function public.auth_login_attempt_check(
  p_identifier text,
  p_max_attempts integer default 5,
  p_window_minutes integer default 15,
  p_block_minutes integer default 15
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := lower(trim(p_identifier));
  record_row public.auth_login_attempts%rowtype;
begin
  if normalized is null or normalized = '' then
    return false;
  end if;

  select *
  into record_row
  from public.auth_login_attempts
  where identifier = normalized;

  if not found then
    insert into public.auth_login_attempts (identifier, attempts, window_started_at, last_attempt_at)
    values (normalized, 0, now(), now())
    on conflict (identifier) do nothing;
    return true;
  end if;

  if record_row.blocked_until is not null and record_row.blocked_until > now() then
    return false;
  end if;

  if record_row.window_started_at < now() - make_interval(mins => p_window_minutes) then
    update public.auth_login_attempts
    set attempts = 0,
        window_started_at = now(),
        blocked_until = null,
        last_attempt_at = now()
    where identifier = normalized;
    return true;
  end if;

  if record_row.attempts >= p_max_attempts then
    update public.auth_login_attempts
    set blocked_until = now() + make_interval(mins => p_block_minutes),
        last_attempt_at = now()
    where identifier = normalized;
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.auth_login_attempt_record(
  p_identifier text,
  p_success boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := lower(trim(p_identifier));
begin
  if normalized is null or normalized = '' then
    return;
  end if;

  insert into public.auth_login_attempts (identifier, attempts, window_started_at, last_attempt_at, blocked_until)
  values (normalized, case when p_success then 0 else 1 end, now(), now(), null)
  on conflict (identifier)
  do update set
    attempts = case when p_success then 0 else public.auth_login_attempts.attempts + 1 end,
    last_attempt_at = now(),
    blocked_until = case when p_success then null else public.auth_login_attempts.blocked_until end,
    window_started_at = case
      when p_success then now()
      when public.auth_login_attempts.window_started_at < now() - interval '15 minutes' then now()
      else public.auth_login_attempts.window_started_at
    end;
end;
$$;

revoke all on function public.auth_login_attempt_check(text, integer, integer, integer) from public;
revoke all on function public.auth_login_attempt_record(text, boolean) from public;
grant execute on function public.auth_login_attempt_check(text, integer, integer, integer) to anon, authenticated;
grant execute on function public.auth_login_attempt_record(text, boolean) to anon, authenticated;

-- =========================
-- 7) RLS
-- =========================
alter table public.users enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.auth_login_attempts enable row level security;

-- authenticated user can view their own profile
drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users
for select
to authenticated
using (id = auth.uid());

-- no direct anon reads on users table; use RPC instead
drop policy if exists users_anon_none on public.users;
create policy users_anon_none on public.users
for select
to anon
using (false);

-- app does not read/write reset token table directly from browser
drop policy if exists reset_tokens_none on public.password_reset_tokens;
create policy reset_tokens_none on public.password_reset_tokens
for all
to anon, authenticated
using (false)
with check (false);

-- app does not read/write rate-limit table directly from browser (use RPC only)
drop policy if exists login_attempts_none on public.auth_login_attempts;
create policy login_attempts_none on public.auth_login_attempts
for all
to anon, authenticated
using (false)
with check (false);

-- =========================
-- 8) Notes
-- =========================
-- Password reset email + expiry:
-- - Sending is handled in frontend via supabase.auth.resetPasswordForEmail()
-- - Expiry is configurable in Supabase Auth settings (recommended 30-60 minutes).
