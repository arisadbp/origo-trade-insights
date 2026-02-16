# Admin Backoffice REST API

Base URL: `http://localhost:4000/api/admin`

## Customer context
- `GET /customer-context/search?q=<query>`
- `GET /customers/:customerId`

## Company profile
- `PATCH /customers/:customerId/profile`
  - body: `company_name`, `contact_name`, `phone`, `country`, `notes`

## Account context and security
- `PATCH /customers/:customerId/account/email`
  - body: `newEmail`, `reason`, `forceSignOutAllSessions`
- `POST /customers/:customerId/account/reset-password`
  - body: `reason`
- `GET /customers/:customerId/security/sessions`
- `POST /customers/:customerId/security/sign-out-all`
  - body: `reason`

## Upload center
- `GET /customers/:customerId/uploads`
- `POST /customers/:customerId/uploads`
  - body (JSON): `file_name`, `file_type`, `description`, `uploaded_by`
  - or `multipart/form-data` with `file` + metadata
- `PATCH /customers/:customerId/uploads/:uploadId`
  - body: `file_name?`, `file_type?`, `description?`, `reason`
- `DELETE /customers/:customerId/uploads/:uploadId`
  - body: `reason`
- `PATCH /customers/:customerId/uploads/:uploadId/review`
  - body: `review_status` (`APPROVED|REJECTED|CHANGES_REQUESTED`), `comment`, `reason`

## Market intelligence
- `GET /customers/:customerId/market-intelligence/source-status`
- `PUT /customers/:customerId/market-intelligence/link`
  - body: `companyId`
- `GET /customers/:customerId/market-intelligence?market=&productType=&dateFrom=&dateTo=`
- `POST /customers/:customerId/market-intelligence/records`
  - body: `market`, `product_type`, `metric_date`, `value`, `reason`
- `PATCH /customers/:customerId/market-intelligence/records/:recordId`
  - body: `market`, `product_type`, `metric_date`, `value`, `reason`
- `DELETE /customers/:customerId/market-intelligence/records/:recordId`
  - body: `reason`
- `GET /customers/:customerId/market-intelligence/export.csv`
- `GET /customers/:customerId/market-intelligence/export.pdf`
- `GET /customers/:customerId/market-intelligence/presets`
- `POST /customers/:customerId/market-intelligence/presets`
  - body: `name`, `filters`

## Inventory and invoices
- `GET /customers/:customerId/inventory`
- `GET /customers/:customerId/invoices`

## Audit logs
- `GET /audit-logs?targetId=<id>`

## RBAC matrix
- `SUPER_ADMIN`: all endpoints
- `ORIGO_MANAGER`: all operational endpoints
- `REVIEWER`: customer read + upload review + market read/export
- `BILLING`: customer read + invoices + audit read
- `SUPPORT`: customer read + reset/sign-out + upload manage + read-only ops
