import { useRef, useState, type CSSProperties } from "react";
import {
  Upload,
  FileText,
  X,
  FileSpreadsheet,
  RefreshCw,
  CalendarDays,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/layout/TopBar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FileProcessingStatus = "uploading" | "processing" | "ready" | "error";
type AdminReviewStatus = "updated" | "pending" | "cancel";

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  type: string;
  status: FileProcessingStatus;
  reviewStatus: AdminReviewStatus;
  uploadedAt: string;
  about: string;
  progress?: number;
}

const reviewOptions: AdminReviewStatus[] = ["updated", "pending", "cancel"];

const reviewTheme: Record<
  AdminReviewStatus,
  {
    activeBg: string;
    activeBorder: string;
    inactiveBg: string;
    inactiveBorder: string;
    text: string;
  }
> = {
  updated: {
    activeBg: "#059669",
    activeBorder: "#047857",
    inactiveBg: "#ecfdf5",
    inactiveBorder: "#a7f3d0",
    text: "#065f46",
  },
  pending: {
    activeBg: "#d97706",
    activeBorder: "#b45309",
    inactiveBg: "#fffbeb",
    inactiveBorder: "#fde68a",
    text: "#92400e",
  },
  cancel: {
    activeBg: "#e11d48",
    activeBorder: "#be123c",
    inactiveBg: "#fff1f2",
    inactiveBorder: "#fecdd3",
    text: "#9f1239",
  },
};

const getReviewOptionStyle = (
  option: AdminReviewStatus,
  isActive: boolean,
): CSSProperties => {
  const theme = reviewTheme[option];
  return isActive
    ? {
        backgroundColor: theme.activeBg,
        borderColor: theme.activeBorder,
        color: "#ffffff",
        boxShadow: "0 0 0 2px rgba(255,255,255,0.9), 0 0 0 4px rgba(15,23,42,0.08)",
      }
    : {
        backgroundColor: theme.inactiveBg,
        borderColor: theme.inactiveBorder,
        color: theme.text,
      };
};

const getReviewBadgeStyle = (status: AdminReviewStatus): CSSProperties => {
  const theme = reviewTheme[status];
  return {
    backgroundColor: theme.activeBg,
    borderColor: theme.activeBorder,
    color: "#ffffff",
  };
};

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

export default function UploadCenter() {
  const [files, setFiles] = useState<UploadedFile[]>([
    {
      id: "1",
      name: "sales_export_jan2024.xlsx",
      size: "2.4 MB",
      type: "xlsx",
      status: "ready",
      reviewStatus: "updated",
      uploadedAt: "2026-02-05T09:20:00.000Z",
      about: "January sales shipment and order export for EU market.",
    },
    {
      id: "2",
      name: "invoices_q4_2023.csv",
      size: "856 KB",
      type: "csv",
      status: "ready",
      reviewStatus: "pending",
      uploadedAt: "2026-02-06T14:35:00.000Z",
      about: "Q4 invoices with finance reconciliation notes.",
    },
  ]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadContext, setUploadContext] = useState("");
  const [contextError, setContextError] = useState("");
  const [fileSearch, setFileSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const createUpload = (incomingFile?: File) => {
    const trimmedContext = uploadContext.trim();
    if (!trimmedContext) {
      setContextError("Please tell us what this file is about before uploading.");
      return;
    }

    const nowIso = new Date().toISOString();
    const fileName = incomingFile?.name ?? "new_upload.xlsx";
    const size = incomingFile ? formatBytes(incomingFile.size) : "1.2 MB";
    const extension = fileName.split(".").pop()?.toLowerCase() ?? "file";

    const newFile: UploadedFile = {
      id: Date.now().toString(),
      name: fileName,
      size,
      type: extension,
      status: "uploading",
      reviewStatus: "pending",
      uploadedAt: nowIso,
      about: trimmedContext,
      progress: 0,
    };

    setFiles((prev) => [newFile, ...prev]);
    setUploadContext("");
    setContextError("");

    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      if (progress >= 100) {
        clearInterval(interval);
        setFiles((prev) =>
          prev.map((file) =>
            file.id === newFile.id
              ? {
                  ...file,
                  status: "ready",
                  progress: undefined,
                }
              : file,
          ),
        );
      } else {
        setFiles((prev) =>
          prev.map((file) =>
            file.id === newFile.id ? { ...file, progress } : file,
          ),
        );
      }
    }, 450);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    createUpload(dropped);
  };

  const handleFileBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) createUpload(selected);
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const updateReviewStatus = (id: string, status: AdminReviewStatus) => {
    setFiles((prev) =>
      prev.map((file) => (file.id === id ? { ...file, reviewStatus: status } : file)),
    );
  };

  const getFileIcon = (type: string) => {
    if (type === "xlsx" || type === "xls") return FileSpreadsheet;
    return FileText;
  };

  const filteredFiles = files.filter((file) => {
    const keyword = fileSearch.trim().toLowerCase();
    if (!keyword) return true;

    return (
      file.name.toLowerCase().includes(keyword) ||
      file.about.toLowerCase().includes(keyword) ||
      file.reviewStatus.toLowerCase().includes(keyword) ||
      formatUploadDate(file.uploadedAt).toLowerCase().includes(keyword)
    );
  });

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Admin Center"
        subtitle="Upload and process your trade data files"
        showSearch={false}
      />

      <div className="flex-1 overflow-auto p-4 pb-6 md:p-6 space-y-6">
        <section className="rounded-2xl border bg-card px-6 py-12 text-center md:px-10 md:py-16">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
            Star with me now?
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground md:text-lg">
            Shipments, finance, inventory. One dashboard. Clear performance.
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
          <div className="mx-auto mb-6 w-full max-w-2xl text-left">
            <label className="mb-2 block text-sm font-medium text-foreground">
              What is this file about?
            </label>
            <Input
              value={uploadContext}
              onChange={(e) => {
                setUploadContext(e.target.value);
                if (contextError && e.target.value.trim()) {
                  setContextError("");
                }
              }}
              placeholder="Example: February shipment + inventory sync for EU warehouse"
              className="h-11 rounded-xl bg-background/80"
            />
            {contextError && (
              <p className="mt-2 text-xs text-destructive">{contextError}</p>
            )}
          </div>

          <div className="flex flex-col items-center gap-4">
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full transition-colors",
                isDragging ? "bg-primary/20" : "bg-muted",
              )}
            >
              <Upload
                className={cn(
                  "h-8 w-8",
                  isDragging ? "text-primary" : "text-muted-foreground",
                )}
              />
            </div>
            <div>
              <p className="text-lg font-medium">
                {isDragging ? "Drop your file here" : "Drag & drop files here"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add context first, then upload.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileBrowse}
            />
            <Button
              variant="outline"
              className="mt-2 rounded-full px-6"
              onClick={() => fileInputRef.current?.click()}
            >
              Browse Files
            </Button>

            <p className="mt-2 text-xs text-muted-foreground">
              Supported formats: .xlsx, .xls, .csv, .json • Max file size: 50MB
            </p>
          </div>
        </div>

        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold">Uploaded Files</h2>
                <p className="text-sm text-muted-foreground">
                  Admin can update status per file for backend workflow.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {filteredFiles.length}/{files.length} files
              </p>
            </div>

            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                placeholder="Search files, description, status, date..."
                className="h-10 rounded-xl bg-card pl-9"
              />
            </div>

            <div className="space-y-3">
              {filteredFiles.map((file) => {
                const FileIcon = getFileIcon(file.type);

                return (
                  <div
                    key={file.id}
                    className="animate-fade-in rounded-2xl border bg-card/90 p-4 shadow-sm md:p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-muted">
                        <FileIcon className="h-6 w-6 text-muted-foreground" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{file.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                              <span>{file.size}</span>
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="h-3.5 w-3.5" />
                                {formatUploadDate(file.uploadedAt)}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="flex-shrink-0"
                            onClick={() => removeFile(file.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="rounded-xl bg-secondary/50 px-3 py-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            About this file
                          </p>
                          <p className="mt-1 text-sm text-foreground">{file.about}</p>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="inline-flex items-center gap-1 rounded-full bg-secondary/70 p-1">
                            {reviewOptions.map((option) => (
                              <button
                                key={option}
                                type="button"
                                aria-pressed={file.reviewStatus === option}
                                onClick={() => updateReviewStatus(file.id, option)}
                                style={getReviewOptionStyle(
                                  option,
                                  file.reviewStatus === option,
                                )}
                                className={cn(
                                  "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors focus-visible:outline-none",
                                )}
                              >
                                {option}
                              </button>
                            ))}
                          </div>

                          <span
                            style={getReviewBadgeStyle(file.reviewStatus)}
                            className={cn(
                              "inline-flex rounded-full border px-3 py-1 text-xs font-medium capitalize",
                            )}
                          >
                            {file.reviewStatus}
                          </span>
                        </div>

                        {file.status === "uploading" && file.progress !== undefined && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Uploading...</span>
                              <span>{file.progress}%</span>
                            </div>
                            <Progress value={file.progress} className="h-2" />
                          </div>
                        )}

                        {file.status === "processing" && (
                          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            <span>Processing file...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredFiles.length === 0 && (
                <div className="rounded-2xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
                  No files found for "{fileSearch}".
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
