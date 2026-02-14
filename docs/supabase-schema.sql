create extension if not exists "pgcrypto";

create table if not exists public.customers (
  id text primary key,
  company_name text not null,
  contact_name text not null,
  email text not null unique,
  phone text not null default '',
  country text not null default '',
  status text not null check (status in ('active', 'paused')),
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null check (role in ('owner', 'manager', 'analyst')),
  status text not null check (status in ('active', 'invited', 'disabled')),
  last_login timestamptz not null default now()
);

create table if not exists public.uploads (
  id text primary key,
  file_name text not null,
  file_size text not null,
  file_type text not null,
  description text not null default '',
  customer_id text not null references public.customers (id) on delete cascade,
  uploaded_by text not null,
  uploaded_at timestamptz not null default now(),
  status text not null check (status in ('uploading', 'processing', 'ready', 'error')),
  review_status text not null check (review_status in ('updated', 'pending', 'cancel')),
  progress integer null check (progress is null or (progress >= 0 and progress <= 100))
);

create index if not exists uploads_customer_idx on public.uploads (customer_id);
create index if not exists uploads_uploaded_at_idx on public.uploads (uploaded_at desc);

create table if not exists public.activity_logs (
  id text primary key,
  type text not null check (type in ('customer', 'upload', 'user')),
  message text not null,
  actor text not null,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_created_at_idx on public.activity_logs (created_at desc);

alter table public.customers enable row level security;
alter table public.admin_users enable row level security;
alter table public.uploads enable row level security;
alter table public.activity_logs enable row level security;

-- Demo policy for frontend anon key. Restrict this for production.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'customers' and policyname = 'customers_all_anon'
  ) then
    create policy customers_all_anon on public.customers for all to anon using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_users' and policyname = 'admin_users_all_anon'
  ) then
    create policy admin_users_all_anon on public.admin_users for all to anon using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'uploads' and policyname = 'uploads_all_anon'
  ) then
    create policy uploads_all_anon on public.uploads for all to anon using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'activity_logs' and policyname = 'activity_logs_all_anon'
  ) then
    create policy activity_logs_all_anon on public.activity_logs for all to anon using (true) with check (true);
  end if;
end $$;
