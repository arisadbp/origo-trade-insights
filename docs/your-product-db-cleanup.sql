-- YOUR Product database cleanup + migration
-- Run once in Supabase SQL Editor before using latest UI

alter table if exists public.your_product_requests
  add column if not exists product_details text;

update public.your_product_requests
set product_details = coalesce(
  nullif(trim(product_details), ''),
  nullif(trim(details_keyword), ''),
  nullif(trim(details_application), ''),
  nullif(trim(details_material), ''),
  nullif(trim(details_packaging), '')
)
where coalesce(nullif(trim(product_details), ''), '') = '';

alter table if exists public.your_product_requests
  drop column if exists details_keyword,
  drop column if exists details_application,
  drop column if exists details_material,
  drop column if exists details_packaging;

-- Optional: remove records that are not related to YOUR Product customer flow
-- delete from public.your_product_requests where customer_email is null or customer_email = '';
