-- Normalize contact columns for profile/contact UI.
-- Run in Supabase SQL Editor.

alter table if exists public.company_contacts
  add column if not exists contact_name text,
  add column if not exists position text,
  add column if not exists department text,
  add column if not exists business_email text,
  add column if not exists supplement_email_1 text,
  add column if not exists supplement_email_2 text,
  add column if not exists tel text,
  add column if not exists fax text,
  add column if not exists whatsapp text,
  add column if not exists linkedin text,
  add column if not exists twitter text,
  add column if not exists instagram text,
  add column if not exists facebook text,
  add column if not exists region text,
  add column if not exists social_media text;

alter table if exists public.customer_contacts
  add column if not exists supplement_email_1 text,
  add column if not exists supplement_email_2 text,
  add column if not exists tel text,
  add column if not exists fax text,
  add column if not exists twitter text,
  add column if not exists instagram text,
  add column if not exists facebook text,
  add column if not exists social_media text;

create index if not exists company_contacts_name_idx on public.company_contacts (contact_name);
create index if not exists company_contacts_email_idx on public.company_contacts (business_email);
create index if not exists customer_contacts_tel_idx on public.customer_contacts (tel);

-- Optional backfill from social_media (if legacy data stored mixed values there)
update public.company_contacts
set linkedin = coalesce(linkedin, social_media)
where social_media ilike '%linkedin.com%' and (linkedin is null or linkedin = '');

update public.company_contacts
set tel = coalesce(tel, social_media)
where social_media ~ '^[0-9+()\\-\\s]{7,}$' and (tel is null or tel = '');
