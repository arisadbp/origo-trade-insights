import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  CalendarDays,
  FileSpreadsheet,
  FileText,
  Search,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/layout/TopBar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAdminData } from "@/contexts/AdminDataContext";
import { useAuth } from "@/contexts/AuthContext";

const formatUploadDate = (isoDate: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoDate));

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

const badgeByStatus: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ready: "default",
  processing: "secondary",
  uploading: "outline",
  error: "destructive",
};

const reviewBadgeByStatus: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  updated: "default",
  pending: "secondary",
  cancel: "destructive",
};

export default function UploadCenter() {
  const { customers, uploads, createUpload, updateUpload, getCustomerName } = useAdminData();
  const { email, displayName } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadContext, setUploadContext] = useState("");
  const [contextError, setContextError] = useState("");
  const [fileSearch, setFileSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const linkedCustomer = useMemo(
    () =>
      customers.find(
        (customer) => customer.email.trim().toLowerCase() === email.trim().toLowerCase(),
      ),
    [customers, email],
  );
  const linkedCustomerId = linkedCustomer?.id ?? "";
  const linkedCustomerName = linkedCustomer?.companyName ?? "Unassigned account";
  const linkedUploads = useMemo(
    () => uploads.filter((file) => linkedCustomerId && file.customerId === linkedCustomerId),
    [uploads, linkedCustomerId],
  );

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const startUpload = (incomingFile?: File) => {
    if (!linkedCustomerId) {
      setContextError("Your account is not activated by ORIGO yet. Please contact ORIGO to enable uploads.");
      return;
    }

    const description = uploadContext.trim();
    if (!description) {
      setContextError("Please describe what this file is about before uploading.");
      return;
    }

    const fileName = incomingFile?.name ?? "new_upload.xlsx";
    const fileSize = incomingFile ? formatBytes(incomingFile.size) : "1.2 MB";
    const fileType = fileName.split(".").pop()?.toLowerCase() ?? "file";
    const uploadId = createUpload({
      fileName,
      fileSize,
      fileType,
      description,
      customerId: linkedCustomerId,
      uploadedBy: displayName || "Customer",
      status: "uploading",
      reviewStatus: "pending",
      progress: 0,
    });

    if (!uploadId) {
      setContextError("Upload failed: account is not linked to an ORIGO customer user.");
      return;
    }

    setUploadContext("");
    setContextError("");

    let progress = 0;
    const interval = window.setInterval(() => {
      progress += 20;

      if (progress >= 100) {
        window.clearInterval(interval);
        updateUpload(uploadId, {
          status: "ready",
          progress: undefined,
        });
        return;
      }

      updateUpload(uploadId, {
        status: "uploading",
        progress,
      });
    }, 450);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    startUpload(dropped);
  };

  const handleFileBrowse = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) {
      startUpload(selected);
    }
    event.target.value = "";
  };

  const filteredFiles = useMemo(() => {
    const keyword = fileSearch.trim().toLowerCase();
    const sorted = [...linkedUploads].sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
    );

    if (!keyword) {
      return sorted;
    }

    return sorted.filter((file) =>
      [
        file.fileName,
        file.description,
        file.reviewStatus,
        file.status,
        getCustomerName(file.customerId),
        formatUploadDate(file.uploadedAt),
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [linkedUploads, fileSearch, getCustomerName]);

  const getFileIcon = (type: string) => {
    if (type === "xlsx" || type === "xls") return FileSpreadsheet;
    return FileText;
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar title="Admin Control" subtitle="Upload files for ORIGO review and data updates" />

      <div className="flex-1 space-y-6 overflow-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
        <section className="rounded-2xl border bg-card px-6 py-12 text-center md:px-10 md:py-16">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Customer Upload Gateway
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-sm text-muted-foreground md:text-base">
            Files uploaded here are sent to ORIGO Back Office for verification and data updates.
          </p>
        </section>

        <div
          className={cn(
            "rounded-2xl border-2 border-dashed p-6 text-center transition-all md:p-10",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border bg-card hover:border-primary/50",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="mx-auto mb-6 w-full max-w-3xl text-left">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer profile</p>
            <p className="rounded-xl border bg-background/70 px-3 py-2 text-sm font-medium text-foreground">
              {linkedCustomerName}
            </p>
            {!linkedCustomerId && (
              <p className="mt-2 text-xs text-muted-foreground">
                This account is not linked to a customer profile yet. ORIGO will assign it during review.
              </p>
            )}

            <label className="mb-2 mt-4 block text-sm font-medium text-foreground">What is this file about?</label>
            <Input
              value={uploadContext}
              onChange={(event) => {
                setUploadContext(event.target.value);
                if (contextError && event.target.value.trim()) {
                  setContextError("");
                }
              }}
              placeholder="Example: February shipment + inventory sync"
              className="h-11 rounded-xl bg-background/80"
            />
            {contextError && <p className="mt-2 text-xs text-destructive">{contextError}</p>}
          </div>

          <div className="flex flex-col items-center gap-4">
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full transition-colors",
                isDragging ? "bg-primary/20" : "bg-muted",
              )}
            >
              <Upload className={cn("h-8 w-8", isDragging ? "text-primary" : "text-muted-foreground")} />
            </div>
            <div>
              <p className="text-lg font-medium">
                {isDragging ? "Drop your file here" : "Drag and drop files here"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Files sync directly to back office.</p>
            </div>

            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileBrowse} />
            <Button
              variant="outline"
              className="mt-2 rounded-full px-6"
              onClick={() => fileInputRef.current?.click()}
              disabled={!linkedCustomerId}
            >
              Browse Files
            </Button>

            <p className="mt-2 text-xs text-muted-foreground">
              Supported: .xlsx, .xls, .csv, .json | Max file size: 50MB
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold">Uploaded Files</h2>
              <p className="text-sm text-muted-foreground">{filteredFiles.length}/{linkedUploads.length} files</p>
            </div>

            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={fileSearch}
                onChange={(event) => setFileSearch(event.target.value)}
                placeholder="Search files, description, review..."
                className="h-10 rounded-xl bg-card pl-9"
              />
            </div>
          </div>

          {filteredFiles.length === 0 && (
            <div className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
              No files found for "{fileSearch}".
            </div>
          )}

          {filteredFiles.map((file) => {
            const FileIcon = getFileIcon(file.fileType);

            return (
              <div key={file.id} className="rounded-2xl border bg-card/90 p-4 shadow-sm md:p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-muted">
                    <FileIcon className="h-6 w-6 text-muted-foreground" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{file.fileName}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span>{file.fileSize}</span>
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatUploadDate(file.uploadedAt)}
                          </span>
                          <span>{getCustomerName(file.customerId)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-secondary/50 px-3 py-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p>
                      <p className="mt-1 text-sm text-foreground">{file.description}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={badgeByStatus[file.status] ?? "outline"}>{file.status}</Badge>
                      <Badge variant={reviewBadgeByStatus[file.reviewStatus] ?? "secondary"}>
                        ORIGO review: {file.reviewStatus}
                      </Badge>
                    </div>

                    {file.status === "uploading" && typeof file.progress === "number" && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Uploading...</span>
                          <span>{file.progress}%</span>
                        </div>
                        <Progress value={file.progress} className="h-2" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
