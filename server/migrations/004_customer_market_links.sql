create table if not exists customer_market_links (
  customer_id text primary key references customers(id) on delete cascade,
  company_id text not null,
  source text not null default 'manual',
  updated_at text not null default (datetime('now'))
);
