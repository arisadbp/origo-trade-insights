-- YOUR Product schema only (no mock rows)
-- Run in Supabase SQL Editor

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.ready_page_products (
  id uuid primary key default gen_random_uuid(),
  product_name text not null unique,
  hs_code text,
  buyers_2023_count integer not null default 0,
  countries_2023_count integer not null default 0,
  buyers_2026_count integer not null default 0,
  top_countries_2023 jsonb not null default '[]'::jsonb,
  buyer_snapshot_preview jsonb not null default '[]'::jsonb,
  ready_copy text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_ready_page_products_updated_at on public.ready_page_products;
create trigger trg_ready_page_products_updated_at
before update on public.ready_page_products
for each row execute function public.set_updated_at();

create table if not exists public.ready_page_buyer_signals (
  id uuid primary key default gen_random_uuid(),
  product_name text not null,
  signal_year integer not null,
  buyer_display_name text not null,
  country text not null,
  country_code text not null,
  import_volume_kg numeric not null default 0,
  frequency text not null,
  last_active_year integer not null default 2023,
  created_at timestamptz not null default now()
);

create index if not exists idx_ready_page_buyer_signals_product_year
  on public.ready_page_buyer_signals (product_name, signal_year);

create table if not exists public.your_product_requests (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  customer_username text not null,
  customer_workspace text not null,
  product_name text not null,
  hs_code text,
  product_details text,
  target_market text,
  image_url text,
  image_file_name text,
  status text not null default 'PENDING_REVIEW',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text,
  customer_message text,
  admin_note text,
  missing_info_checklist jsonb not null default '{"packaging":false,"application":false,"target_market":false,"material":false}'::jsonb,
  confidence text not null default 'LOW',
  ready_summary text
);

drop trigger if exists trg_your_product_requests_updated_at on public.your_product_requests;
create trigger trg_your_product_requests_updated_at
before update on public.your_product_requests
for each row execute function public.set_updated_at();
