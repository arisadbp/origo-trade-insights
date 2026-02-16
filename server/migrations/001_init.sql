create table if not exists admin_users (
  id text primary key,
  name text not null,
  email text not null unique,
  role text not null check (role in ('SUPER_ADMIN', 'ORIGO_MANAGER', 'REVIEWER', 'BILLING', 'SUPPORT')),
  created_at text not null default (datetime('now'))
);

create table if not exists customers (
  id text primary key,
  company_name text not null,
  contact_name text not null default '',
  phone text not null default '',
  country text not null default '',
  notes text not null default '',
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists customer_accounts (
  id text primary key,
  customer_id text not null unique references customers(id) on delete cascade,
  email text not null unique,
  username text not null unique,
  role text not null check (role = 'CUSTOMER'),
  is_active integer not null default 1 check (is_active in (0, 1)),
  password_hash text not null default '',
  force_signout_at text,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now'))
);

create table if not exists customer_sessions (
  id text primary key,
  customer_account_id text not null references customer_accounts(id) on delete cascade,
  device_label text not null,
  ip_address text not null default '',
  user_agent text not null default '',
  last_seen_at text not null default (datetime('now')),
  revoked_at text,
  created_at text not null default (datetime('now'))
);

create table if not exists uploads (
  id text primary key,
  customer_id text not null references customers(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  description text not null default '',
  review_status text not null check (review_status in ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED')),
  reviewer_id text,
  reviewer_name text,
  reviewer_comment text,
  uploaded_by text not null,
  created_at text not null default (datetime('now')),
  updated_at text not null default (datetime('now')),
  deleted_at text
);

create table if not exists market_intelligence_records (
  id integer primary key autoincrement,
  customer_id text not null references customers(id) on delete cascade,
  market text not null,
  product_type text not null,
  metric_date text not null,
  value real not null,
  created_at text not null default (datetime('now'))
);

create table if not exists market_intelligence_presets (
  id text primary key,
  customer_id text not null references customers(id) on delete cascade,
  name text not null,
  filters_json text not null,
  created_by text not null,
  created_at text not null default (datetime('now'))
);

create table if not exists inventory_items (
  id text primary key,
  customer_id text not null references customers(id) on delete cascade,
  sku text not null,
  product_name text not null,
  qty integer not null default 0,
  unit text not null default 'kg',
  updated_at text not null default (datetime('now'))
);

create table if not exists invoices (
  id text primary key,
  customer_id text not null references customers(id) on delete cascade,
  invoice_no text not null,
  amount real not null,
  currency text not null default 'USD',
  status text not null check (status in ('OPEN', 'PAID', 'OVERDUE')),
  due_date text not null,
  created_at text not null default (datetime('now'))
);

create table if not exists audit_logs (
  id integer primary key autoincrement,
  actor_id text not null,
  actor_email text not null,
  actor_role text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  before_json text,
  after_json text,
  reason text,
  ip_address text,
  user_agent text,
  created_at text not null default (datetime('now'))
);

create index if not exists idx_customer_accounts_email on customer_accounts(email);
create index if not exists idx_customer_accounts_username on customer_accounts(username);
create index if not exists idx_uploads_customer_id on uploads(customer_id);
create index if not exists idx_market_customer_id on market_intelligence_records(customer_id);
create index if not exists idx_audit_target on audit_logs(target_type, target_id);
