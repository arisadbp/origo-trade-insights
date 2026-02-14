import { useEffect, useMemo, useState } from "react";
import { Search, ChevronRight, Calendar, DollarSign, AlertCircle } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { TopBar } from "@/components/layout/TopBar";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type FinanceInvoiceDbRow = {
  id: string | null;
  invoice: string | null;
  tons: number | null;
  total_invoice: number | null;
  usd: number | null;
  contact: boolean | null;
  credit: boolean | null;
  export: boolean | null;
  team: string | null;
  thb: number | null;
  booking_no: string | null;
  contract: string | null;
  convert_date: string | null;
  convert_rate: number | null;
  customer_name: string | null;
  fac: string | null;
  invoice_date: string | null;
  price: number | null;
  status_type: string | null;
  status_detail: string | null;
};

type InvoiceRow = {
  id: string;
  invoice: string;
  tons: number;
  totalInvoice: number;
  usd: number;
  contact: boolean;
  credit: boolean;
  exportFlag: boolean;
  team: string;
  thb: number;
  bookingNo: string;
  contract: string;
  convertDate: string | null;
  convertRate: number;
  customerName: string;
  factory: string;
  invoiceDate: string | null;
  price: number;
  statusType: string;
  statusDetail: string;
};

type StatusBucketKey = "final" | "provisional" | "adjustment" | "other";
type AttentionInvoiceFilter = "none" | "due_invoices_3d" | "overdue_invoices" | "followup_invoices";

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const toNumber = (value: number | null) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const parseDateToDayMs = (value: string | null) => {
  if (!value) return null;
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const toStatusBucket = (statusType: string): StatusBucketKey => {
  const normalized = statusType.trim().toLowerCase();
  if (normalized.includes("final")) return "final";
  if (normalized.includes("provisional")) return "provisional";
  if (normalized.includes("adjust")) return "adjustment";
  return "other";
};

const statusBadgeFromType = (statusType: string) => {
  const bucket = toStatusBucket(statusType);
  if (bucket === "final") {
    return <StatusBadge status="success" label="Final Price" showIcon={false} className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide" />;
  }
  if (bucket === "provisional") {
    return <StatusBadge status="pending" label="Provisional" showIcon={false} className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide" />;
  }
  if (bucket === "adjustment") {
    return <StatusBadge status="warning" label="Adjustment" showIcon={false} className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide" />;
  }
  return <StatusBadge status="neutral" label={statusType || "Unknown"} showIcon={false} className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide" />;
};

const statusBucketVisuals: Record<
  StatusBucketKey,
  { label: string; bar: string; card: string; border: string }
> = {
  final: {
    label: "Final Price",
    bar: "bg-emerald-500",
    card: "bg-emerald-50",
    border: "border-l-emerald-400",
  },
  provisional: {
    label: "Provisional",
    bar: "bg-blue-500",
    card: "bg-blue-50",
    border: "border-l-blue-400",
  },
  adjustment: {
    label: "Adjustment",
    bar: "bg-amber-500",
    card: "bg-amber-50",
    border: "border-l-amber-400",
  },
  other: {
    label: "Other",
    bar: "bg-slate-500",
    card: "bg-slate-50",
    border: "border-l-slate-400",
  },
};

export default function InvoicesPayments() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [invoiceDateFrom, setInvoiceDateFrom] = useState("");
  const [invoiceDateTo, setInvoiceDateTo] = useState("");
  const [attentionFilter, setAttentionFilter] = useState<AttentionInvoiceFilter>("none");
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRow | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    const attention = searchParams.get("attention");
    if (attention === "due-invoices-3d") {
      setAttentionFilter("due_invoices_3d");
      return;
    }
    if (attention === "overdue-invoices") {
      setAttentionFilter("overdue_invoices");
      return;
    }
    if (attention === "follow-up-invoices") {
      setAttentionFilter("followup_invoices");
      return;
    }

    setAttentionFilter("none");
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const fetchInvoices = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setError("Supabase is not configured.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("finance_invoices")
        .select(
          "id, invoice, tons, total_invoice, usd, contact, credit, export, team, thb, booking_no, contract, convert_date, convert_rate, customer_name, fac, invoice_date, price, status_type, status_detail",
        )
        .order("invoice_date", { ascending: false });

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const mappedRows = ((data ?? []) as FinanceInvoiceDbRow[]).map((row, index) => ({
        id: row.id ?? `${row.invoice ?? "invoice"}-${index}`,
        invoice: row.invoice ?? "-",
        tons: toNumber(row.tons),
        totalInvoice: toNumber(row.total_invoice),
        usd: toNumber(row.usd),
        contact: Boolean(row.contact),
        credit: Boolean(row.credit),
        exportFlag: Boolean(row.export),
        team: row.team ?? "-",
        thb: toNumber(row.thb),
        bookingNo: row.booking_no ?? "-",
        contract: row.contract ?? "-",
        convertDate: row.convert_date ?? null,
        convertRate: toNumber(row.convert_rate),
        customerName: row.customer_name ?? "-",
        factory: row.fac ?? "-",
        invoiceDate: row.invoice_date ?? null,
        price: toNumber(row.price),
        statusType: row.status_type ?? "Unknown",
        statusDetail: row.status_detail ?? "-",
      }));

      setRows(mappedRows);
      setLoading(false);
    };

    fetchInvoices();
    return () => {
      cancelled = true;
    };
  }, []);

  const uniqueFactories = useMemo(
    () => [...new Set(rows.map((row) => row.factory).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const uniqueStatuses = useMemo(
    () => [...new Set(rows.map((row) => row.statusType).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const fromMs = parseDateToDayMs(invoiceDateFrom);
    const toMs = parseDateToDayMs(invoiceDateTo);
    const nowMs = new Date().setHours(0, 0, 0, 0);
    const dayMs = 1000 * 60 * 60 * 24;
    return rows.filter((row) => {
      const statusMatch = statusFilter === "all" || row.statusType === statusFilter;
      const factoryMatch = factoryFilter === "all" || row.factory === factoryFilter;
      if (!statusMatch || !factoryMatch) return false;

      if (attentionFilter === "due_invoices_3d") {
        const normalized = row.statusType.toLowerCase();
        if (normalized.includes("paid") || normalized.includes("cancel") || normalized.includes("void")) return false;
        const dueMs = parseDateToDayMs(row.invoiceDate);
        if (dueMs === null) return false;
        const days = Math.floor((dueMs - nowMs) / dayMs);
        if (days < 0 || days > 3) return false;
      }

      if (attentionFilter === "overdue_invoices") {
        const normalized = row.statusType.toLowerCase();
        if (normalized.includes("paid") || normalized.includes("cancel") || normalized.includes("void")) return false;
        const dueMs = parseDateToDayMs(row.invoiceDate);
        if (dueMs === null || dueMs >= nowMs) return false;
      }

      if (attentionFilter === "followup_invoices") {
        const normalized = row.statusType.toLowerCase();
        if (!normalized.includes("provisional") && !normalized.includes("adjust")) return false;
      }

      if (fromMs !== null || toMs !== null) {
        const invoiceMs = parseDateToDayMs(row.invoiceDate);
        if (invoiceMs === null) return false;
        if (fromMs !== null && invoiceMs < fromMs) return false;
        if (toMs !== null && invoiceMs > toMs) return false;
      }
      if (!term) return true;
      return (
        row.invoice.toLowerCase().includes(term) ||
        row.customerName.toLowerCase().includes(term) ||
        row.contract.toLowerCase().includes(term) ||
        row.bookingNo.toLowerCase().includes(term) ||
        row.factory.toLowerCase().includes(term) ||
        row.statusType.toLowerCase().includes(term)
      );
    });
  }, [rows, search, statusFilter, factoryFilter, attentionFilter, invoiceDateFrom, invoiceDateTo]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, factoryFilter, attentionFilter, invoiceDateFrom, invoiceDateTo, search, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const pageStart = filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, filteredRows.length);

  const summary = useMemo(() => {
    const totalUsd = rows.reduce((sum, row) => sum + row.usd, 0);
    const totalThb = rows.reduce((sum, row) => sum + row.thb, 0);
    const creditRows = rows.filter((row) => row.credit);
    const creditUsd = creditRows.reduce((sum, row) => sum + row.usd, 0);
    const avgConvertRate = rows.length === 0 ? 0 : rows.reduce((sum, row) => sum + row.convertRate, 0) / rows.length;
    return {
      totalUsd,
      totalThb,
      creditCount: creditRows.length,
      creditUsd,
      avgConvertRate,
      totalCount: rows.length,
    };
  }, [rows]);

  const statusMix = useMemo(() => {
    const map = new Map<StatusBucketKey, { count: number; usd: number }>();
    rows.forEach((row) => {
      const bucket = toStatusBucket(row.statusType);
      const current = map.get(bucket) ?? { count: 0, usd: 0 };
      current.count += 1;
      current.usd += row.usd;
      map.set(bucket, current);
    });
    return (Object.keys(statusBucketVisuals) as StatusBucketKey[])
      .filter((key) => (map.get(key)?.count ?? 0) > 0)
      .map((key) => ({
        key,
        label: statusBucketVisuals[key].label,
        count: map.get(key)?.count ?? 0,
        usd: map.get(key)?.usd ?? 0,
        bar: statusBucketVisuals[key].bar,
        card: statusBucketVisuals[key].card,
        border: statusBucketVisuals[key].border,
      }));
  }, [rows]);

  const columns = [
    {
      key: "invoice",
      header: "Invoice",
      render: (item: InvoiceRow) => (
        <div>
          <button
            type="button"
            className="font-mono font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => {
              setSelectedInvoice(item);
              setIsDetailOpen(true);
            }}
          >
            {item.invoice}
          </button>
          <p className="text-xs text-muted-foreground">{item.contract}</p>
        </div>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      render: (item: InvoiceRow) => (
        <div>
          <p className="font-medium">{item.customerName}</p>
          <p className="text-xs text-muted-foreground">Factory: {item.factory} · Team: {item.team}</p>
        </div>
      ),
    },
    {
      key: "tons",
      header: "Tons",
      align: "right" as const,
      render: (item: InvoiceRow) => <span>{numberFormatter.format(item.tons)} MT</span>,
    },
    {
      key: "usd",
      header: "USD",
      align: "right" as const,
      render: (item: InvoiceRow) => (
        <div className="text-right">
          <p className="font-medium">{currencyFormatter.format(item.usd)}</p>
          <p className="text-xs text-muted-foreground">THB {numberFormatter.format(item.thb)}</p>
        </div>
      ),
    },
    {
      key: "dates",
      header: "Dates",
      render: (item: InvoiceRow) => (
        <div>
          <p className="text-sm">Invoice: {formatDate(item.invoiceDate)}</p>
          <p className="text-xs text-muted-foreground">Convert: {formatDate(item.convertDate)}</p>
        </div>
      ),
    },
    {
      key: "statusType",
      header: "Status",
      align: "center" as const,
      render: (item: InvoiceRow) => statusBadgeFromType(item.statusType),
    },
    {
      key: "action",
      header: "",
      width: "110px",
      render: (item: InvoiceRow) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-full border border-border/70 px-3.5 text-xs font-medium"
          onClick={() => {
            setSelectedInvoice(item);
            setIsDetailOpen(true);
          }}
        >
          View
          <ChevronRight className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Invoices & Payments"
        subtitle="Live finance invoices from Supabase with payment insight"
      />

      <div className="flex-1 space-y-6 overflow-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
        <div className="rounded-2xl border bg-card/90 backdrop-blur">
          <div className="border-b border-border/70 px-4 py-4 md:px-5">
            <h2 className="text-base font-semibold">Invoice Lines</h2>
            <p className="text-sm text-muted-foreground">
              Clean invoice and payment status view with quick drill-down by customer.
            </p>
          </div>

          <div className="space-y-4 p-4 md:p-5">
            {loading ? (
              <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
                Loading finance invoices...
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-destructive/30 bg-card p-6 text-sm text-destructive">
                {error}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                  <div className="min-w-0 rounded-3xl border border-border/60 bg-card/80 px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Invoice USD</p>
                    <p className="mt-1.5 text-[22px] font-semibold leading-tight tracking-tight text-slate-900 tabular-nums sm:text-[24px] md:text-[30px]">
                      <span className="md:hidden">{compactCurrencyFormatter.format(summary.totalUsd)}</span>
                      <span className="hidden md:inline">{currencyFormatter.format(summary.totalUsd)}</span>
                    </p>
                    <div className="mt-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="min-w-0 rounded-3xl border border-border/60 bg-gradient-to-br from-slate-50 to-card px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_24px_rgba(15,23,42,0.04)]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Invoice THB</p>
                    <p className="mt-1.5 text-[22px] font-semibold leading-tight tracking-tight text-slate-900 tabular-nums sm:text-[24px] md:text-[30px]">
                      <span className="md:hidden">{compactNumberFormatter.format(summary.totalThb)}</span>
                      <span className="hidden md:inline">{numberFormatter.format(summary.totalThb)}</span>
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500">THB</p>
                  </div>
                  <div className="min-w-0 rounded-3xl border border-amber-100 bg-amber-50/70 px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700/80">Credit Invoices</p>
                    <p className="mt-1.5 text-[24px] font-semibold leading-none tracking-tight text-amber-700 tabular-nums md:text-[30px]">
                      {numberFormatter.format(summary.creditCount)}
                    </p>
                    <div className="mt-2">
                      <AlertCircle className="h-4 w-4 text-amber-700/70" />
                    </div>
                  </div>
                  <div className="min-w-0 rounded-3xl border border-border/60 bg-card/80 px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_24px_rgba(15,23,42,0.04)]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Avg Convert Rate</p>
                    <p className="mt-1.5 text-[24px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums md:text-[30px]">
                      {summary.avgConvertRate.toFixed(4)}
                    </p>
                    <div className="mt-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-sm md:p-5">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-foreground">Invoice Status Mix</h3>
                  </div>
                  {statusMix.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No invoice data available.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {statusMix.map((bucket) => (
                        <article
                          key={bucket.key}
                          className={cn("rounded-2xl border border-border/70 px-3.5 py-3", bucket.card)}
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            {bucket.label}
                          </p>
                          <p className="mt-2 text-base font-semibold tabular-nums text-foreground">
                            {currencyFormatter.format(bucket.usd)}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-sm md:p-5">
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="order-2 grid grid-cols-1 gap-3 sm:grid-cols-2 md:order-1 xl:grid-cols-3">
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Status
                          </p>
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-10 rounded-2xl border-border/70 bg-background/90 text-sm focus:ring-1 focus:ring-slate-300">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                              <SelectItem value="all">All Status</SelectItem>
                              {uniqueStatuses.map((status) => (
                                <SelectItem key={status} value={status}>{status}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Factory
                          </p>
                          <Select value={factoryFilter} onValueChange={setFactoryFilter}>
                            <SelectTrigger className="h-10 rounded-2xl border-border/70 bg-background/90 text-sm focus:ring-1 focus:ring-slate-300">
                              <SelectValue placeholder="Factory" />
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                              <SelectItem value="all">All Factories</SelectItem>
                              {uniqueFactories.map((factory) => (
                                <SelectItem key={factory} value={factory}>{factory}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2 xl:col-span-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Invoice Date Range
                          </p>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <Input
                              type="date"
                              value={invoiceDateFrom}
                              onChange={(event) => setInvoiceDateFrom(event.target.value)}
                              className="h-10 rounded-2xl border-border/70 bg-background/90 text-sm focus-visible:ring-1 focus-visible:ring-slate-300"
                              aria-label="Invoice date from"
                            />
                            <Input
                              type="date"
                              value={invoiceDateTo}
                              onChange={(event) => setInvoiceDateTo(event.target.value)}
                              className="h-10 rounded-2xl border-border/70 bg-background/90 text-sm focus-visible:ring-1 focus-visible:ring-slate-300"
                              aria-label="Invoice date to"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="order-1 w-full space-y-1.5 md:order-2 md:max-w-sm xl:max-w-sm">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:hidden">
                          Quick Search
                        </p>
                        <div className="relative w-full">
                          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Search invoice, customer, contract, booking..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="h-11 rounded-2xl border-border/70 bg-background/90 pl-10 text-sm focus-visible:ring-1 focus-visible:ring-slate-300 md:h-10"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-medium text-slate-600">
                        {numberFormatter.format(filteredRows.length)} visible invoices
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {attentionFilter !== "none" ? (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                            {attentionFilter === "due_invoices_3d"
                              ? "Alert filter: Due in 3 days"
                              : attentionFilter === "overdue_invoices"
                                ? "Alert filter: Overdue invoices"
                                : "Alert filter: Follow-up invoices"}
                          </span>
                        ) : null}
                        {attentionFilter !== "none" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-full px-3 text-xs text-slate-600 hover:bg-muted/50"
                            onClick={() => setAttentionFilter("none")}
                          >
                            Clear alert filter
                          </Button>
                        ) : null}
                        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2 py-1">
                          <span className="text-[11px] font-medium text-muted-foreground">Per page</span>
                          <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                            <SelectTrigger className="h-7 w-[74px] rounded-full border-none bg-transparent px-2 text-xs shadow-none focus:ring-0">
                              <SelectValue placeholder="10" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="30">30</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <DataTable
                    columns={columns}
                    data={paginatedRows}
                    emptyMessage="No finance invoices found"
                    className={[
                      "rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
                      "[&_table]:min-w-[1080px] [&_table]:border-separate [&_table]:border-spacing-0",
                      "[&_thead_tr]:border-b [&_thead_tr]:border-slate-200/70 [&_thead_tr]:bg-slate-50/90",
                      "[&_th]:px-5 [&_th]:py-3.5 [&_th]:text-[12px] [&_th]:font-semibold [&_th]:tracking-[0.01em] [&_th]:text-slate-600",
                      "[&_td]:px-5 [&_td]:py-4 [&_td]:align-middle [&_td]:text-[13px] sm:[&_td]:text-sm",
                      "[&_tbody_tr]:border-b [&_tbody_tr]:border-slate-200/70",
                      "[&_tbody_tr:nth-child(odd)]:bg-white [&_tbody_tr:nth-child(even)]:bg-slate-50/45",
                      "[&_tbody_tr:hover]:bg-slate-100/70",
                    ].join(" ")}
                  />

                  <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      Showing {numberFormatter.format(pageStart)}-{numberFormatter.format(pageEnd)} of {numberFormatter.format(filteredRows.length)}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 min-w-[84px] rounded-full px-3 text-xs"
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-xs font-medium text-slate-600">
                        Page {numberFormatter.format(currentPage)} / {numberFormatter.format(totalPages)}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 min-w-[84px] rounded-full px-3 text-xs"
                        onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={currentPage >= totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedInvoice?.invoice ?? "Invoice Detail"}</DialogTitle>
            <DialogDescription>
              {selectedInvoice ? `${selectedInvoice.customerName} · ${selectedInvoice.contract}` : "Invoice information"}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                <div className="rounded-lg border bg-background px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">USD</p>
                  <p className="text-sm font-semibold">{currencyFormatter.format(selectedInvoice.usd)}</p>
                </div>
                <div className="rounded-lg border bg-background px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">THB</p>
                  <p className="text-sm font-semibold">{numberFormatter.format(selectedInvoice.thb)}</p>
                </div>
                <div className="rounded-lg border bg-background px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Tons</p>
                  <p className="text-sm font-semibold">{numberFormatter.format(selectedInvoice.tons)} MT</p>
                </div>
                <div className="rounded-lg border bg-background px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Convert Rate</p>
                  <p className="text-sm font-semibold">{selectedInvoice.convertRate.toFixed(4)}</p>
                </div>
                <div className="rounded-lg border bg-background px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Factory</p>
                  <p className="text-sm font-semibold">{selectedInvoice.factory}</p>
                </div>
                <div className="rounded-lg border bg-background px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Team</p>
                  <p className="text-sm font-semibold">{selectedInvoice.team}</p>
                </div>
                <div className="rounded-lg border bg-background px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Credit</p>
                  <p className="text-sm font-semibold">{selectedInvoice.credit ? "Yes" : "No"}</p>
                </div>
                <div className="rounded-lg border bg-background px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Status</p>
                  <div className="mt-1">{statusBadgeFromType(selectedInvoice.statusType)}</div>
                </div>
              </div>

              <div className="rounded-lg border bg-background p-3">
                <p className="text-xs text-muted-foreground">Booking No</p>
                <p className="text-sm font-medium">{selectedInvoice.bookingNo}</p>
                <p className="mt-2 text-xs text-muted-foreground">Status Detail</p>
                <p className="text-sm">{selectedInvoice.statusDetail}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
