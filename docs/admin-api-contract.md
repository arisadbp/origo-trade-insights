# ORIGO Admin API Contract

This contract defines backend endpoints for ORIGO admin operations with role-based authorization.

## Auth and Access
- Auth: Supabase JWT (`Authorization: Bearer <token>`)
- Roles: `owner`, `manager`, `analyst`
- Forbidden response: `403`
- Validation error: `422`

## 1) Admin Identity
### GET `/api/admin/me`
- Access: `owner`, `manager`, `analyst`
- Response: active admin profile + effective permissions

### PATCH `/api/admin/me`
- Access: `owner`, `manager`, `analyst`
- Body: `displayName`
- Response: updated profile

## 2) Customers
### GET `/api/admin/customers`
- Access: `owner`, `manager`, `analyst`
- Query: `q`, `status`, `country`, `page`, `pageSize`, `sortBy`, `sortDir`

### POST `/api/admin/customers`
- Access: `owner`, `manager`
- Body: `companyName`, `contactName`, `email`, `phone`, `country`, `notes`

### PATCH `/api/admin/customers/:id`
- Access: `owner`, `manager`
- Body: partial fields

### DELETE `/api/admin/customers/:id`
- Access: `owner`
- Behavior: soft delete (`deleted_at`, `deleted_by`)

### POST `/api/admin/customers/:id/restore`
- Access: `owner`
- Behavior: clear soft-delete fields

## 3) Contacts
### GET `/api/admin/customers/:id/contacts`
- Access: `owner`, `manager`, `analyst`

### POST `/api/admin/customers/:id/contacts`
- Access: `owner`, `manager`
- Body: `contactName`, `position`, `department`, `businessEmail`, `phone`, `whatsapp`, `linkedin`, `region`, `isPrimary`

### PATCH `/api/admin/contacts/:id`
- Access: `owner`, `manager`

### DELETE `/api/admin/contacts/:id`
- Access: `owner`
- Behavior: soft delete

## 4) Upload and Import
### POST `/api/admin/import-jobs`
- Access: `owner`, `manager`, `analyst`
- Body: `fileName`, `source`, `targetEntity`

### POST `/api/admin/import-jobs/:id/rows`
- Access: `owner`, `manager`, `analyst`
- Body: array of row payloads

### POST `/api/admin/import-jobs/:id/validate`
- Access: `owner`, `manager`, `analyst`
- Response: `totalRows`, `validRows`, `invalidRows`, `errors`

### POST `/api/admin/import-jobs/:id/apply`
- Access: `owner`, `manager`
- Behavior: write data + create entity versions + audit logs

### POST `/api/admin/import-jobs/:id/rollback`
- Access: `owner`
- Behavior: revert using `entity_versions`

## 5) Approval Workflow
### GET `/api/admin/approvals`
- Access: `owner`, `manager`, `analyst`
- Query: `status`, `entity`, `requestedBy`, `assignedTo`, `page`

### POST `/api/admin/approvals`
- Access: `owner`, `manager`
- Body: `entity`, `entityId`, `proposedVersionNo`, `assignedTo`, `note`

### POST `/api/admin/approvals/:id/approve`
- Access: `owner`, `manager`
- Body: `decisionNote`
- Behavior: set `approved`, then `published`

### POST `/api/admin/approvals/:id/reject`
- Access: `owner`, `manager`
- Body: `decisionNote`

## 6) Admin Users
### GET `/api/admin/users`
- Access: `owner`, `manager`

### POST `/api/admin/users`
- Access: `owner`
- Body: `email`, `displayName`, `role`

### PATCH `/api/admin/users/:id`
- Access: `owner`
- Body: `role`, `status`, `displayName`

## 7) Audit
### GET `/api/admin/audit-logs`
- Access: `owner`, `manager`
- Query: `actorEmail`, `entity`, `action`, `from`, `to`, `page`

### GET `/api/admin/entities/:entity/:id/versions`
- Access: `owner`, `manager`, `analyst`
- Response: list of snapshots with diff metadata

## 8) Data Quality
### GET `/api/admin/data-quality/issues`
- Access: `owner`, `manager`, `analyst`
- Response categories:
  - missing contact name
  - invalid email format
  - duplicate customer email
  - stale records (`updated_at` older than threshold)

## Standard Response Envelope
```json
{
  "data": {},
  "meta": {
    "requestId": "...",
    "page": 1,
    "pageSize": 25,
    "total": 120
  },
  "error": null
}
```

## Required Audit Events
All mutating endpoints must write to `admin_audit_logs` with:
- `actor_id`, `actor_email`
- `action`
- `entity`, `entity_id`
- `before_data`, `after_data`
- `request_id`, `ip_address`, `user_agent`
