import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type {
  ActivityLogRecord,
  ActivityType,
  AdminState,
  AdminUserRecord,
  AdminUserRole,
  AdminUserStatus,
  CustomerRecord,
  CustomerStatus,
  UploadProcessingStatus,
  UploadRecord,
  UploadReviewStatus,
} from "@/types/admin";

const STORAGE_KEY = "origo-admin-state-v1";

interface CreateCustomerInput {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  notes: string;
}

interface UpdateCustomerInput {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  country?: string;
  notes?: string;
  status?: CustomerStatus;
}

interface CreateAdminUserInput {
  name: string;
  email: string;
  role: AdminUserRole;
}

interface UpdateAdminUserInput {
  role?: AdminUserRole;
  status?: AdminUserStatus;
  lastLogin?: string;
}

interface CreateUploadInput {
  fileName: string;
  fileSize: string;
  fileType: string;
  description: string;
  customerId: string;
  uploadedBy: string;
  status?: UploadProcessingStatus;
  reviewStatus?: UploadReviewStatus;
  progress?: number;
}

interface UpdateUploadInput {
  description?: string;
  customerId?: string;
  status?: UploadProcessingStatus;
  reviewStatus?: UploadReviewStatus;
  progress?: number;
}

interface AdminDataContextValue extends AdminState {
  createCustomer: (input: CreateCustomerInput) => string;
  updateCustomer: (id: string, input: UpdateCustomerInput) => void;
  deleteCustomer: (id: string) => void;
  createAdminUser: (input: CreateAdminUserInput) => string;
  updateAdminUser: (id: string, input: UpdateAdminUserInput) => void;
  createUpload: (input: CreateUploadInput) => string;
  updateUpload: (id: string, input: UpdateUploadInput) => void;
  deleteUpload: (id: string) => void;
  createActivityLog: (type: ActivityType, message: string, actor?: string) => void;
  getCustomerName: (customerId: string) => string;
}

type CustomerRow = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  country: string;
  status: CustomerStatus;
  notes: string;
  updated_at: string;
};

type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  last_login: string;
};

type UploadRow = {
  id: string;
  file_name: string;
  file_size: string;
  file_type: string;
  description: string;
  customer_id: string;
  uploaded_by: string;
  uploaded_at: string;
  status: UploadProcessingStatus;
  review_status: UploadReviewStatus;
  progress: number | null;
};

type ActivityRow = {
  id: string;
  type: ActivityType;
  message: string;
  actor: string;
  created_at: string;
};

const defaultState: AdminState = {
  customers: [
    {
      id: "cus-001",
      companyName: "Global Foods GmbH",
      contactName: "Anna Keller",
      email: "anna.keller@globalfoods.example",
      phone: "+49 30 1234 5001",
      country: "Germany",
      status: "active",
      notes: "Focus on coffee and cocoa imports for retail chains.",
      updatedAt: "2026-02-08T09:22:00.000Z",
    },
    {
      id: "cus-002",
      companyName: "Fresh Imports Ltd",
      contactName: "Michael Smith",
      email: "m.smith@freshimports.example",
      phone: "+44 20 7788 2045",
      country: "United Kingdom",
      status: "active",
      notes: "Requires weekly shipment updates and invoice tracking.",
      updatedAt: "2026-02-07T14:30:00.000Z",
    },
    {
      id: "cus-003",
      companyName: "Nordic Trade AB",
      contactName: "Lina Svensson",
      email: "lina.svensson@nordictrade.example",
      phone: "+46 8 400 987 21",
      country: "Sweden",
      status: "paused",
      notes: "Account paused while renegotiating pricing terms.",
      updatedAt: "2026-02-06T11:05:00.000Z",
    },
  ],
  adminUsers: [
    {
      id: "adm-001",
      name: "John Doe",
      email: "john.doe@origo.example",
      role: "owner",
      status: "active",
      lastLogin: "2026-02-10T03:10:00.000Z",
    },
    {
      id: "adm-002",
      name: "Sarah Tan",
      email: "sarah.tan@origo.example",
      role: "manager",
      status: "active",
      lastLogin: "2026-02-09T15:35:00.000Z",
    },
    {
      id: "adm-003",
      name: "Luis Romero",
      email: "luis.romero@origo.example",
      role: "analyst",
      status: "invited",
      lastLogin: "2026-02-05T10:15:00.000Z",
    },
  ],
  uploads: [
    {
      id: "upl-001",
      fileName: "sales_export_jan2024.xlsx",
      fileSize: "2.4 MB",
      fileType: "xlsx",
      description: "January sales shipment and order export for EU market.",
      customerId: "cus-001",
      uploadedBy: "Anna Keller",
      uploadedAt: "2026-02-05T09:20:00.000Z",
      status: "ready",
      reviewStatus: "updated",
    },
    {
      id: "upl-002",
      fileName: "invoices_q4_2023.csv",
      fileSize: "856 KB",
      fileType: "csv",
      description: "Q4 invoices with finance reconciliation notes.",
      customerId: "cus-002",
      uploadedBy: "Michael Smith",
      uploadedAt: "2026-02-06T14:35:00.000Z",
      status: "ready",
      reviewStatus: "pending",
    },
  ],
  activityLogs: [
    {
      id: "act-001",
      type: "upload",
      message: "New upload sales_export_jan2024.xlsx",
      actor: "Anna Keller",
      createdAt: "2026-02-05T09:20:00.000Z",
    },
    {
      id: "act-002",
      type: "customer",
      message: "Customer profile updated for Fresh Imports Ltd",
      actor: "Sarah Tan",
      createdAt: "2026-02-07T11:40:00.000Z",
    },
    {
      id: "act-003",
      type: "user",
      message: "Invited admin user Luis Romero",
      actor: "John Doe",
      createdAt: "2026-02-08T13:05:00.000Z",
    },
  ],
};

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

const generateId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;

const createLog = (type: ActivityType, message: string, actor = "System"): ActivityLogRecord => ({
  id: generateId("act"),
  type,
  message,
  actor,
  createdAt: new Date().toISOString(),
});

const appendLog = (state: AdminState, log: ActivityLogRecord): AdminState => ({
  ...state,
  activityLogs: [log, ...state.activityLogs].slice(0, 60),
});

const isTransientUploadUpdate = (input: UpdateUploadInput) => {
  const keys = Object.keys(input);

  if (keys.length === 1 && keys[0] === "progress") {
    return true;
  }

  return keys.includes("progress") && input.status === "uploading";
};

const toCustomerRecord = (row: CustomerRow): CustomerRecord => ({
  id: row.id,
  companyName: row.company_name,
  contactName: row.contact_name,
  email: row.email,
  phone: row.phone,
  country: row.country,
  status: row.status,
  notes: row.notes,
  updatedAt: row.updated_at,
});

const toCustomerRow = (record: CustomerRecord): CustomerRow => ({
  id: record.id,
  company_name: record.companyName,
  contact_name: record.contactName,
  email: record.email,
  phone: record.phone,
  country: record.country,
  status: record.status,
  notes: record.notes,
  updated_at: record.updatedAt,
});

const toAdminUserRecord = (row: AdminUserRow): AdminUserRecord => ({
  id: row.id,
  name: row.name,
  email: row.email,
  role: row.role,
  status: row.status,
  lastLogin: row.last_login,
});

const toAdminUserRow = (record: AdminUserRecord): AdminUserRow => ({
  id: record.id,
  name: record.name,
  email: record.email,
  role: record.role,
  status: record.status,
  last_login: record.lastLogin,
});

const toUploadRecord = (row: UploadRow): UploadRecord => ({
  id: row.id,
  fileName: row.file_name,
  fileSize: row.file_size,
  fileType: row.file_type,
  description: row.description,
  customerId: row.customer_id,
  uploadedBy: row.uploaded_by,
  uploadedAt: row.uploaded_at,
  status: row.status,
  reviewStatus: row.review_status,
  progress: row.progress ?? undefined,
});

const toUploadRow = (record: UploadRecord): UploadRow => ({
  id: record.id,
  file_name: record.fileName,
  file_size: record.fileSize,
  file_type: record.fileType,
  description: record.description,
  customer_id: record.customerId,
  uploaded_by: record.uploadedBy,
  uploaded_at: record.uploadedAt,
  status: record.status,
  review_status: record.reviewStatus,
  progress: typeof record.progress === "number" ? record.progress : null,
});

const toActivityRecord = (row: ActivityRow): ActivityLogRecord => ({
  id: row.id,
  type: row.type,
  message: row.message,
  actor: row.actor,
  createdAt: row.created_at,
});

const toActivityRow = (record: ActivityLogRecord): ActivityRow => ({
  id: record.id,
  type: record.type,
  message: record.message,
  actor: record.actor,
  created_at: record.createdAt,
});

const normalizeState = (incoming: AdminState): AdminState => {
  const validCustomerIds = new Set(incoming.customers.map((customer) => customer.id));

  return {
    ...incoming,
    uploads: incoming.uploads.filter((upload) => validCustomerIds.has(upload.customerId)),
    activityLogs: incoming.activityLogs.slice(0, 60),
  };
};

const parseStoredState = (): AdminState => {
  if (typeof window === "undefined") {
    return defaultState;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultState;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AdminState>;
    return normalizeState({
      customers: Array.isArray(parsed.customers) ? parsed.customers : defaultState.customers,
      adminUsers: Array.isArray(parsed.adminUsers) ? parsed.adminUsers : defaultState.adminUsers,
      uploads: Array.isArray(parsed.uploads) ? parsed.uploads : defaultState.uploads,
      activityLogs: Array.isArray(parsed.activityLogs) ? parsed.activityLogs : defaultState.activityLogs,
    });
  } catch {
    return defaultState;
  }
};

const seedSupabaseIfNeeded = async () => {
  if (!supabase) {
    return;
  }

  await supabase.from("customers").upsert(defaultState.customers.map(toCustomerRow));
  await supabase.from("admin_users").upsert(defaultState.adminUsers.map(toAdminUserRow));
  await supabase.from("uploads").upsert(defaultState.uploads.map(toUploadRow));
  await supabase.from("activity_logs").upsert(defaultState.activityLogs.map(toActivityRow));
};

const loadStateFromSupabase = async (): Promise<AdminState | null> => {
  if (!supabase) {
    return null;
  }

  const [customerResult, adminUserResult, uploadResult, activityResult] = await Promise.all([
    supabase.from("customers").select("*").order("updated_at", { ascending: false }),
    supabase.from("admin_users").select("*").order("last_login", { ascending: false }),
    supabase.from("uploads").select("*").order("uploaded_at", { ascending: false }),
    supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(60),
  ]);

  if (customerResult.error || adminUserResult.error || uploadResult.error || activityResult.error) {
    console.error("Supabase load error", {
      customers: customerResult.error,
      adminUsers: adminUserResult.error,
      uploads: uploadResult.error,
      activityLogs: activityResult.error,
    });
    return null;
  }

  const customerRows = (customerResult.data ?? []) as CustomerRow[];
  const adminUserRows = (adminUserResult.data ?? []) as AdminUserRow[];
  const uploadRows = (uploadResult.data ?? []) as UploadRow[];
  const activityRows = (activityResult.data ?? []) as ActivityRow[];

  const hasRemoteData =
    customerRows.length > 0 || adminUserRows.length > 0 || uploadRows.length > 0 || activityRows.length > 0;

  if (!hasRemoteData) {
    await seedSupabaseIfNeeded();
    return defaultState;
  }

  const state: AdminState = {
    customers: customerRows.map(toCustomerRecord),
    adminUsers: adminUserRows.map(toAdminUserRecord),
    uploads: uploadRows.map(toUploadRecord),
    activityLogs: activityRows.map(toActivityRecord),
  };

  return normalizeState(state);
};

const syncLogToSupabase = async (log: ActivityLogRecord) => {
  if (!supabase) {
    return;
  }

  await supabase.from("activity_logs").upsert(toActivityRow(log));
};

export function AdminDataProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AdminState>(() => parseStoredState());

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    let cancelled = false;

    const syncFromSupabase = async () => {
      const remoteState = await loadStateFromSupabase();
      if (!cancelled && remoteState) {
        setState(remoteState);
      }
    };

    void syncFromSupabase();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AdminDataContextValue>(
    () => ({
      ...state,
      createCustomer: (input) => {
        const customer: CustomerRecord = {
          id: generateId("cus"),
          companyName: input.companyName.trim(),
          contactName: input.contactName.trim(),
          email: input.email.trim(),
          phone: input.phone.trim(),
          country: input.country.trim(),
          notes: input.notes.trim(),
          status: "active",
          updatedAt: new Date().toISOString(),
        };

        const log = createLog("customer", `Created customer ${customer.companyName}`, "Back Office");

        setState((prev) =>
          appendLog(
            {
              ...prev,
              customers: [customer, ...prev.customers],
            },
            log,
          ),
        );

        if (supabase) {
          void Promise.all([
            supabase.from("customers").upsert(toCustomerRow(customer)),
            syncLogToSupabase(log),
          ]);
        }

        return customer.id;
      },
      updateCustomer: (id, input) => {
        const target = state.customers.find((customer) => customer.id === id);
        if (!target) {
          return;
        }

        const updatedCustomer: CustomerRecord = {
          ...target,
          ...input,
          companyName: input.companyName?.trim() ?? target.companyName,
          contactName: input.contactName?.trim() ?? target.contactName,
          email: input.email?.trim() ?? target.email,
          phone: input.phone?.trim() ?? target.phone,
          country: input.country?.trim() ?? target.country,
          notes: input.notes?.trim() ?? target.notes,
          updatedAt: new Date().toISOString(),
        };

        const log = createLog("customer", `Updated customer ${target.companyName}`, "Back Office");

        setState((prev) =>
          appendLog(
            {
              ...prev,
              customers: prev.customers.map((customer) =>
                customer.id === id ? updatedCustomer : customer,
              ),
            },
            log,
          ),
        );

        if (supabase) {
          void Promise.all([
            supabase.from("customers").upsert(toCustomerRow(updatedCustomer)),
            syncLogToSupabase(log),
          ]);
        }
      },
      deleteCustomer: (id) => {
        const target = state.customers.find((customer) => customer.id === id);
        if (!target) {
          return;
        }

        const log = createLog(
          "customer",
          `Deleted customer ${target.companyName} and linked uploads`,
          "Back Office",
        );

        setState((prev) =>
          appendLog(
            {
              ...prev,
              customers: prev.customers.filter((customer) => customer.id !== id),
              uploads: prev.uploads.filter((upload) => upload.customerId !== id),
            },
            log,
          ),
        );

        if (supabase) {
          void Promise.all([
            supabase.from("customers").delete().eq("id", id),
            syncLogToSupabase(log),
          ]);
        }
      },
      createAdminUser: (input) => {
        const user: AdminUserRecord = {
          id: generateId("adm"),
          name: input.name.trim(),
          email: input.email.trim(),
          role: input.role,
          status: "invited",
          lastLogin: new Date().toISOString(),
        };

        const log = createLog("user", `Invited admin user ${user.name}`, "Back Office");

        setState((prev) =>
          appendLog(
            {
              ...prev,
              adminUsers: [user, ...prev.adminUsers],
            },
            log,
          ),
        );

        if (supabase) {
          void Promise.all([
            supabase.from("admin_users").upsert(toAdminUserRow(user)),
            syncLogToSupabase(log),
          ]);
        }

        return user.id;
      },
      updateAdminUser: (id, input) => {
        const target = state.adminUsers.find((user) => user.id === id);
        if (!target) {
          return;
        }

        const updatedUser: AdminUserRecord = {
          ...target,
          ...input,
        };

        const log = createLog("user", `Updated admin user ${target.name}`, "Back Office");

        setState((prev) =>
          appendLog(
            {
              ...prev,
              adminUsers: prev.adminUsers.map((user) => (user.id === id ? updatedUser : user)),
            },
            log,
          ),
        );

        if (supabase) {
          void Promise.all([
            supabase.from("admin_users").upsert(toAdminUserRow(updatedUser)),
            syncLogToSupabase(log),
          ]);
        }
      },
      createUpload: (input) => {
        if (!input.customerId.trim()) {
          return "";
        }

        const customerExists = state.customers.some((customer) => customer.id === input.customerId);
        if (!customerExists) {
          return "";
        }

        const upload: UploadRecord = {
          id: generateId("upl"),
          fileName: input.fileName,
          fileSize: input.fileSize,
          fileType: input.fileType,
          description: input.description.trim(),
          customerId: input.customerId,
          uploadedBy: input.uploadedBy,
          uploadedAt: new Date().toISOString(),
          status: input.status ?? "uploading",
          reviewStatus: input.reviewStatus ?? "pending",
          progress: input.progress,
        };

        const log = createLog("upload", `New upload ${upload.fileName}`, upload.uploadedBy);

        setState((prev) =>
          appendLog(
            {
              ...prev,
              uploads: [upload, ...prev.uploads],
            },
            log,
          ),
        );

        if (supabase) {
          void Promise.all([
            supabase.from("uploads").upsert(toUploadRow(upload)),
            syncLogToSupabase(log),
          ]);
        }

        return upload.id;
      },
      updateUpload: (id, input) => {
        const target = state.uploads.find((upload) => upload.id === id);
        if (!target) {
          return;
        }

        if (input.customerId !== undefined) {
          const customerExists = state.customers.some((customer) => customer.id === input.customerId);
          if (!customerExists) {
            return;
          }
        }

        const updatedUpload: UploadRecord = {
          ...target,
          ...input,
          description: input.description?.trim() ?? target.description,
        };

        const shouldSkipLog = isTransientUploadUpdate(input);
        const log = createLog("upload", `Updated upload ${target.fileName}`, "Back Office");

        setState((prev) => {
          const nextState = {
            ...prev,
            uploads: prev.uploads.map((upload) => (upload.id === id ? updatedUpload : upload)),
          };

          return shouldSkipLog ? nextState : appendLog(nextState, log);
        });

        if (supabase && !shouldSkipLog) {
          void Promise.all([
            supabase.from("uploads").upsert(toUploadRow(updatedUpload)),
            syncLogToSupabase(log),
          ]);
        }
      },
      deleteUpload: (id) => {
        const target = state.uploads.find((upload) => upload.id === id);
        if (!target) {
          return;
        }

        const log = createLog("upload", `Removed upload ${target.fileName}`, "Back Office");

        setState((prev) =>
          appendLog(
            {
              ...prev,
              uploads: prev.uploads.filter((upload) => upload.id !== id),
            },
            log,
          ),
        );

        if (supabase) {
          void Promise.all([
            supabase.from("uploads").delete().eq("id", id),
            syncLogToSupabase(log),
          ]);
        }
      },
      createActivityLog: (type, message, actor = "Back Office") => {
        const log = createLog(type, message, actor);
        setState((prev) => appendLog(prev, log));

        if (supabase) {
          void syncLogToSupabase(log);
        }
      },
      getCustomerName: (customerId) => {
        const customer = state.customers.find((item) => item.id === customerId);
        return customer?.companyName ?? "Unassigned";
      },
    }),
    [state],
  );

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData() {
  const context = useContext(AdminDataContext);

  if (!context) {
    throw new Error("useAdminData must be used within an AdminDataProvider");
  }

  return context;
}
