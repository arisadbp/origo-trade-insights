import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CalendarDays, CheckCircle2, Clock3, Eye, FileSearch, ImagePlus, UploadCloud } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import {
  createProductRequest,
  loadProductRequests,
  loadReadyPageProducts,
  statusHintMap,
  statusLabelMap,
  updateProductRequest,
  type ProductRequestRecord,
  type ProductRequestStatus,
  type ReadyPageProduct,
} from "@/lib/yourProductData";

const STATUS_STYLE: Record<ProductRequestStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-50 text-slate-700",
  PENDING_REVIEW: "border-blue-200 bg-blue-50 text-blue-700",
  NEED_MORE_INFO: "border-amber-200 bg-amber-50 text-amber-700",
  READY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  UNLOCKED: "border-violet-200 bg-violet-50 text-violet-700",
  NOT_SUPPORTED: "border-rose-200 bg-rose-50 text-rose-700",
};

const getStatusIcon = (status: ProductRequestStatus) => {
  if (status === "READY") return CheckCircle2;
  if (status === "PENDING_REVIEW") return Clock3;
  if (status === "NEED_MORE_INFO") return AlertCircle;
  return null;
};

const isReadyRequest = (status: ProductRequestStatus) => status === "READY" || status === "UNLOCKED";

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read file"));
    reader.readAsDataURL(file);
  });

export default function YourProduct() {
  const { toast } = useToast();
  const { email, username } = useAuth();

  const [workspaceName, setWorkspaceName] = useState("THAI ROONG RUANG INDUSTRY CO., LTD.");
  const [readyRows, setReadyRows] = useState<ReadyPageProduct[]>([]);
  const [requests, setRequests] = useState<ProductRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(false);

  const [productName, setProductName] = useState("");
  const [hsCode, setHsCode] = useState("");
  const [productDetails, setProductDetails] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isImageDragging, setIsImageDragging] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [editProductName, setEditProductName] = useState("");
  const [editHsCode, setEditHsCode] = useState("");
  const [editTargetMarket, setEditTargetMarket] = useState("");
  const [editProductDetails, setEditProductDetails] = useState("");
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [isEditImageDragging, setIsEditImageDragging] = useState(false);
  const editImageInputRef = useRef<HTMLInputElement | null>(null);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [readyResult, requestResult] = await Promise.all([
        loadReadyPageProducts(),
        loadProductRequests(),
      ]);

      setReadyRows(readyResult.rows);
      setRequests(requestResult.rows);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load product data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !email) {
      return;
    }

    let cancelled = false;

    const loadWorkspace = async () => {
      const { data, error: workspaceError } = await supabase
        .from("customers")
        .select("company_name")
        .eq("email", email)
        .maybeSingle();

      if (!cancelled && !workspaceError && data?.company_name) {
        setWorkspaceName(data.company_name);
      }
    };

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [email]);

  const customerRequests = useMemo(() => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return requests;

    return requests.filter((request) => request.customer_email.trim().toLowerCase() === normalizedEmail);
  }, [requests, email]);

  useEffect(() => {
    if (customerRequests.length === 0) {
      setSelectedRequestId(null);
      return;
    }

    setSelectedRequestId((current) => {
      if (current && customerRequests.some((row) => row.id === current)) {
        return current;
      }
      return customerRequests[0].id;
    });
  }, [customerRequests]);

  const selectedRequest = useMemo(
    () => customerRequests.find((row) => row.id === selectedRequestId) ?? null,
    [customerRequests, selectedRequestId],
  );

  const galleryRequests = useMemo(
    () =>
      customerRequests
        .filter((row) => isReadyRequest(row.status))
        .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)),
    [customerRequests],
  );

  const activeRequests = useMemo(
    () =>
      customerRequests
        .filter((row) => !isReadyRequest(row.status))
        .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)),
    [customerRequests],
  );

  const requestStats = useMemo(() => {
    const total = customerRequests.length;
    const ready = customerRequests.filter((row) => isReadyRequest(row.status)).length;
    const needInfo = customerRequests.filter((row) => row.status === "NEED_MORE_INFO").length;
    return { total, ready, needInfo };
  }, [customerRequests]);

  const canEditSelectedRequest =
    selectedRequest?.status === "NEED_MORE_INFO" || selectedRequest?.status === "PENDING_REVIEW";

  useEffect(() => {
    if (!selectedRequest) {
      setEditProductName("");
      setEditHsCode("");
      setEditTargetMarket("");
      setEditProductDetails("");
      setEditImageFile(null);
      setEditImageUrl(null);
      setEditingRequest(false);
      return;
    }

    setEditProductName(selectedRequest.product_name || "");
    setEditHsCode(selectedRequest.hs_code || "");
    setEditTargetMarket(selectedRequest.target_market || "");
    setEditProductDetails(selectedRequest.product_details || "");
    setEditImageFile(null);
    setEditImageUrl(selectedRequest.image_url || null);
    setEditingRequest(false);
  }, [selectedRequest]);

  const handleSubmit = async () => {
    const normalizedName = productName.trim();
    if (!normalizedName) {
      toast({
        title: "Product name is required",
        description: "Please add product name before submit.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSubmitting(true);
      let imageDataUrl: string | undefined;
      if (imageFile) {
        imageDataUrl = await toDataUrl(imageFile);
      }

      const created = await createProductRequest(
        {
          customer_email: email,
          customer_username: username,
          customer_workspace: workspaceName,
          product_name: normalizedName,
          hs_code: hsCode,
          product_details: productDetails,
          target_market: targetMarket,
          image_url: imageDataUrl,
          image_file_name: imageFile?.name,
        },
        readyRows,
      );

      setRequests((prev) => [created, ...prev]);
      setSelectedRequestId(created.id);

      setProductName("");
      setHsCode("");
      setProductDetails("");
      setTargetMarket("");
      setImageFile(null);

      toast({
        title: "Submitted for review",
        description: "Status is now Pending review.",
      });
    } catch (submitError) {
      toast({
        title: "Submit failed",
        description: submitError instanceof Error ? submitError.message : "Unable to submit product",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const applyImageFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.toLowerCase().startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }
    setImageFile(file);
  };

  const applyEditImageFile = (file?: File | null) => {
    if (!file) return;
    if (!file.type.toLowerCase().startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file.",
        variant: "destructive",
      });
      return;
    }
    setEditImageFile(file);
  };

  const submitEditedRequest = async () => {
    if (!selectedRequest) return;

    const normalizedName = editProductName.trim();
    if (!normalizedName) {
      toast({
        title: "Product name is required",
        description: "Please add product name before submit.",
        variant: "destructive",
      });
      return;
    }

    try {
      setEditingRequest(true);
      const imageDataUrl = editImageFile ? await toDataUrl(editImageFile) : editImageUrl;
      const updated = await updateProductRequest(
        selectedRequest.id,
        {
          product_name: normalizedName,
          hs_code: editHsCode,
          target_market: editTargetMarket,
          product_details: editProductDetails,
          image_url: imageDataUrl ?? null,
          image_file_name: editImageFile?.name ?? selectedRequest.image_file_name,
          status: "PENDING_REVIEW",
          updated_by: "Customer",
          customer_message: "Customer updated details and resubmitted for ORIGO review.",
          missing_info_checklist: {
            packaging: false,
            application: false,
            target_market: false,
            material: false,
          },
        },
        readyRows,
      );

      if (!updated) {
        throw new Error("Request not found");
      }

      setRequests((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setSelectedRequestId(updated.id);
      setEditImageFile(null);
      setEditImageUrl(updated.image_url);
      toast({
        title:
          selectedRequest.status === "NEED_MORE_INFO"
            ? "Resubmitted to Pending review"
            : "Request updated",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unable to update request",
        variant: "destructive",
      });
    } finally {
      setEditingRequest(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="YOUR Product"
        subtitle="Manage submitted products and review status updates"
      />

      <div className="flex-1 space-y-5 overflow-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
        <section className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(135deg,#ffffff_0%,#fffdf7_55%,#fff7e1_100%)] px-4 py-4 shadow-[0_14px_30px_-24px_rgba(148,95,0,0.35)] md:px-5 md:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Product Intelligence</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Submit, review, and unlock buyer opportunity</h2>
              <p className="mt-1 text-sm text-slate-600">
                Submit product data once.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Requests</p>
                <p className="text-lg font-semibold text-slate-900">{requestStats.total}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-emerald-700">Ready</p>
                <p className="text-lg font-semibold text-emerald-800">{requestStats.ready}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-amber-700">Need Info</p>
                <p className="text-lg font-semibold text-amber-800">{requestStats.needInfo}</p>
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              Workspace: {workspaceName}
            </span>
          </div>
        </section>

        <section className="rounded-2xl border bg-card/90 backdrop-blur">
          <div className="border-b border-border/70 px-4 py-4 md:px-5">
            <h3 className="text-base font-semibold">Gallery View</h3>
            <p className="text-sm text-muted-foreground">Ready and unlocked products only.</p>
          </div>

          {loading ? (
            <div className="px-4 py-6 text-sm text-muted-foreground md:px-5">Loading products...</div>
          ) : error ? (
            <div className="px-4 py-6 text-sm text-destructive md:px-5">{error}</div>
          ) : galleryRequests.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground md:px-5">No ready products yet.</div>
          ) : (
            <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {galleryRequests.map((request) => {
                const StatusIcon = getStatusIcon(request.status);
                const isReady = isReadyRequest(request.status);
                return (
                  <article
                    key={`gallery-${request.id}`}
                    className={cn(
                      "rounded-xl border border-border/70 bg-card px-3.5 py-3",
                      isReady && "border-emerald-200 bg-emerald-50/30",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        {request.image_url ? (
                          <img
                            src={request.image_url}
                            alt={request.product_name}
                            className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                            <FileSearch className="h-4 w-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{request.product_name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            HS {request.hs_code || "-"} · {formatDateTime(request.submitted_at)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{statusHintMap[request.status]}</p>
                        </div>
                      </div>
                      <Badge className={cn("inline-flex h-8 items-center gap-1.5 whitespace-nowrap px-3 text-sm font-semibold", STATUS_STYLE[request.status])}>
                        {StatusIcon ? <StatusIcon className="h-4 w-4" /> : null}
                        {statusLabelMap[request.status]}
                      </Badge>
                    </div>

                    <div className="mt-2 flex items-center justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-full"
                        onClick={() => {
                          setSelectedRequestId(request.id);
                          setIsPreviewOpen(true);
                        }}
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        View
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
          <section className="rounded-2xl border bg-card/90 backdrop-blur">
            <div className="border-b border-border/70 px-4 py-4 md:px-5">
              <h3 className="text-base font-semibold">Add Product</h3>
              <p className="text-sm text-muted-foreground">Complete fields below and submit for ORIGO review.</p>
            </div>

            <div className="space-y-4 px-4 py-4 md:px-5 md:py-5">
              <div className="space-y-1.5">
                <Label htmlFor="your-product-name">Product name</Label>
                <Input
                  id="your-product-name"
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                  placeholder="Please enter product name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="your-product-hs">HS Code (optional)</Label>
                <Input
                  id="your-product-hs"
                  value={hsCode}
                  onChange={(event) => setHsCode(event.target.value)}
                  placeholder="170199"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="your-product-target">Target market</Label>
                <Input
                  id="your-product-target"
                  value={targetMarket}
                  onChange={(event) => setTargetMarket(event.target.value)}
                  placeholder="Vietnam, Indonesia"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="your-product-details">Product details</Label>
                <Textarea
                  id="your-product-details"
                  value={productDetails}
                  onChange={(event) => setProductDetails(event.target.value)}
                  placeholder="Keyword, application, material, packaging (all in one)"
                  className="min-h-[92px]"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="your-product-image-input">Product image (optional)</Label>
                <input
                  id="your-product-image-input"
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => applyImageFile(event.target.files?.[0] ?? null)}
                />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => imageInputRef.current?.click()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      imageInputRef.current?.click();
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsImageDragging(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsImageDragging(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsImageDragging(false);
                    applyImageFile(event.dataTransfer.files?.[0] ?? null);
                  }}
                  className={cn(
                    "flex min-h-[76px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed px-3.5 py-3 text-left transition",
                    isImageDragging
                      ? "border-[#ffbd59] bg-[#ffbd59]/15"
                      : "border-slate-300 bg-slate-50 hover:border-[#ffbd59] hover:bg-[#ffbd59]/10",
                  )}
                >
                  <span className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <ImagePlus className="h-4 w-4 text-slate-500" />
                    {imageFile ? imageFile.name : "Drag and drop image here"}
                  </span>
                  <span className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    Browse
                  </span>
                </div>
                {imageFile ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    <span className="truncate">{imageFile.name}</span>
                    <button
                      type="button"
                      className="font-medium text-slate-700 underline underline-offset-2"
                      onClick={() => {
                        setImageFile(null);
                        if (imageInputRef.current) {
                          imageInputRef.current.value = "";
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Drag & drop or click Browse to upload image.</p>
                )}
              </div>

              <Button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="h-10 w-full rounded-full bg-[#ffbd59] text-[#3b2a06] hover:bg-[#ffbd59]/90"
              >
                <UploadCloud className="mr-1.5 h-4 w-4" />
                Submit for review
              </Button>
            </div>
          </section>

          <section className="rounded-2xl border bg-card/90 backdrop-blur">
            <div className="border-b border-border/70 px-4 py-4 md:px-5">
              <h3 className="text-base font-semibold">Product Requests</h3>
              <p className="text-sm text-muted-foreground">Pending and in-review requests only.</p>
            </div>

            {loading ? (
              <div className="px-4 py-6 text-sm text-muted-foreground md:px-5">Loading product requests...</div>
            ) : error ? (
              <div className="px-4 py-6 text-sm text-destructive md:px-5">{error}</div>
            ) : activeRequests.length === 0 ? (
              <div className="px-4 py-8 text-sm text-muted-foreground md:px-5">
                No pending product requests.
              </div>
            ) : (
              <div className="grid gap-3 p-3 md:p-4">
                {activeRequests.map((request) => {
                  const isSelected = request.id === selectedRequestId;
                  const StatusIcon = getStatusIcon(request.status);
                  return (
                    <article
                      key={request.id}
                      className={cn(
                        "rounded-xl border border-border/70 bg-card px-3.5 py-3",
                        isSelected && "border-[#ffbd59]/80 bg-[#ffbd59]/10",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          {request.image_url ? (
                            <img
                              src={request.image_url}
                              alt={request.product_name}
                              className="h-12 w-12 shrink-0 rounded-lg border border-slate-200 object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                              <FileSearch className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{request.product_name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              HS {request.hs_code || "-"} · {formatDateTime(request.submitted_at)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">{statusHintMap[request.status]}</p>
                          </div>
                        </div>
                        <Badge className={cn("inline-flex h-8 items-center gap-1.5 whitespace-nowrap px-3 text-sm font-semibold", STATUS_STYLE[request.status])}>
                          {StatusIcon ? <StatusIcon className="h-4 w-4" /> : null}
                          {statusLabelMap[request.status]}
                        </Badge>
                      </div>

                      <div className="mt-2 flex items-center justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full"
                          onClick={() => {
                            setSelectedRequestId(request.id);
                            setIsPreviewOpen(true);
                          }}
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          View
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
          {selectedRequest ? (
            <div className="space-y-5">
              {(() => {
                const PreviewStatusIcon = getStatusIcon(selectedRequest.status);
                return (
                  <DialogHeader>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <DialogTitle className="text-left text-lg">Opportunity Preview</DialogTitle>
                        <DialogDescription>
                          {selectedRequest.product_name} | {statusLabelMap[selectedRequest.status]}
                        </DialogDescription>
                      </div>
                      <Badge className={cn("inline-flex h-8 items-center gap-1.5 px-3 text-sm font-semibold", STATUS_STYLE[selectedRequest.status])}>
                        {PreviewStatusIcon ? <PreviewStatusIcon className="h-4 w-4" /> : null}
                        {statusLabelMap[selectedRequest.status]}
                      </Badge>
                    </div>
                  </DialogHeader>
                );
              })()}

              {selectedRequest.customer_message ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-600">
                  {selectedRequest.customer_message}
                </div>
              ) : null}

              <section className="rounded-xl border border-border/70 bg-card/80 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Submitted details</h3>
                <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                  <p><strong>Product name:</strong> {selectedRequest.product_name || "-"}</p>
                  <p><strong>HS Code:</strong> {selectedRequest.hs_code || "-"}</p>
                  <p className="md:col-span-2"><strong>Target market:</strong> {selectedRequest.target_market || "-"}</p>
                  <p className="md:col-span-2"><strong>Product details:</strong> {selectedRequest.product_details || "-"}</p>
                </div>
                {selectedRequest.image_url ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Image</p>
                    <img
                      src={selectedRequest.image_url}
                      alt={selectedRequest.product_name}
                      className="mt-1 h-24 w-24 rounded-md border border-slate-200 object-cover"
                    />
                  </div>
                ) : null}
                {selectedRequest.status === "READY" || selectedRequest.status === "UNLOCKED" ? (
                  <p className="mt-3 text-xs text-slate-500">This request is locked and cannot be edited.</p>
                ) : null}
              </section>

              <section className="rounded-2xl border border-border/70 bg-card/90 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900">Update submitted details</h3>
                {!canEditSelectedRequest ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-600">
                    This request is in Ready status and can no longer be edited.
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-3 text-xs text-slate-500">
                    {statusHintMap[selectedRequest.status]}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="edit-product-name">Product name</Label>
                  <Input
                    id="edit-product-name"
                    value={editProductName}
                    onChange={(event) => setEditProductName(event.target.value)}
                    disabled={!canEditSelectedRequest}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-hs-code">HS Code (optional)</Label>
                  <Input
                    id="edit-hs-code"
                    value={editHsCode}
                    onChange={(event) => setEditHsCode(event.target.value)}
                    disabled={!canEditSelectedRequest}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-target-market">Target market</Label>
                  <Input
                    id="edit-target-market"
                    value={editTargetMarket}
                    onChange={(event) => setEditTargetMarket(event.target.value)}
                    disabled={!canEditSelectedRequest}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-product-details">Product details</Label>
                  <Textarea
                    id="edit-product-details"
                    value={editProductDetails}
                    onChange={(event) => setEditProductDetails(event.target.value)}
                    className="min-h-[92px]"
                    disabled={!canEditSelectedRequest}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-product-image-input">Product image (optional)</Label>
                  <input
                    id="edit-product-image-input"
                    ref={editImageInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={!canEditSelectedRequest}
                    onChange={(event) => applyEditImageFile(event.target.files?.[0] ?? null)}
                  />
                  <div
                    role={canEditSelectedRequest ? "button" : undefined}
                    tabIndex={canEditSelectedRequest ? 0 : -1}
                    onClick={() => {
                      if (!canEditSelectedRequest) return;
                      editImageInputRef.current?.click();
                    }}
                    onKeyDown={(event) => {
                      if (!canEditSelectedRequest) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        editImageInputRef.current?.click();
                      }
                    }}
                    onDragOver={(event) => {
                      if (!canEditSelectedRequest) return;
                      event.preventDefault();
                      setIsEditImageDragging(true);
                    }}
                    onDragLeave={(event) => {
                      if (!canEditSelectedRequest) return;
                      event.preventDefault();
                      setIsEditImageDragging(false);
                    }}
                    onDrop={(event) => {
                      if (!canEditSelectedRequest) return;
                      event.preventDefault();
                      setIsEditImageDragging(false);
                      applyEditImageFile(event.dataTransfer.files?.[0] ?? null);
                    }}
                    className={cn(
                      "flex min-h-[70px] w-full items-center justify-between gap-3 rounded-xl border border-dashed px-3.5 py-3 text-left transition",
                      canEditSelectedRequest
                        ? isEditImageDragging
                          ? "cursor-pointer border-[#ffbd59] bg-[#ffbd59]/15"
                          : "cursor-pointer border-slate-300 bg-slate-50 hover:border-[#ffbd59] hover:bg-[#ffbd59]/10"
                        : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-500",
                    )}
                  >
                    <span className="inline-flex items-center gap-2 text-sm">
                      <ImagePlus className="h-4 w-4 text-slate-500" />
                      {editImageFile?.name || editImageUrl ? "Image selected" : "No image"}
                    </span>
                    <span className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600">
                      Browse
                    </span>
                  </div>
                  {editImageUrl ? (
                    <div className="rounded-lg border border-slate-200 bg-white p-2">
                      <img
                        src={editImageUrl}
                        alt="Product preview"
                        className="h-24 w-24 rounded-md border border-slate-200 object-cover"
                      />
                    </div>
                  ) : null}
                  {editImageFile ? (
                    <p className="text-xs text-slate-500">New file: {editImageFile.name}</p>
                  ) : null}
                </div>

                {canEditSelectedRequest ? (
                  <>
                    <Button
                      type="button"
                      onClick={() => void submitEditedRequest()}
                      disabled={editingRequest}
                      className="h-10 w-full rounded-full bg-[#ffbd59] text-[#3b2a06] hover:bg-[#ffbd59]/90"
                    >
                      <UploadCloud className="mr-1.5 h-4 w-4" />
                      Submit update
                    </Button>
                    <p className="text-xs text-slate-500">
                      Need more info requests will return to Pending review after submit.
                    </p>
                  </>
                ) : null}
              </section>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

