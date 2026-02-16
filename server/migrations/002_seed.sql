insert or ignore into admin_users (id, name, email, role)
values
  ('admin-super', 'Super Admin', 'super.admin@origo.local', 'SUPER_ADMIN'),
  ('admin-manager', 'ORIGO Manager', 'manager@origo.local', 'ORIGO_MANAGER'),
  ('admin-reviewer', 'ORIGO Reviewer', 'reviewer@origo.local', 'REVIEWER'),
  ('admin-billing', 'ORIGO Billing', 'billing@origo.local', 'BILLING'),
  ('admin-support', 'ORIGO Support', 'support@origo.local', 'SUPPORT');

insert or ignore into customers (id, company_name, contact_name, phone, country, notes)
values (
  'cust-trrgroup',
  'THAI ROONG RUANG INDUSTRY CO., LTD.',
  '',
  '',
  '',
  'Primary seeded customer'
);

insert or ignore into customer_accounts (id, customer_id, email, username, role, is_active, password_hash)
values (
  'acct-trrgroup',
  'cust-trrgroup',
  'info@farihealth.com',
  'trrgroup',
  'CUSTOMER',
  1,
  'seeded-password-hash'
);

insert or ignore into customer_sessions (id, customer_account_id, device_label, ip_address, user_agent, last_seen_at)
values
  ('sess-trr-1', 'acct-trrgroup', 'Chrome / Windows', '10.0.0.21', 'Mozilla/5.0', datetime('now')),
  ('sess-trr-2', 'acct-trrgroup', 'Safari / iPhone', '10.0.0.55', 'Mozilla/5.0', datetime('now', '-1 day'));

insert or ignore into uploads (id, customer_id, file_name, file_type, description, review_status, uploaded_by)
values
  ('upl-1', 'cust-trrgroup', 'sugar-feb.xlsx', 'xlsx', 'Monthly upload', 'PENDING', 'info@farihealth.com'),
  ('upl-2', 'cust-trrgroup', 'price-basket.csv', 'csv', 'Weekly index', 'APPROVED', 'info@farihealth.com');

insert or ignore into market_intelligence_records (customer_id, market, product_type, metric_date, value)
values
  ('cust-trrgroup', 'TH', 'SUGAR', '2026-01-01', 102.1),
  ('cust-trrgroup', 'TH', 'SUGAR', '2026-01-15', 104.8),
  ('cust-trrgroup', 'VN', 'SUGAR', '2026-01-20', 98.2),
  ('cust-trrgroup', 'TH', 'MOLASSES', '2026-02-01', 88.4);

insert or ignore into market_intelligence_presets (id, customer_id, name, filters_json, created_by)
values (
  'preset-trr-th-sugar',
  'cust-trrgroup',
  'TH Sugar 30D',
  '{"market":"TH","productType":"SUGAR"}',
  'admin-super'
);

insert or ignore into inventory_items (id, customer_id, sku, product_name, qty, unit)
values
  ('inv-1', 'cust-trrgroup', 'SUG-TH-001', 'Refined Sugar', 3500, 'kg'),
  ('inv-2', 'cust-trrgroup', 'MOL-TH-009', 'Molasses', 1200, 'kg');

insert or ignore into invoices (id, customer_id, invoice_no, amount, currency, status, due_date)
values
  ('invoc-1', 'cust-trrgroup', 'ORI-2026-0001', 12500, 'USD', 'OPEN', '2026-03-15'),
  ('invoc-2', 'cust-trrgroup', 'ORI-2026-0002', 8400, 'USD', 'PAID', '2026-02-10');
