# ORIGO Admin Backend Rollout Plan

## Goal
Move from current demo-grade admin storage to production-grade admin backend with RBAC, approval, and audit.

## Phase 1: Database Foundation (Day 1)
1. Run existing baseline schema:
   - `docs/supabase-schema.sql`
2. Run new admin schema:
   - `docs/admin-backend-schema.sql`
3. Create first owner profile in `admin_profiles` with real `auth.users.id`.

## Phase 2: Security Hardening (Day 1-2)
1. Remove permissive `anon all` policies from production.
2. Enforce RLS based on `current_admin_role()`.
3. Restrict service-role usage to backend jobs only.
4. Enable MFA for `owner` and `manager` accounts.

## Phase 3: API and Service Layer (Day 2-4)
1. Implement endpoints from `docs/admin-api-contract.md`.
2. Add server-side validation and normalized error handling.
3. Wire audit logging on all mutating endpoints.
4. Add pagination and filter indexes where needed.

## Phase 4: Admin UI Integration (Day 4-6)
1. Replace direct table writes with API calls in admin pages.
2. Add status chips for `draft/pending_review/approved/published`.
3. Add approval inbox UI for `owner` and `manager`.
4. Add import preview UI with row-level validation errors.

## Phase 5: Data Quality and Migration (Day 6-7)
1. Backfill `customer_contacts` from current contact sources.
2. Normalize duplicate customers and contacts.
3. Create initial `entity_versions` snapshots for key entities.
4. Verify `contact_name` coverage for strategic accounts.

## Phase 6: Production Readiness (Day 7+)
1. Add monitoring and alerts:
   - import failures
   - approval backlog
   - auth anomalies
2. Add nightly backup + restore drill.
3. Add smoke tests for critical admin flows.

## Acceptance Checklist
- Admin login and role checks enforced
- Customer/contact CRUD works with soft delete + restore
- Approval flow controls publish state
- Import validation blocks bad data
- Full audit trail available for all changes
- No endpoint allows anonymous write in production

## Suggested First Sprint Scope
- `admin_profiles`, `role_permissions`, `customer_contacts`, `admin_audit_logs`
- API: `customers`, `contacts`, `admin/me`, `audit-logs`
- UI: Admin Customers + Contacts tab with role-aware actions
