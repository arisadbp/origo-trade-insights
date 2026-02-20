-- Rename product REFINED SUGAR -> CANE SUGAR in YOUR Product tables
-- Run in Supabase SQL Editor

update public.ready_page_products
set product_name = 'CANE SUGAR',
    updated_at = now()
where upper(product_name) = 'REFINED SUGAR';

update public.ready_page_buyer_signals
set product_name = 'CANE SUGAR',
    buyer_display_name = replace(buyer_display_name, 'Refined Sugar', 'Cane Sugar')
where upper(product_name) = 'REFINED SUGAR';

update public.your_product_requests
set product_name = 'CANE SUGAR',
    product_details = replace(coalesce(product_details, ''), 'refined sugar', 'cane sugar'),
    image_file_name = case when image_file_name = 'refined-sugar.png' then 'cane-sugar.png' else image_file_name end,
    image_url = replace(coalesce(image_url, ''), 'Refined+Sugar', 'Cane+Sugar'),
    updated_at = now(),
    updated_by = 'ORIGO Admin'
where upper(product_name) = 'REFINED SUGAR';

select 'ready_page_products' as table_name, count(*) as rows_changed
from public.ready_page_products
where upper(product_name) = 'CANE SUGAR'
union all
select 'ready_page_buyer_signals', count(*)
from public.ready_page_buyer_signals
where upper(product_name) = 'CANE SUGAR'
union all
select 'your_product_requests', count(*)
from public.your_product_requests
where upper(product_name) = 'CANE SUGAR';
