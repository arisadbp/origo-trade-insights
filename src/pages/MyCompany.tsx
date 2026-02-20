import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, DollarSign, FileText, Package } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { KPICard } from "@/components/ui/kpi-card";
import { AttentionItem } from "@/components/ui/attention-item";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/layout/TopBar";
import {
  ExecutiveTradeDashboard,
  type DashboardContractRow,
  type DashboardDeliveryRow,
  type DashboardInvoiceRow,
  type DashboardStockRow,
} from "@/components/charts/ExecutiveTradeDashboard";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type ContractRelation =
  | { customer: string | null; type: string | null; contractdate: string | null }
  | Array<{ customer: string | null; type: string | null; contractdate: string | null }>
  | null;

type ContractLineDbRow = {
  line_id: string | null;
  contract_id: string | null;
  job: string | null;
  product: string | null;
  team: string | null;
  status: string | null;
  ton: number | null;
  acc: number | null;
  date_to: string | null;
  contracts: ContractRelation;
};

type StockDbRow = {
  stock_id: string | number | null;
  factory: string | null;
  qty: number | string | null;
  tag: string | null;
  type: string | null;
};

type InvoiceDbRow = {
  id: string | null;
  invoice_date: string | null;
  status_type: string | null;
  usd: number | null;
  total_invoice: number | null;
  tons: number | null;
  customer_name: string | null;
  fac: string | null;
};

type DeliveryDbRow = {
  delivery_id: string | null;
  contract_id: string | null;
  job: string | null;
  delivery_date: string | null;
  quantity: number | null;
};

type ContractMetricRow = DashboardContractRow & {
  job: string;
  team: string;
  contractType: string;
  dateTo: string | null;
  remainingTon: number;
};

type RecentCommitRow = {
  id: string;
  customer: string;
  contractId: string;
  commitDate: string | null;
  job: string;
  team: string;
  commitTon: number;
  remainingTon: number;
  status: string;
};

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const getContractField = (
  relation: ContractRelation,
  key: "customer" | "type" | "contractdate",
): string | null => {
  if (!relation) return null;
  if (Array.isArray(relation)) return relation[0]?.[key] ?? null;
  return relation[key] ?? null;
};

const normalizeFactory = (value: string | null) => (value ?? "-").trim().toUpperCase();

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

const formatMt = (value: number) => `${formatNumber(value)} MT`;

const formatMoneyCompact = (value: number) => {
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const toDayMs = (value: string | null) => {
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

const statusBadge = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes("overdue")) {
    return <StatusBadge status="error" label="Overdue" showIcon={false} className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide" />;
  }
  if (normalized.includes("pending")) {
    return <StatusBadge status="pending" label="Pending" showIcon={false} className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide" />;
  }
  if (normalized.includes("complete")) {
    return <StatusBadge status="success" label="Complete" showIcon={false} className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide" />;
  }
  return <StatusBadge status="neutral" label={status || "Unknown"} showIcon={false} className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide" />;
};

export default function MyCompany() {
  const navigate = useNavigate();

  const [contractRows, setContractRows] = useState<ContractMetricRow[]>([]);
  const [stockRows, setStockRows] = useState<DashboardStockRow[]>([]);
  const [invoiceRows, setInvoiceRows] = useState<DashboardInvoiceRow[]>([]);
  const [deliveryRows, setDeliveryRows] = useState<DashboardDeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (!isSupabaseConfigured || !supabase) {
        if (!cancelled) {
          setError("Supabase is not configured.");
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      const [contractRes, stockRes, invoiceRes, deliveryRes] = await Promise.all([
        supabase
          .from("contract_lines")
          .select("line_id, contract_id, job, product, team, status, ton, acc, date_to, contracts(customer, type, contractdate)")
          .order("date_to", { ascending: false }),
        supabase.from("stock").select("stock_id, factory, qty, tag, type"),
        supabase
          .from("finance_invoices")
          .select("id, invoice_date, status_type, usd, total_invoice, tons, customer_name, fac")
          .order("invoice_date", { ascending: false }),
        supabase
          .from("deliveries")
          .select("delivery_id, contract_id, job, delivery_date, quantity")
          .order("delivery_date", { ascending: false }),
      ]);

      if (cancelled) return;

      if (contractRes.error || stockRes.error || invoiceRes.error || deliveryRes.error) {
        setError(
          contractRes.error?.message ??
            stockRes.error?.message ??
            invoiceRes.error?.message ??
            deliveryRes.error?.message ??
            "Failed to load trade performance data.",
        );
        setContractRows([]);
        setStockRows([]);
        setInvoiceRows([]);
        setDeliveryRows([]);
        setLoading(false);
        return;
      }

      const mappedContracts = ((contractRes.data ?? []) as ContractLineDbRow[]).map((row, index) => {
        const ton = toNumber(row.ton);
        const acc = toNumber(row.acc);
        const customer = getContractField(row.contracts, "customer") ?? "Unknown customer";
        const contractType = getContractField(row.contracts, "type") ?? "-";
        const commitDate = getContractField(row.contracts, "contractdate");

        return {
          id: row.line_id ?? `${row.contract_id ?? "contract"}-${index}`,
          customer,
          contractId: row.contract_id ?? "-",
          commitDate,
          status: row.status ?? "Unknown",
          ton,
          acc,
          product: row.product ?? "-",
          job: row.job ?? "-",
          team: row.team ?? "-",
          contractType,
          dateTo: row.date_to ?? null,
          remainingTon: ton - acc,
        } satisfies ContractMetricRow;
      });

      const mappedStocks = ((stockRes.data ?? []) as StockDbRow[]).map((row, index) => ({
        id: String(row.stock_id ?? index),
        factory: normalizeFactory(row.factory),
        qty: toNumber(row.qty),
        tag: (row.tag ?? "-").trim() || "-",
        type: (row.type ?? "-").trim() || "-",
      } satisfies DashboardStockRow));

      const mappedInvoices = ((invoiceRes.data ?? []) as InvoiceDbRow[]).map((row, index) => ({
        id: row.id ?? `invoice-${index}`,
        invoiceDate: row.invoice_date ?? null,
        statusType: row.status_type ?? "Unknown",
        usd: toNumber(row.usd) || toNumber(row.total_invoice),
        tons: toNumber(row.tons),
        customerName: row.customer_name ?? "Unknown customer",
        factory: normalizeFactory(row.fac),
      } satisfies DashboardInvoiceRow));

      const mappedDeliveries = ((deliveryRes.data ?? []) as DeliveryDbRow[]).map((row, index) => ({
        id: row.delivery_id ?? `delivery-${index}`,
        deliveryDate: row.delivery_date ?? null,
        quantity: toNumber(row.quantity),
        contractId: row.contract_id,
        job: row.job,
      } satisfies DashboardDeliveryRow));

      setContractRows(mappedContracts);
      setStockRows(mappedStocks);
      setInvoiceRows(mappedInvoices);
      setDeliveryRows(mappedDeliveries);
      setLoading(false);
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    const totalCommitTon = contractRows.reduce((sum, row) => sum + row.ton, 0);
    const totalDeliveredTon = contractRows.reduce((sum, row) => sum + row.acc, 0);
    const totalInventory = stockRows.reduce((sum, row) => sum + row.qty, 0);
    const totalInvoiceUsd = invoiceRows.reduce((sum, row) => sum + row.usd, 0);
    const completionRate = totalCommitTon > 0 ? (totalDeliveredTon / totalCommitTon) * 100 : 0;

    return {
      totalCommitTon,
      totalDeliveredTon,
      totalInventory,
      totalInvoiceUsd,
      completionRate,
    };
  }, [contractRows, stockRows, invoiceRows]);

  const attentionItems = useMemo(() => {
    const items: Array<{
      severity: "urgent" | "warning" | "watch";
      title: string;
      description: string;
      action: string;
      href?: string;
    }> = [];

    const nowMs = new Date().setHours(0, 0, 0, 0);
    const dayMs = 1000 * 60 * 60 * 24;

    const overdueRows = contractRows.filter((row) => {
      const normalized = row.status.toLowerCase();
      if (normalized.includes("overdue")) return true;
      const dueMs = toDayMs(row.dateTo);
      return normalized.includes("pending") && dueMs !== null && dueMs < nowMs && row.remainingTon > 0;
    });

    if (overdueRows.length > 0) {
      const oldestOverdue = overdueRows
        .map((row) => row.dateTo)
        .filter(Boolean)
        .sort((a, b) => (toDayMs(a) ?? 0) - (toDayMs(b) ?? 0))[0] ?? null;

      items.push({
        severity: "urgent",
        title: `${overdueRows.length} Orders & Shipments overdue`,
        description: `Earliest overdue date: ${formatDate(oldestOverdue)}`,
        action: "Open orders",
        href: "/my-company/orders?attention=overdue-orders",
      });
    }

    const orderDueSoonRows = contractRows.filter((row) => {
      if (!row.status.toLowerCase().includes("pending")) return false;
      const dueMs = toDayMs(row.dateTo);
      if (dueMs === null) return false;
      const days = Math.floor((dueMs - nowMs) / dayMs);
      return days >= 0 && days <= 3;
    });

    if (orderDueSoonRows.length > 0) {
      const nearestDate = orderDueSoonRows
        .map((row) => row.dateTo)
        .filter(Boolean)
        .sort((a, b) => (toDayMs(a) ?? Number.MAX_SAFE_INTEGER) - (toDayMs(b) ?? Number.MAX_SAFE_INTEGER))[0] ?? null;

      items.push({
        severity: "warning",
        title: `${orderDueSoonRows.length} Orders & Shipments due in 3 days`,
        description: `Nearest due date: ${formatDate(nearestDate)}`,
        action: "Plan dispatch",
        href: "/my-company/orders?attention=due-orders-3d",
      });
    }

    const overdueInvoiceRows = invoiceRows.filter((row) => {
      const normalized = row.statusType.toLowerCase();
      if (normalized.includes("paid") || normalized.includes("cancel") || normalized.includes("void")) return false;
      const dueMs = toDayMs(row.invoiceDate);
      return dueMs !== null && dueMs < nowMs;
    });

    if (overdueInvoiceRows.length > 0) {
      const oldestInvoiceDate = overdueInvoiceRows
        .map((row) => row.invoiceDate)
        .filter(Boolean)
        .sort((a, b) => (toDayMs(a) ?? 0) - (toDayMs(b) ?? 0))[0] ?? null;

      items.push({
        severity: "urgent",
        title: `${overdueInvoiceRows.length} Invoices & Payments overdue`,
        description: `Earliest overdue date: ${formatDate(oldestInvoiceDate)}`,
        action: "Open invoices",
        href: "/my-company/invoices?attention=overdue-invoices",
      });
    }

    const invoiceDueSoonRows = invoiceRows.filter((row) => {
      const normalized = row.statusType.toLowerCase();
      if (normalized.includes("paid") || normalized.includes("cancel") || normalized.includes("void")) return false;
      const dueMs = toDayMs(row.invoiceDate);
      if (dueMs === null) return false;
      const days = Math.floor((dueMs - nowMs) / dayMs);
      return days >= 0 && days <= 3;
    });

    if (invoiceDueSoonRows.length > 0) {
      const nearestInvoiceDate = invoiceDueSoonRows
        .map((row) => row.invoiceDate)
        .filter(Boolean)
        .sort((a, b) => (toDayMs(a) ?? Number.MAX_SAFE_INTEGER) - (toDayMs(b) ?? Number.MAX_SAFE_INTEGER))[0] ?? null;

      items.push({
        severity: "warning",
        title: `${invoiceDueSoonRows.length} Invoices & Payments due in 3 days`,
        description: `Nearest due date: ${formatDate(nearestInvoiceDate)}. Send reminder now.`,
        action: "Send reminder",
        href: "/my-company/invoices?attention=due-invoices-3d",
      });
    }

    const financeFollowUpRows = invoiceRows.filter((row) => {
      const normalized = row.statusType.toLowerCase();
      return normalized.includes("provisional") || normalized.includes("adjust");
    });

    if (financeFollowUpRows.length > 0) {
      items.push({
        severity: "watch",
        title: `${financeFollowUpRows.length} invoices need follow-up`,
        description: "Provisional and adjustment invoices should be monitored.",
        action: "Review",
        href: "/my-company/invoices?attention=follow-up-invoices",
      });
    }

    if (items.length === 0) {
      items.push({
        severity: "watch",
        title: "No urgent issues detected",
        description: "Live checks are running across orders, inventory, and invoices.",
        action: "Monitor",
      });
    }

    return items;
  }, [contractRows, invoiceRows]);

  const recentCommitRows = useMemo<RecentCommitRow[]>(() => {
    return [...contractRows]
      .sort((a, b) => (toDayMs(b.commitDate) ?? 0) - (toDayMs(a.commitDate) ?? 0))
      .slice(0, 5)
      .map((row) => ({
        id: row.id,
        customer: row.customer,
        contractId: row.contractId,
        commitDate: row.commitDate,
        job: row.job,
        team: row.team,
        commitTon: row.ton,
        remainingTon: row.remainingTon,
        status: row.status,
      }));
  }, [contractRows]);

  const recentCommitColumns = useMemo(
    () => [
      {
        key: "job",
        header: "Job",
        render: (item: RecentCommitRow) => (
          <div>
            <button
              type="button"
              className="font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => navigate(`/my-company/orders?job=${encodeURIComponent(item.job)}`)}
            >
              {item.job}
            </button>
            <p className="text-xs text-muted-foreground">Team: {item.team}</p>
          </div>
        ),
      },
      {
        key: "customer",
        header: "Customer",
        render: (item: RecentCommitRow) => (
          <div>
            <p className="font-medium">{item.customer}</p>
            <p className="text-xs text-muted-foreground">Contract: {item.contractId}</p>
          </div>
        ),
      },
      {
        key: "commitTon",
        header: "Commit (MT)",
        align: "right" as const,
        render: (item: RecentCommitRow) => <span className="font-medium">{formatNumber(item.commitTon)} MT</span>,
      },
      {
        key: "remainingTon",
        header: "Balance (MT)",
        align: "right" as const,
        render: (item: RecentCommitRow) => <span>{formatNumber(item.remainingTon)} MT</span>,
      },
      {
        key: "status",
        header: "Status",
        align: "center" as const,
        render: (item: RecentCommitRow) => statusBadge(item.status),
      },
      {
        key: "commitDate",
        header: "Commit Date",
        render: (item: RecentCommitRow) => <span className="text-muted-foreground">{formatDate(item.commitDate)}</span>,
      },
    ],
    [navigate],
  );

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Trade Performance"
        subtitle={`Live trade snapshot — Updated ${new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}`}
      />

      <div className="flex-1 space-y-6 overflow-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
        {error ? (
          <section className="rounded-2xl border border-destructive/30 bg-card p-6 text-sm text-destructive">
            {error}
          </section>
        ) : null}

        <section className="rounded-2xl border bg-card/90 backdrop-blur">
          <div className="border-b border-border/70 px-4 py-4 md:px-5">
            <h2 className="text-base font-semibold">Executive Overview</h2>
            <p className="text-sm text-muted-foreground">
              Real-time summary from Orders & Shipments, Inventory, and Invoices & Payments.
            </p>
          </div>
          <div className="p-4 md:p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KPICard
                title="Commit Volume"
                value={formatMt(totals.totalCommitTon)}
                subtitle="From contract lines"
                icon={<Package className="h-5 w-5 text-muted-foreground" />}
              />
              <KPICard
                title="Delivered Volume"
                value={formatMt(totals.totalDeliveredTon)}
                subtitle={`Delivery rate ${totals.completionRate.toFixed(1)}%`}
                icon={<Clock className="h-5 w-5 text-muted-foreground" />}
              />
              <KPICard
                title="Inventory On Hand"
                value={formatMt(totals.totalInventory)}
                subtitle="Live stock snapshot"
                icon={<FileText className="h-5 w-5 text-muted-foreground" />}
              />
              <KPICard
                title="Invoice Value"
                value={formatMoneyCompact(totals.totalInvoiceUsd)}
                subtitle="From finance invoices"
                icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
              />
            </div>
          </div>
        </section>

        <ExecutiveTradeDashboard
          contractRows={contractRows}
          stockRows={stockRows}
          invoiceRows={invoiceRows}
          deliveryRows={deliveryRows}
          loading={loading}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border bg-card lg:col-span-1">
            <div className="flex items-center justify-between border-b px-4 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <h2 className="font-semibold">Attention Required</h2>
              </div>
              <span className="text-sm text-muted-foreground">{attentionItems.length} items</span>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-auto p-3">
              {loading ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-3 py-8 text-center text-sm text-muted-foreground">
                  Loading alerts...
                </div>
              ) : (
                attentionItems.map((item, index) => (
                  <AttentionItem
                    key={`${item.title}-${index}`}
                    severity={item.severity}
                    title={item.title}
                    description={item.description}
                    action={item.action}
                    onClick={item.href ? () => navigate(item.href) : undefined}
                  />
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border bg-card lg:col-span-2">
            <div className="flex items-center justify-between border-b px-4 py-4">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <h2 className="font-semibold">Recent Commit Date</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-primary"
                onClick={() => navigate("/my-company/orders")}
              >
                View Orders & Shipments
              </Button>
            </div>
            <div className="p-0">
              {loading ? (
                <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-3 py-10 text-center text-sm text-muted-foreground">
                  Loading recent commit dates...
                </div>
              ) : (
                <DataTable
                  columns={recentCommitColumns}
                  data={recentCommitRows}
                  className={[
                    "rounded-none border-0 shadow-none",
                    "[&_table]:min-w-[980px] [&_table]:border-separate [&_table]:border-spacing-0",
                    "[&_thead_tr]:border-b [&_thead_tr]:border-slate-200/70 [&_thead_tr]:bg-slate-50/90",
                    "[&_th]:px-5 [&_th]:py-3.5 [&_th]:text-[12px] [&_th]:font-semibold [&_th]:tracking-[0.01em] [&_th]:text-slate-600",
                    "[&_td]:px-5 [&_td]:py-4 [&_td]:align-middle [&_td]:text-[13px] sm:[&_td]:text-sm",
                    "[&_tbody_tr]:border-b [&_tbody_tr]:border-slate-200/70",
                    "[&_tbody_tr:nth-child(odd)]:bg-white [&_tbody_tr:nth-child(even)]:bg-slate-50/45",
                    "[&_tbody_tr:hover]:bg-slate-100/70",
                  ].join(" ")}
                  emptyMessage="No commit date records found."
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
