import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CircleDashed, Eye, RefreshCcw, Search, ShieldAlert, Sparkles } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  findReadyProductMatch,
  loadProductRequests,
  loadReadyPageProducts,
  statusLabelMap,
  updateProductRequest,
  updateReadyPageProduct,
  type MissingInfoChecklist,
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

type FilterStatus = "ALL" | "PENDING_REVIEW" | "NEED_MORE_INFO" | "READY" | "UNLOCKED";

const FILTER_TABS: Array<{ key: FilterStatus; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "PENDING_REVIEW", label: "Pending" },
  { key: "NEED_MORE_INFO", label: "Need more info" },
  { key: "READY", label: "Ready" },
  { key: "UNLOCKED", label: "Unlocked" },
];

const CHECKLIST_LABELS: Array<{ key: keyof MissingInfoChecklist; label: string }> = [
  { key: "packaging", label: "Packaging" },
  { key: "application", label: "Application" },
  { key: "target_market", label: "Target market" },
  { key: "material", label: "Material" },
];

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
};

const confidenceClass = (confidence: ProductRequestRecord["confidence"]) => {
  if (confidence === "HIGH") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (confidence === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
};

const formatChecklistMessage = (checklist: MissingInfoChecklist) => {
  const missing = CHECKLIST_LABELS.filter((item) => checklist[item.key]).map((item) => item.label.toLowerCase());
  if (missing.length === 0) {
    return "Please add required details for ORIGO review.";
  }
  return `Please add: ${missing.join(", ")}.`;
};

export default function AdminProductSuggestion() {
  const { toast } = useToast();

  const [requests, setRequests] = useState<ProductRequestRecord[]>([]);
  const [readyRows, setReadyRows] = useState<ReadyPageProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("PENDING_REVIEW");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [customerMessage, setCustomerMessage] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [readySummary, setReadySummary] = useState("");
  const [buyers2026Input, setBuyers2026Input] = useState("");
  const [checklist, setChecklist] = useState<MissingInfoChecklist>({
    packaging: false,
    application: false,
    target_market: false,
    material: false,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [requestResult, readyResult] = await Promise.all([
        loadProductRequests(),
        loadReadyPageProducts(),
      ]);
      setRequests(requestResult.rows);
      setReadyRows(readyResult.rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load product suggestions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return requests
      .filter((row) => {
        if (statusFilter === "ALL") return true;
        return row.status === statusFilter;
      })
      .filter((row) => {
        if (!term) return true;
        return [row.product_name, row.customer_email, row.customer_workspace, row.hs_code]
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  }, [requests, search, statusFilter]);

  const selectedRow = useMemo(
    () => requests.find((row) => row.id === selectedId) ?? null,
    [requests, selectedId],
  );

  const selectedReadyMatch = useMemo(() => {
    if (!selectedRow) return null;
    return findReadyProductMatch(selectedRow.product_name, selectedRow.hs_code, readyRows);
  }, [selectedRow, readyRows]);

  useEffect(() => {
    if (!selectedRow) {
      setCustomerMessage("");
      setAdminNote("");
      setReadySummary("");
      setBuyers2026Input("");
      setChecklist({ packaging: false, application: false, target_market: false, material: false });
      return;
    }

    setCustomerMessage(selectedRow.customer_message || "");
    setAdminNote(selectedRow.admin_note || "");
    setReadySummary(selectedRow.ready_summary || selectedReadyMatch?.ready_copy || "");
    setBuyers2026Input(selectedReadyMatch ? String(selectedReadyMatch.buyers_2026_count) : "");
    setChecklist(selectedRow.missing_info_checklist);
  }, [selectedRow, selectedReadyMatch]);

  const openReview = (row: ProductRequestRecord) => {
    setSelectedId(row.id);
    setIsDialogOpen(true);
  };

  const saveReview = async (nextStatus?: ProductRequestStatus) => {
    if (!selectedRow) return;

    setSaving(true);
    try {
      const updated = await updateProductRequest(
        selectedRow.id,
        {
          status: nextStatus,
          customer_message: customerMessage,
          admin_note: adminNote,
          ready_summary: readySummary,
          missing_info_checklist: checklist,
          updated_by: "ORIGO Admin",
        },
        readyRows,
      );

      if (!updated) {
        throw new Error("Product request not found");
      }

      setRequests((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      toast({ title: nextStatus ? `Status set to ${statusLabelMap[nextStatus]}` : "Review saved" });
    } catch (saveError) {
      toast({
        title: "Save failed",
        description: saveError instanceof Error ? saveError.message : "Unable to update product request",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const markNeedMoreInfo = async () => {
    setCustomerMessage(formatChecklistMessage(checklist));
    await saveReview("NEED_MORE_INFO");
  };

  const markReady = async () => {
    if (!customerMessage.trim()) {
      setCustomerMessage("Preview available. Historical proof is now ready.");
    }
    await saveReview("READY");
  };

  const markUnlocked = async () => {
    if (!customerMessage.trim()) {
      setCustomerMessage("Full buyer intelligence is now unlocked.");
    }
    await saveReview("UNLOCKED");
  };

  const markNotSupported = async () => {
    if (!customerMessage.trim()) {
      setCustomerMessage("Not enough matching data to generate reliable opportunity output.");
    }
    await saveReview("NOT_SUPPORTED");
  };

  const saveReadyProductMetrics = async () => {
    if (!selectedReadyMatch) {
      toast({
        title: "No ready-page match",
        description: "Map this product to ready_page_products before setting 2026 buyers.",
        variant: "destructive",
      });
      return;
    }

    const parsed = Number(buyers2026Input.replace(/,/g, "").trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast({
        title: "Invalid number",
        description: "Enter a valid 2026 potential buyers count.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const updated = await updateReadyPageProduct(selectedReadyMatch.id, {
        buyers_2026_count: Math.floor(parsed),
      });
      if (!updated) {
        throw new Error("Ready-page product not found");
      }

      setReadyRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      toast({ title: "2026 potential buyers updated" });
    } catch (saveError) {
      toast({
        title: "Update failed",
        description: saveError instanceof Error ? saveError.message : "Unable to update ready-page metrics",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Product Suggestion"
        subtitle="Backoffice review for customer product opportunity previews"
      />

      <div className="flex-1 space-y-6 overflow-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
        <section className="rounded-2xl border bg-card/90 backdrop-blur">
          <div className="border-b border-border/70 px-4 py-4 md:px-5">
            <h2 className="text-base font-semibold">Product Queue</h2>
            <p className="text-sm text-muted-foreground">Pending | Need more info | Ready | Unlocked</p>
          </div>

          <div className="space-y-4 px-4 py-4 md:px-5 md:py-5">
            <div className="flex flex-wrap gap-2">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                    statusFilter === tab.key
                      ? "border-[#ffbd59] bg-[#ffbd59]/25 text-[#7a4a00]"
                      : "border-border/70 bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search product, customer, HS code"
                  className="h-10 rounded-xl bg-background pl-9"
                />
              </div>
              <Button type="button" variant="outline" className="h-10 rounded-full" onClick={() => void refresh()}>
                <RefreshCcw className="mr-1.5 h-4 w-4" />
                Refresh
              </Button>
            </div>

            {loading ? (
              <div className="rounded-xl border border-border/70 bg-card px-4 py-6 text-sm text-muted-foreground">
                Loading product queue...
              </div>
            ) : error ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-6 text-sm text-destructive">
                {error}
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                No product requests match this filter.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1180px] border-separate border-spacing-0">
                    <thead>
                      <tr className="border-b border-slate-200/70 bg-slate-50/90">
                        <th className="px-5 py-3.5 text-left text-[13px] font-semibold text-slate-600">Product</th>
                        <th className="px-5 py-3.5 text-left text-[13px] font-semibold text-slate-600">Customer / Workspace</th>
                        <th className="px-5 py-3.5 text-left text-[13px] font-semibold text-slate-600">HS Code</th>
                        <th className="px-5 py-3.5 text-left text-[13px] font-semibold text-slate-600">Status</th>
                        <th className="px-5 py-3.5 text-left text-[13px] font-semibold text-slate-600">Submitted</th>
                        <th className="px-5 py-3.5 text-left text-[13px] font-semibold text-slate-600">Updated by</th>
                        <th className="px-5 py-3.5 text-left text-[13px] font-semibold text-slate-600">Last updated</th>
                        <th className="px-5 py-3.5 text-right text-[13px] font-semibold text-slate-600">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row, index) => (
                        <tr key={row.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50/30"}>
                          <td className="px-5 py-3.5">
                            <p className="text-sm font-semibold text-slate-900">{row.product_name}</p>
                            <p className="text-xs text-muted-foreground">Confidence {row.confidence}</p>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-700">
                            <p>{row.customer_workspace || "-"}</p>
                            <p className="text-xs text-muted-foreground">{row.customer_email || "-"}</p>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-700">{row.hs_code || "-"}</td>
                          <td className="px-5 py-3.5">
                            <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", STATUS_STYLE[row.status])}>
                              {statusLabelMap[row.status]}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-sm text-slate-700">{formatDateTime(row.submitted_at)}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-700">{row.updated_by || "-"}</td>
                          <td className="px-5 py-3.5 text-sm text-slate-700">{formatDateTime(row.updated_at)}</td>
                          <td className="px-5 py-3.5 text-right">
                            <Button type="button" variant="outline" size="sm" className="h-8 rounded-full" onClick={() => openReview(row)}>
                              <Eye className="mr-1.5 h-3.5 w-3.5" />
                              Review
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
          {!selectedRow ? null : (
            <>
              <DialogHeader>
                <DialogTitle>{selectedRow.product_name}</DialogTitle>
                <DialogDescription>
                  Review detail and status transition for {selectedRow.customer_workspace || selectedRow.customer_email}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <section className="rounded-xl border border-border/70 bg-card/80 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Customer</p>
                      <p className="text-sm text-slate-900">{selectedRow.customer_email}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Workspace</p>
                      <p className="text-sm text-slate-900">{selectedRow.customer_workspace || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">HS Code</p>
                      <p className="text-sm text-slate-900">{selectedRow.hs_code || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</p>
                      <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", STATUS_STYLE[selectedRow.status])}>
                        {statusLabelMap[selectedRow.status]}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Updated by</p>
                      <p className="text-sm text-slate-900">{selectedRow.updated_by || "-"}</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Matching confidence</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", confidenceClass(selectedRow.confidence))}>
                        {selectedRow.confidence}
                      </span>
                      <p className="text-xs text-slate-600">Matched using HS code, product details, and ready-page buyer coverage.</p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
                    <p className="md:col-span-2"><strong>Product details:</strong> {selectedRow.product_details || "-"}</p>
                    <p className="md:col-span-2"><strong>Target market:</strong> {selectedRow.target_market || "-"}</p>
                  </div>
                </section>

                <section className="rounded-xl border border-border/70 bg-card/80 p-4 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>Customer-facing message</Label>
                      <Textarea
                        value={customerMessage}
                        onChange={(event) => setCustomerMessage(event.target.value)}
                        placeholder="Message visible to customer"
                        className="min-h-[84px]"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>Ready summary (optional)</Label>
                      <Textarea
                        value={readySummary}
                        onChange={(event) => setReadySummary(event.target.value)}
                        placeholder="Executive summary shown in Ready preview"
                        className="min-h-[84px]"
                      />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>Admin note (internal)</Label>
                      <Textarea
                        value={adminNote}
                        onChange={(event) => setAdminNote(event.target.value)}
                        placeholder="Internal note for ORIGO team"
                        className="min-h-[84px]"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-background p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Missing info checklist</p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      {CHECKLIST_LABELS.map((item) => (
                        <label key={item.key} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm">
                          <Checkbox
                            checked={checklist[item.key]}
                            onCheckedChange={(checked) =>
                              setChecklist((prev) => ({ ...prev, [item.key]: Boolean(checked) }))
                            }
                          />
                          <span>{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/70 bg-background p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ready-page metrics (ORIGO Admin)</p>
                    <div className="mt-2 grid gap-3 md:grid-cols-[minmax(0,240px)_auto] md:items-end">
                      <div className="space-y-1.5">
                        <Label>2026 potential buyers</Label>
                        <Input
                          value={buyers2026Input}
                          onChange={(event) => setBuyers2026Input(event.target.value)}
                          placeholder="1732"
                          inputMode="numeric"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void saveReadyProductMetrics()}
                        disabled={saving || !selectedReadyMatch}
                      >
                        Save 2026 count
                      </Button>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      2023 proof count is computed from rows in `ready_page_buyer_signals` (year 2023).
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void saveReview()}
                      disabled={saving}
                    >
                      <Check className="mr-1.5 h-4 w-4" />
                      Save review
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void markNeedMoreInfo()}
                      disabled={saving || selectedRow.status !== "PENDING_REVIEW"}
                    >
                      <CircleDashed className="mr-1.5 h-4 w-4" />
                      Mark Need more info
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void markReady()}
                      disabled={saving || selectedRow.status !== "PENDING_REVIEW"}
                    >
                      <Sparkles className="mr-1.5 h-4 w-4" />
                      Mark Ready
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void markUnlocked()}
                      disabled={saving || selectedRow.status !== "READY"}
                    >
                      <Check className="mr-1.5 h-4 w-4" />
                      Mark Unlocked
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="border-rose-200 text-rose-700 hover:bg-rose-50"
                      onClick={() => void markNotSupported()}
                      disabled={saving}
                    >
                      <ShieldAlert className="mr-1.5 h-4 w-4" />
                      Mark Not supported
                    </Button>
                  </div>

                  {selectedReadyMatch ? (
                    <p className="text-xs text-muted-foreground">
                      Ready-page data match: {selectedReadyMatch.product_name} ({selectedReadyMatch.buyers_2023_count.toLocaleString()} buyers in 2023)
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No direct ready-page product match found yet.</p>
                  )}
                </section>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
