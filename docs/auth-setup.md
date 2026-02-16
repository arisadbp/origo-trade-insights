# ORIGO Unified Auth Setup (Supabase)

## 1) Run schema
In Supabase SQL Editor, run:
- `docs/supabase-auth-schema.sql`

## 2) Create Auth users
Go to Supabase Dashboard:
- `Authentication` -> `Users` -> `Add user`
- Create users with email + password

## 3) Insert profile rows in `public.users`
For each auth user, insert profile data:

```sql
insert into public.users (id, email, username, role, is_active)
values
  ('<auth_user_uuid>', 'admin@origo.com', 'origo_admin', 'ADMIN', true),
  ('<auth_user_uuid_2>', 'customer@company.com', 'customer_demo', 'CUSTOMER', true);
```

Notes:
- `username` is used for login when user does not type `@`.
- `role` controls redirect:
  - `ADMIN` -> `/admin`
  - `CUSTOMER` -> `/market-intelligence`

## 4) Password reset
The app uses `supabase.auth.resetPasswordForEmail(...)`.
Reset link expiry is configured in Supabase Auth settings.
Recommended expiry: `30-60 minutes`.

## 5) Environment
Ensure `.env.local` has:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
