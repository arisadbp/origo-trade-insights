export type CustomerStatus = "active" | "paused";
export type AdminUserRole = "owner" | "manager" | "analyst";
export type AdminUserStatus = "active" | "invited" | "disabled";
export type UploadProcessingStatus = "uploading" | "processing" | "ready" | "error";
export type UploadReviewStatus = "updated" | "pending" | "cancel";

export interface CustomerRecord {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  country: string;
  status: CustomerStatus;
  notes: string;
  updatedAt: string;
}

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  lastLogin: string;
}

export interface UploadRecord {
  id: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  description: string;
  customerId: string;
  uploadedBy: string;
  uploadedAt: string;
  status: UploadProcessingStatus;
  reviewStatus: UploadReviewStatus;
  progress?: number;
}

export type ActivityType = "customer" | "upload" | "user";

export interface ActivityLogRecord {
  id: string;
  type: ActivityType;
  message: string;
  actor: string;
  createdAt: string;
}

export interface AdminState {
  customers: CustomerRecord[];
  adminUsers: AdminUserRecord[];
  uploads: UploadRecord[];
  activityLogs: ActivityLogRecord[];
}
