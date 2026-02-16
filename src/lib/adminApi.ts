const API_BASE = import.meta.env.VITE_ADMIN_API_URL || "";
const API_ROOT = `${API_BASE}/api/admin`;

export function buildAdminApiUrl(path: string) {
  return `${API_ROOT}${path}`;
}

export type AdminRole = "SUPER_ADMIN" | "ORIGO_MANAGER" | "REVIEWER" | "BILLING" | "SUPPORT";

export interface CustomerContextRow {
  customer_id: string;
  company_name: string;
  email: string;
  username: string;
  role: "CUSTOMER";
}

export interface UploadRow {
  id: string;
  customer_id: string;
  file_name: string;
  file_type: string;
  description: string;
  review_status: "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  reviewer_name: string | null;
  reviewer_comment: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface MarketRow {
  id: string;
  source_record_id: number;
  customer_id: string;
  market: string;
  product_type: string;
  metric_date: string;
  value: number;
  created_at: string;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  role?: AdminRole;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(buildAdminApiUrl(path), {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      "x-admin-role": options.role || "SUPER_ADMIN",
      "x-admin-id": "admin-super",
      "x-admin-email": "super.admin@origo.local",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(errorBody.message || "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export async function searchCustomerContexts(q: string) {
  const result = await request<{ data: CustomerContextRow[] }>(
    `/customer-context/search?q=${encodeURIComponent(q)}`,
  );
  return result.data;
}

export async function getCustomerBundle(customerId: string) {
  const result = await request<{
    data: {
      customer: {
        id: string;
        company_name: string;
        contact_name: string;
        phone: string;
        country: string;
        notes: string;
      };
      account: {
        id: string;
        email: string;
        username: string;
        role: "CUSTOMER";
      };
      stats: {
        total_uploads: number;
        pending_uploads: number;
        approved_uploads: number;
      };
      recentActivity: Array<{
        id: number;
        action: string;
        target_type: string;
        reason: string | null;
        created_at: string;
        actor_email: string;
      }>;
    };
  }>(`/customers/${encodeURIComponent(customerId)}`);
  return result.data;
}

export async function updateCompanyProfile(
  customerId: string,
  payload: {
    company_name: string;
    contact_name: string;
    phone: string;
    country: string;
    notes: string;
  },
) {
  const result = await request<{ data: unknown }>(`/customers/${customerId}/profile`, {
    method: "PATCH",
    body: payload,
  });
  return result.data;
}

export async function changeCustomerEmail(
  customerId: string,
  payload: { newEmail: string; reason: string; forceSignOutAllSessions: boolean },
) {
  const result = await request<{ data: unknown }>(`/customers/${customerId}/account/email`, {
    method: "PATCH",
    body: payload,
  });
  return result.data;
}

export async function listUploads(customerId: string) {
  const result = await request<{ data: UploadRow[] }>(`/customers/${customerId}/uploads`);
  return result.data;
}

export async function createUpload(
  customerId: string,
  payload: { file_name: string; file_type: string; description: string; uploaded_by: string; file?: File | null },
) {
  if (payload.file) {
    const form = new FormData();
    form.append("file", payload.file);
    form.append("description", payload.description);
    form.append("uploaded_by", payload.uploaded_by);
    if (payload.file_name) form.append("file_name", payload.file_name);
    if (payload.file_type) form.append("file_type", payload.file_type);
    const response = await fetch(buildAdminApiUrl(`/customers/${customerId}/uploads`), {
      method: "POST",
      headers: {
        "x-admin-role": "SUPER_ADMIN",
        "x-admin-id": "admin-super",
        "x-admin-email": "super.admin@origo.local",
      },
      body: form,
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: "Request failed" }));
      throw new Error(errorBody.message || "Request failed");
    }
    const result = await response.json() as { data: UploadRow };
    return result.data;
  }

  const result = await request<{ data: UploadRow }>(`/customers/${customerId}/uploads`, {
    method: "POST",
    body: payload,
  });
  return result.data;
}

export async function reviewUpload(
  customerId: string,
  uploadId: string,
  payload: { review_status: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED"; comment: string; reason: string },
) {
  const result = await request<{ data: UploadRow }>(
    `/customers/${customerId}/uploads/${uploadId}/review`,
    {
      method: "PATCH",
      body: payload,
    },
  );
  return result.data;
}

export async function deleteUpload(customerId: string, uploadId: string, reason: string) {
  await request<void>(`/customers/${customerId}/uploads/${uploadId}`, {
    method: "DELETE",
    body: { reason },
  });
}

export async function listMarketRecords(
  customerId: string,
  filters: { market: string; productType: string; dateFrom: string; dateTo: string },
) {
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value),
  ).toString();
  const result = await request<{ data: MarketRow[] }>(
    `/customers/${customerId}/market-intelligence${query ? `?${query}` : ""}`,
  );
  return result.data;
}

export async function getMarketSourceStatus(customerId: string) {
  const result = await request<{ data: { customer_id: string; company_id: string; source: string; updated_at: string } | null }>(
    `/customers/${customerId}/market-intelligence/source-status`,
  );
  return result.data;
}

export async function setMarketSourceLink(customerId: string, companyId: string) {
  const result = await request<{ data: { customer_id: string; company_id: string } }>(
    `/customers/${customerId}/market-intelligence/link`,
    {
      method: "PUT",
      body: { companyId },
    },
  );
  return result.data;
}

export async function createMarketRecord(
  customerId: string,
  payload: { market: string; product_type: string; metric_date: string; value: number; reason: string },
) {
  const result = await request<{ data: MarketRow }>(`/customers/${customerId}/market-intelligence/records`, {
    method: "POST",
    body: payload,
  });
  return result.data;
}

export async function updateMarketRecord(
  customerId: string,
  recordId: number,
  payload: { market: string; product_type: string; metric_date: string; value: number; reason: string },
) {
  const result = await request<{ data: MarketRow }>(`/customers/${customerId}/market-intelligence/records/${recordId}`, {
    method: "PATCH",
    body: payload,
  });
  return result.data;
}

export async function deleteMarketRecord(customerId: string, recordId: number, reason: string) {
  await request<void>(`/customers/${customerId}/market-intelligence/records/${recordId}`, {
    method: "DELETE",
    body: { reason },
  });
}

export async function listPresets(customerId: string) {
  const result = await request<{ data: Array<{ id: string; name: string; filters_json: Record<string, string> }> }>(
    `/customers/${customerId}/market-intelligence/presets`,
  );
  return result.data;
}

export async function createPreset(
  customerId: string,
  payload: { name: string; filters: { market?: string; productType?: string; dateFrom?: string; dateTo?: string } },
) {
  const result = await request<{ data: unknown }>(
    `/customers/${customerId}/market-intelligence/presets`,
    {
      method: "POST",
      body: payload,
    },
  );
  return result.data;
}

export async function listSessions(customerId: string) {
  const result = await request<{ data: Array<{ id: string; device_label: string; ip_address: string; last_seen_at: string; revoked_at: string | null }> }>(
    `/customers/${customerId}/security/sessions`,
  );
  return result.data;
}

export async function signOutAllSessions(customerId: string, reason: string) {
  const result = await request<{ data: { revoked_sessions: number } }>(
    `/customers/${customerId}/security/sign-out-all`,
    {
      method: "POST",
      body: { reason },
    },
  );
  return result.data;
}

export async function triggerPasswordReset(customerId: string, reason: string) {
  const result = await request<{ data: unknown }>(
    `/customers/${customerId}/account/reset-password`,
    {
      method: "POST",
      body: { reason },
    },
  );
  return result.data;
}

export async function listInventory(customerId: string) {
  const result = await request<{ data: Array<{ id: string; sku: string; product_name: string; qty: number; unit: string; updated_at: string }> }>(
    `/customers/${customerId}/inventory`,
  );
  return result.data;
}

export async function listInvoices(customerId: string) {
  const result = await request<{ data: Array<{ id: string; invoice_no: string; amount: number; currency: string; status: string; due_date: string }> }>(
    `/customers/${customerId}/invoices`,
  );
  return result.data;
}

export async function listAuditLogs(targetId: string) {
  const result = await request<{ data: Array<{ id: number; action: string; actor_email: string; reason: string | null; created_at: string }> }>(
    `/audit-logs?targetId=${encodeURIComponent(targetId)}`,
  );
  return result.data;
}
