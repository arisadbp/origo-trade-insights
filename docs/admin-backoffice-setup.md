# ORIGO Admin Backoffice (Local Full-Stack)

## What is included
- SQLite-backed admin API (`server/`)
- DB migrations + seed (`server/migrations`)
- Responsive admin UI page (`/admin/backoffice`)
- Customer context switcher pinned in topbar
- Audit logs for all write actions
- RBAC roles: `SUPER_ADMIN`, `ORIGO_MANAGER`, `REVIEWER`, `BILLING`, `SUPPORT`

## Seeded customer
- `email`: `info@farihealth.com`
- `username`: `trrgroup`
- `role`: `CUSTOMER`
- `company_name`: `THAI ROONG RUANG INDUSTRY CO., LTD.`

## Local run
```bash
npm install
npm run dev:full
```

Optional env:
```bash
VITE_ADMIN_API_URL=http://localhost:4000
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

If `SUPABASE_*` is not provided, API falls back to `VITE_SUPABASE_*`.

## Docker Compose
```bash
docker compose up --build
```

## API auth model for local dev
Use request headers to impersonate admin role:
- `x-admin-role`
- `x-admin-id`
- `x-admin-email`

Default role if missing is `SUPER_ADMIN`.

## Test commands
```bash
npm run lint
npm run test
```
