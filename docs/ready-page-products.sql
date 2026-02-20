-- Ready Page Content Template (Customer-facing only)
-- Supabase SQL Editor runnable script

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
    1126,
    18,
    1364,
    '[
      {"country":"Indonesia","code":"ID","share":19.4},
      {"country":"Vietnam","code":"VN","share":16.2},
      {"country":"Malaysia","code":"MY","share":13.1},
      {"country":"Kenya","code":"KE","share":11.7},
      {"country":"Uganda","code":"UG","share":9.5}
    ]'::jsonb,
    '[
      {"buyer_display_name":"Food Distributor (Indonesia)","country":"Indonesia","country_code":"ID","import_volume_kg":1482000,"frequency":"Monthly","last_active_year":2023},
      {"buyer_display_name":"Beverage Processor (Vietnam)","country":"Vietnam","country_code":"VN","import_volume_kg":1264000,"frequency":"Monthly","last_active_year":2023},
      {"buyer_display_name":"Retail Chain Supplier (Malaysia)","country":"Malaysia","country_code":"MY","import_volume_kg":932000,"frequency":"Quarterly","last_active_year":2023},
      {"buyer_display_name":"Industrial Foods Buyer (Kenya)","country":"Kenya","country_code":"KE","import_volume_kg":811000,"frequency":"Quarterly","last_active_year":2023},
      {"buyer_display_name":"Confectionery Group (Uganda)","country":"Uganda","country_code":"UG","import_volume_kg":705000,"frequency":"Monthly","last_active_year":2023}
    ]'::jsonb,
    'Historical demand is established. Priority opportunity is concentrated in repeat buyers with stable monthly purchase behavior.'
  ),
  (
    'WHITE SUGAR',
    '170199',
    768,
    14,
    954,
    '[
      {"country":"Philippines","code":"PH","share":17.8},
      {"country":"Thailand","code":"TH","share":15.9},
      {"country":"Nigeria","code":"NG","share":12.6},
      {"country":"Bangladesh","code":"BD","share":10.1},
      {"country":"Pakistan","code":"PK","share":9.8}
    ]'::jsonb,
    '[
      {"buyer_display_name":"Bakery Ingredient Buyer (Philippines)","country":"Philippines","country_code":"PH","import_volume_kg":920000,"frequency":"Monthly","last_active_year":2023},
      {"buyer_display_name":"Food Service Distributor (Thailand)","country":"Thailand","country_code":"TH","import_volume_kg":887000,"frequency":"Monthly","last_active_year":2023},
      {"buyer_display_name":"Consumer Goods Importer (Nigeria)","country":"Nigeria","country_code":"NG","import_volume_kg":702000,"frequency":"Quarterly","last_active_year":2023},
      {"buyer_display_name":"Packaged Foods Buyer (Bangladesh)","country":"Bangladesh","country_code":"BD","import_volume_kg":588000,"frequency":"Quarterly","last_active_year":2023},
      {"buyer_display_name":"Regional Trading Buyer (Pakistan)","country":"Pakistan","country_code":"PK","import_volume_kg":546000,"frequency":"Quarterly","last_active_year":2023}
    ]'::jsonb,
    'Demand breadth is healthy. Forward signals indicate stronger performance in countries with regular food-service restocking.'
  ),
  (
    'BROWN SUGAR',
    '170114',
    364,
    9,
    492,
    '[
      {"country":"Japan","code":"JP","share":20.2},
      {"country":"South Korea","code":"KR","share":16.4},
      {"country":"Australia","code":"AU","share":14.1},
      {"country":"Singapore","code":"SG","share":10.8},
      {"country":"UAE","code":"AE","share":8.9}
    ]'::jsonb,
    '[
      {"buyer_display_name":"Organic Foods Buyer (Japan)","country":"Japan","country_code":"JP","import_volume_kg":332000,"frequency":"Monthly","last_active_year":2023},
      {"buyer_display_name":"Premium Beverage Producer (South Korea)","country":"South Korea","country_code":"KR","import_volume_kg":281000,"frequency":"Quarterly","last_active_year":2023},
      {"buyer_display_name":"Health Retail Group (Australia)","country":"Australia","country_code":"AU","import_volume_kg":244000,"frequency":"Quarterly","last_active_year":2023},
      {"buyer_display_name":"Specialty Grocery Importer (Singapore)","country":"Singapore","country_code":"SG","import_volume_kg":183000,"frequency":"Monthly","last_active_year":2023},
      {"buyer_display_name":"Hospitality Supplier (UAE)","country":"UAE","country_code":"AE","import_volume_kg":162000,"frequency":"Quarterly","last_active_year":2023}
    ]'::jsonb,
    'A focused but resilient segment. Opportunity expansion is strongest in premium retail and specialty food channels.'
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

select *
from public.ready_page_products
order by created_at desc;
