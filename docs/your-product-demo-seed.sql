-- Demo seed for YOUR Product screen (customer + admin review)
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

insert into public.ready_page_products (
  product_name,
  hs_code,
  buyers_2023_count,
  countries_2023_count,
  buyers_2026_count,
  top_countries_2023,
  buyer_snapshot_preview,
  ready_copy
)
values
  (
    'CANE SUGAR',
    '170199',
    1248,
    18,
    1732,
    '[
      {"country":"Indonesia","code":"ID","share":18.0},
      {"country":"Japan","code":"JP","share":12.0},
      {"country":"United Arab Emirates","code":"AE","share":10.0},
      {"country":"Vietnam","code":"VN","share":9.0},
      {"country":"Egypt","code":"EG","share":7.0}
    ]'::jsonb,
    '[
      {"buyer_display_name":"Food Distributor (Japan)","country":"Japan","country_code":"JP","import_volume_kg":452000,"frequency":"Monthly","last_active_year":2023},
      {"buyer_display_name":"Confectionery Manufacturer (Indonesia)","country":"Indonesia","country_code":"ID","import_volume_kg":223000,"frequency":"Quarterly","last_active_year":2023},
      {"buyer_display_name":"Wholesale Grocer (United Arab Emirates)","country":"United Arab Emirates","country_code":"AE","import_volume_kg":98000,"frequency":"Bi-monthly","last_active_year":2023},
      {"buyer_display_name":"Beverage Processor (Vietnam)","country":"Vietnam","country_code":"VN","import_volume_kg":76000,"frequency":"Quarterly","last_active_year":2023},
      {"buyer_display_name":"Industrial Foods Buyer (Egypt)","country":"Egypt","country_code":"EG","import_volume_kg":41000,"frequency":"Bi-monthly","last_active_year":2023}
    ]'::jsonb,
    'Historical demand is established and supports immediate market confidence.'
  ),
  (
    'WHITE SUGAR',
    '170199',
    842,
    16,
    1195,
    '[
      {"country":"Turkey","code":"TR","share":15.0},
      {"country":"Thailand","code":"TH","share":13.0},
      {"country":"Saudi Arabia","code":"SA","share":11.0},
      {"country":"Poland","code":"PL","share":8.0},
      {"country":"Kenya","code":"KE","share":7.0}
    ]'::jsonb,
    '[
      {"buyer_display_name":"Food Service Distributor (Turkey)","country":"Turkey","country_code":"TR","import_volume_kg":311000,"frequency":"Monthly","last_active_year":2023},
      {"buyer_display_name":"Retail Chain Supplier (Thailand)","country":"Thailand","country_code":"TH","import_volume_kg":146000,"frequency":"Quarterly","last_active_year":2023},
      {"buyer_display_name":"Bakery Ingredient Importer (Saudi Arabia)","country":"Saudi Arabia","country_code":"SA","import_volume_kg":112000,"frequency":"Bi-monthly","last_active_year":2023},
      {"buyer_display_name":"Packaged Foods Buyer (Poland)","country":"Poland","country_code":"PL","import_volume_kg":58000,"frequency":"Quarterly","last_active_year":2023},
      {"buyer_display_name":"Consumer Goods Wholesaler (Kenya)","country":"Kenya","country_code":"KE","import_volume_kg":26000,"frequency":"Bi-monthly","last_active_year":2023}
    ]'::jsonb,
    'Demand is broad across multiple regions with clear expansion potential in 2026.'
  ),
  (
    'BROWN SUGAR',
    '170114',
    396,
    11,
    608,
    '[
      {"country":"Germany","code":"DE","share":14.0},
      {"country":"Malaysia","code":"MY","share":12.0},
      {"country":"Morocco","code":"MA","share":10.0},
      {"country":"Netherlands","code":"NL","share":8.0},
      {"country":"South Africa","code":"ZA","share":7.0}
    ]'::jsonb,
    '[
      {"buyer_display_name":"Organic Foods Buyer (Germany)","country":"Germany","country_code":"DE","import_volume_kg":128000,"frequency":"Monthly","last_active_year":2023},
      {"buyer_display_name":"Specialty Beverage Producer (Malaysia)","country":"Malaysia","country_code":"MY","import_volume_kg":74000,"frequency":"Quarterly","last_active_year":2023},
      {"buyer_display_name":"Health Retail Importer (Morocco)","country":"Morocco","country_code":"MA","import_volume_kg":39000,"frequency":"Bi-monthly","last_active_year":2023},
      {"buyer_display_name":"Premium Grocery Distributor (Netherlands)","country":"Netherlands","country_code":"NL","import_volume_kg":21000,"frequency":"Quarterly","last_active_year":2023},
      {"buyer_display_name":"Hospitality Supplier (South Africa)","country":"South Africa","country_code":"ZA","import_volume_kg":9000,"frequency":"Bi-monthly","last_active_year":2023}
    ]'::jsonb,
    'Niche but resilient segment with targeted upside in premium and specialty channels.'
  )
on conflict (product_name) do update set
  hs_code = excluded.hs_code,
  buyers_2023_count = excluded.buyers_2023_count,
  countries_2023_count = excluded.countries_2023_count,
  buyers_2026_count = excluded.buyers_2026_count,
  top_countries_2023 = excluded.top_countries_2023,
  buyer_snapshot_preview = excluded.buyer_snapshot_preview,
  ready_copy = excluded.ready_copy,
  updated_at = now();

delete from public.ready_page_buyer_signals
where signal_year = 2023
  and product_name in ('CANE SUGAR', 'WHITE SUGAR', 'BROWN SUGAR');

with refined_countries(idx, country, country_code) as (
  values
    (0, 'Indonesia', 'ID'),
    (1, 'Japan', 'JP'),
    (2, 'United Arab Emirates', 'AE'),
    (3, 'Vietnam', 'VN'),
    (4, 'Egypt', 'EG'),
    (5, 'Philippines', 'PH'),
    (6, 'Malaysia', 'MY'),
    (7, 'Thailand', 'TH'),
    (8, 'Bangladesh', 'BD'),
    (9, 'Saudi Arabia', 'SA'),
    (10, 'Kenya', 'KE'),
    (11, 'Pakistan', 'PK'),
    (12, 'Turkey', 'TR'),
    (13, 'Germany', 'DE'),
    (14, 'Netherlands', 'NL'),
    (15, 'South Africa', 'ZA'),
    (16, 'Morocco', 'MA'),
    (17, 'South Korea', 'KR')
)
insert into public.ready_page_buyer_signals (
  product_name,
  signal_year,
  buyer_display_name,
  country,
  country_code,
  import_volume_kg,
  frequency,
  last_active_year
)
select
  'CANE SUGAR',
  2023,
  format('Cane Sugar Buyer %s (%s)', gs, rc.country_code),
  rc.country,
  rc.country_code,
  (30000 + ((gs * 7919) % 1900000))::numeric,
  case
    when gs % 3 = 0 then 'Monthly'
    when gs % 3 = 1 then 'Quarterly'
    else 'Bi-monthly'
  end,
  2023
from generate_series(1, 1248) as gs
join refined_countries rc
  on rc.idx = ((gs - 1) % 18);

with white_countries(idx, country, country_code) as (
  values
    (0, 'Turkey', 'TR'),
    (1, 'Thailand', 'TH'),
    (2, 'Saudi Arabia', 'SA'),
    (3, 'Poland', 'PL'),
    (4, 'Kenya', 'KE'),
    (5, 'Indonesia', 'ID'),
    (6, 'Malaysia', 'MY'),
    (7, 'United Arab Emirates', 'AE'),
    (8, 'Vietnam', 'VN'),
    (9, 'Japan', 'JP'),
    (10, 'Philippines', 'PH'),
    (11, 'Egypt', 'EG'),
    (12, 'Pakistan', 'PK'),
    (13, 'Bangladesh', 'BD'),
    (14, 'Germany', 'DE'),
    (15, 'Nigeria', 'NG')
)
insert into public.ready_page_buyer_signals (
  product_name,
  signal_year,
  buyer_display_name,
  country,
  country_code,
  import_volume_kg,
  frequency,
  last_active_year
)
select
  'WHITE SUGAR',
  2023,
  format('White Sugar Buyer %s (%s)', gs, wc.country_code),
  wc.country,
  wc.country_code,
  (20000 + ((gs * 6197) % 1300000))::numeric,
  case
    when gs % 3 = 0 then 'Monthly'
    when gs % 3 = 1 then 'Quarterly'
    else 'Bi-monthly'
  end,
  2023
from generate_series(1, 842) as gs
join white_countries wc
  on wc.idx = ((gs - 1) % 16);

with brown_countries(idx, country, country_code) as (
  values
    (0, 'Germany', 'DE'),
    (1, 'Malaysia', 'MY'),
    (2, 'Morocco', 'MA'),
    (3, 'Netherlands', 'NL'),
    (4, 'South Africa', 'ZA'),
    (5, 'Japan', 'JP'),
    (6, 'South Korea', 'KR'),
    (7, 'United Arab Emirates', 'AE'),
    (8, 'Singapore', 'SG'),
    (9, 'Poland', 'PL'),
    (10, 'Kenya', 'KE')
)
insert into public.ready_page_buyer_signals (
  product_name,
  signal_year,
  buyer_display_name,
  country,
  country_code,
  import_volume_kg,
  frequency,
  last_active_year
)
select
  'BROWN SUGAR',
  2023,
  format('Brown Sugar Buyer %s (%s)', gs, bc.country_code),
  bc.country,
  bc.country_code,
  (8000 + ((gs * 4321) % 650000))::numeric,
  case
    when gs % 3 = 0 then 'Monthly'
    when gs % 3 = 1 then 'Quarterly'
    else 'Bi-monthly'
  end,
  2023
from generate_series(1, 396) as gs
join brown_countries bc
  on bc.idx = ((gs - 1) % 11);

delete from public.your_product_requests
where customer_email = 'info@farihealth.com'
  and customer_username = 'trrgroup'
  and product_name in ('CANE SUGAR', 'WHITE SUGAR', 'BROWN SUGAR');

insert into public.your_product_requests (
  customer_email,
  customer_username,
  customer_workspace,
  product_name,
  hs_code,
  product_details,
  target_market,
  image_url,
  image_file_name,
  status,
  updated_by,
  customer_message,
  admin_note,
  missing_info_checklist,
  confidence,
  ready_summary
)
values
  (
    'info@farihealth.com',
    'trrgroup',
    'THAI ROONG RUANG INDUSTRY CO., LTD.',
    'CANE SUGAR',
    '170199',
    'cane sugar beverage grade; carbonated drink base; cane sugar; 50kg woven bag',
    'Vietnam, Indonesia, UAE',
    'https://placehold.co/240x240/png?text=Cane+Sugar',
    'cane-sugar.png',
    'READY',
    'ORIGO Admin',
    'Preview available.',
    'High confidence match from HS + detail coverage.',
    '{"packaging":false,"application":false,"target_market":false,"material":false}'::jsonb,
    'HIGH',
    'Historical proof and forward buyer opportunity are now ready to review.'
  ),
  (
    'info@farihealth.com',
    'trrgroup',
    'THAI ROONG RUANG INDUSTRY CO., LTD.',
    'WHITE SUGAR',
    '170199',
    'food service sugar; cane sugar',
    'Turkey, Thailand',
    'https://placehold.co/240x240/png?text=White+Sugar',
    'white-sugar.png',
    'NEED_MORE_INFO',
    'ORIGO Admin',
    'Please add: packaging, application.',
    'Need clearer usage profile before releasing preview.',
    '{"packaging":true,"application":true,"target_market":false,"material":false}'::jsonb,
    'MEDIUM',
    null
  ),
  (
    'info@farihealth.com',
    'trrgroup',
    'THAI ROONG RUANG INDUSTRY CO., LTD.',
    'BROWN SUGAR',
    '170114',
    'premium brown sugar; specialty bakery; cane sugar; 25kg kraft bag',
    'Germany, Netherlands',
    'https://placehold.co/240x240/png?text=Brown+Sugar',
    'brown-sugar.png',
    'PENDING_REVIEW',
    'Customer',
    'We are reviewing your product.',
    null,
    '{"packaging":false,"application":false,"target_market":false,"material":false}'::jsonb,
    'LOW',
    null
  )
on conflict do nothing;

select
  product_name,
  count(*) as buyers_2023_count,
  count(distinct country_code) as countries_2023_count
from public.ready_page_buyer_signals
where signal_year = 2023
group by product_name
order by product_name;

select product_name, status, submitted_at
from public.your_product_requests
where customer_email = 'info@farihealth.com'
order by submitted_at desc;

