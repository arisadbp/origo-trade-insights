-- ORIGO Admin Backend Schema (Supabase/Postgres)
-- Purpose: production-ready admin backend foundation with RBAC, approval workflow,
-- import pipeline, versioning, and auditability.

create extension if not exists "pgcrypto";

-- ----------
-- Enums
-- ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'admin_role') then
    create type public.admin_role as enum ('owner', 'manager', 'analyst');
  end if;

  if not exists (select 1 from pg_type where typname = 'admin_user_status') then
    create type public.admin_user_status as enum ('active', 'invited', 'disabled');
  end if;

  if not exists (select 1 from pg_type where typname = 'entity_kind') then
    create type public.entity_kind as enum (
      'customer',
      'contact',
      'admin_user',
      'upload',
      'trade_record',
      'supply_chain_record',
      'company_profile'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'review_status') then
    create type public.review_status as enum ('draft', 'pending_review', 'approved', 'rejected', 'published');
  end if;

  if not exists (select 1 from pg_type where typname = 'import_status') then
    create type public.import_status as enum ('uploaded', 'validating', 'validated', 'failed', 'applied', 'rolled_back');
  end if;

  if not exists (select 1 from pg_type where typname = 'audit_action') then
    create type public.audit_action as enum (
      'create',
      'update',
      'delete',
      'soft_delete',
      'restore',
      'approve',
      'reject',
      'publish',
      'login',
      'logout',
      'bulk_import'
    );
  end if;
end $$;

-- ----------
-- Admin identity + RBAC
-- ----------
create table if not exists public.admin_profiles (
  id uuid primary key,
  email text not null unique,
  display_name text not null,
  role public.admin_role not null default 'analyst',
  status public.admin_user_status not null default 'invited',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.admin_role not null,
  resource text not null,
  can_read boolean not null default false,
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  unique (role, resource)
);

-- ----------
-- Existing entities upgrades (soft delete + workflow)
-- ----------
alter table if exists public.customers
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid,
  add column if not exists review_status public.review_status not null default 'published',
  add column if not exists version_no integer not null default 1;

alter table if exists public.uploads
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid,
  add column if not exists review_status_v2 public.review_status not null default 'published';

alter table if exists public.admin_users
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

-- ----------
-- Contacts normalized table (admin-manageable)
-- ----------
create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null references public.customers(id) on delete cascade,
  contact_name text not null,
  position text,
  department text,
  business_email text,
  phone text,
  whatsapp text,
  linkedin text,
  region text,
  is_primary boolean not null default false,
  review_status public.review_status not null default 'published',
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_contacts_customer_idx on public.customer_contacts (customer_id);
create index if not exists customer_contacts_email_idx on public.customer_contacts (business_email);

-- ----------
-- Versioning + approvals
-- ----------
create table if not exists public.entity_versions (
  id uuid primary key default gen_random_uuid(),
  entity public.entity_kind not null,
  entity_id text not null,
  version_no integer not null,
  snapshot jsonb not null,
  changed_by uuid,
  change_note text,
  created_at timestamptz not null default now(),
  unique (entity, entity_id, version_no)
);

create index if not exists entity_versions_lookup_idx on public.entity_versions (entity, entity_id, version_no desc);

create table if not exists public.approval_tasks (
  id uuid primary key default gen_random_uuid(),
  entity public.entity_kind not null,
  entity_id text not null,
  proposed_version_no integer not null,
  status public.review_status not null default 'pending_review',
  requested_by uuid,
  assigned_to uuid,
  approved_by uuid,
  rejected_by uuid,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists approval_tasks_status_idx on public.approval_tasks (status, created_at desc);

-- ----------
-- Import pipeline
-- ----------
create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  source text not null,
  target_entity public.entity_kind not null,
  status public.import_status not null default 'uploaded',
  uploaded_by uuid,
  validated_by uuid,
  applied_by uuid,
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  error_summary jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.import_job_rows (
  id uuid primary key default gen_random_uuid(),
  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  row_no integer not null,
  payload jsonb not null,
  validation_errors jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (import_job_id, row_no)
);

create index if not exists import_job_rows_job_idx on public.import_job_rows (import_job_id, row_no);

-- ----------
-- Audit log (append-only)
-- ----------
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action public.audit_action not null,
  entity public.entity_kind not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  message text,
  request_id text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_entity_idx on public.admin_audit_logs (entity, entity_id, created_at desc);
create index if not exists admin_audit_logs_actor_idx on public.admin_audit_logs (actor_email, created_at desc);

-- ----------
-- Utility triggers
-- ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_admin_profiles_updated_at on public.admin_profiles;
create trigger trg_admin_profiles_updated_at
before update on public.admin_profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_customer_contacts_updated_at on public.customer_contacts;
create trigger trg_customer_contacts_updated_at
before update on public.customer_contacts
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_approval_tasks_updated_at on public.approval_tasks;
create trigger trg_approval_tasks_updated_at
before update on public.approval_tasks
for each row execute procedure public.set_updated_at();

drop trigger if exists trg_import_jobs_updated_at on public.import_jobs;
create trigger trg_import_jobs_updated_at
before update on public.import_jobs
for each row execute procedure public.set_updated_at();

-- ----------
-- Seed baseline permissions
-- ----------
insert into public.role_permissions (role, resource, can_read, can_create, can_update, can_delete)
values
  ('owner', 'customers', true, true, true, true),
  ('owner', 'contacts', true, true, true, true),
  ('owner', 'uploads', true, true, true, true),
  ('owner', 'admin_users', true, true, true, true),
  ('owner', 'imports', true, true, true, true),
  ('owner', 'approvals', true, true, true, true),
  ('owner', 'audit_logs', true, false, false, false),

  ('manager', 'customers', true, true, true, false),
  ('manager', 'contacts', true, true, true, false),
  ('manager', 'uploads', true, true, true, false),
  ('manager', 'admin_users', true, false, false, false),
  ('manager', 'imports', true, true, true, false),
  ('manager', 'approvals', true, true, true, false),
  ('manager', 'audit_logs', true, false, false, false),

  ('analyst', 'customers', true, false, false, false),
  ('analyst', 'contacts', true, false, false, false),
  ('analyst', 'uploads', true, false, false, false),
  ('analyst', 'admin_users', false, false, false, false),
  ('analyst', 'imports', true, true, false, false),
  ('analyst', 'approvals', true, false, false, false),
  ('analyst', 'audit_logs', false, false, false, false)
on conflict (role, resource) do update set
  can_read = excluded.can_read,
  can_create = excluded.can_create,
  can_update = excluded.can_update,
  can_delete = excluded.can_delete;

-- ----------
-- RLS baseline (replace demo all-anon policies in production)
-- ----------
alter table public.admin_profiles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.entity_versions enable row level security;
alter table public.approval_tasks enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_job_rows enable row level security;
alter table public.admin_audit_logs enable row level security;

create or replace function public.current_admin_role()
returns public.admin_role
language sql
stable
as $$
  select ap.role
  from public.admin_profiles ap
  where ap.id = auth.uid()
    and ap.status = 'active'
  limit 1
$$;

create policy if not exists admin_profiles_self_read on public.admin_profiles
for select using (id = auth.uid());

create policy if not exists role_permissions_admin_read on public.role_permissions
for select using (public.current_admin_role() in ('owner', 'manager', 'analyst'));

create policy if not exists customer_contacts_admin_rw on public.customer_contacts
for all using (public.current_admin_role() in ('owner', 'manager', 'analyst'))
with check (public.current_admin_role() in ('owner', 'manager'));

create policy if not exists entity_versions_admin_read on public.entity_versions
for select using (public.current_admin_role() in ('owner', 'manager', 'analyst'));

create policy if not exists approvals_admin_rw on public.approval_tasks
for all using (public.current_admin_role() in ('owner', 'manager', 'analyst'))
with check (public.current_admin_role() in ('owner', 'manager'));

create policy if not exists import_jobs_admin_rw on public.import_jobs
for all using (public.current_admin_role() in ('owner', 'manager', 'analyst'))
with check (public.current_admin_role() in ('owner', 'manager', 'analyst'));

create policy if not exists import_job_rows_admin_rw on public.import_job_rows
for all using (public.current_admin_role() in ('owner', 'manager', 'analyst'))
with check (public.current_admin_role() in ('owner', 'manager', 'analyst'));

create policy if not exists admin_audit_logs_read_only on public.admin_audit_logs
for select using (public.current_admin_role() in ('owner', 'manager'));

comment on table public.admin_profiles is 'Admin identities mapped to Supabase auth users';
comment on table public.role_permissions is 'Permission matrix per role and resource';
comment on table public.customer_contacts is 'Normalized contact person records for each customer';
comment on table public.entity_versions is 'Snapshot history for rollback and audit';
comment on table public.approval_tasks is 'Draft/review/approve workflow queue';
comment on table public.import_jobs is 'Bulk import control plane';
comment on table public.import_job_rows is 'Per-row validation result for import jobs';
comment on table public.admin_audit_logs is 'Append-only admin activity logs';
