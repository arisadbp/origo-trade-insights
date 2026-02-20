import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DashboardContractRow = {
  id: string;
  customer: string;
  contractId: string;
  commitDate: string | null;
  status: string;
  ton: number;
  acc: number;
  dateTo?: string | null;
  product?: string | null;
};

export type DashboardStockRow = {
  id: string;
  factory: string;
  qty: number;
  type: string;
  tag: string;
};

export type DashboardInvoiceRow = {
  id: string;
  invoiceDate: string | null;
  statusType: string;
  usd: number;
  tons: number;
  customerName: string;
  factory: string;
};

export type DashboardDeliveryRow = {
  id: string;
  deliveryDate: string | null;
  quantity: number;
  contractId: string | null;
  job: string | null;
};

type SectionId =
  | "kpiCards"
  | "deliveredTrend"
  | "topCustomers"
  | "salesByProduct"
  | "overdueContracts";

type SectionDefinition = {
  id: SectionId;
  title: string;
  description: string;
};

type RankedRow = {
  label: string;
  value: number;
};

type OverdueRow = {
  id: string;
  contractId: string;
  customer: string;
  dueDate: string | null;
  backlogTon: number;
  status: string;
};

interface ExecutiveTradeDashboardProps {
  contractRows: DashboardContractRow[];
  stockRows: DashboardStockRow[];
  invoiceRows: DashboardInvoiceRow[];
  deliveryRows: DashboardDeliveryRow[];
  loading?: boolean;
}

const STORAGE_KEY = "trade-performance-visible-sections-v1";

const SECTIONS: SectionDefinition[] = [
  {
    id: "kpiCards",
    title: "KPI Cards",
    description: "Delivered Tons, Backlog Tons, Overdue Contracts, Invoice USD",
  },
  {
    id: "deliveredTrend",
    title: "Delivered Tons Trend",
    description: "Vertical bar chart by month",
  },
  {
    id: "topCustomers",
    title: "Top Customer Tables",
    description: "Top customers by Tons and USD",
  },
  {
    id: "salesByProduct",
    title: "Sale by Product (Tons)",
    description: "Horizontal bar chart",
  },
  {
    id: "overdueContracts",
    title: "Overdue Contracts Table",
    description: "Contracts that need follow-up",
  },
];

const DEFAULT_SECTIONS: SectionId[] = [
  "kpiCards",
  "deliveredTrend",
  "topCustomers",
  "salesByProduct",
  "overdueContracts",
];

const AXIS_TICK = { fontSize: 11 };
const CARD_CLASS = "rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.05)]";

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

const formatMonthKey = (value: string | null | undefined) => {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year > 0 && month >= 1 && month <= 12) return `${year}-${String(month).padStart(2, "0")}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
};

const toDayMs = (value: string | null | undefined) => {
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

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const isContractOverdue = (row: DashboardContractRow, nowMs: number) => {
  const normalizedStatus = row.status.trim().toLowerCase();
  const backlog = Math.max(0, toNumber(row.ton) - toNumber(row.acc));
  if (normalizedStatus.includes("overdue")) return true;
  const dueMs = toDayMs(row.dateTo ?? null);
  return normalizedStatus.includes("pending") && dueMs !== null && dueMs < nowMs && backlog > 0;
};

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ChartShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(CARD_CLASS, "px-4 py-4 md:px-5 md:py-5")}>
      <div className="mb-3">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ChartEmptyState({ message = "No data available" }: { message?: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function TopTable({
  title,
  unitLabel,
  rows,
  valueFormatter,
}: {
  title: string;
  unitLabel: string;
  rows: RankedRow[];
  valueFormatter: (value: number) => string;
}) {
  return (
    <section className={cn(CARD_CLASS, "px-4 py-4")}>
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground">{unitLabel}</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">
          No data available
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Customer</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">{unitLabel}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.label}-${row.value}`} className="border-t border-border/60">
                  <td className="px-3 py-2.5">{row.label}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{valueFormatter(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ExecutiveTradeDashboard({
  contractRows,
  stockRows,
  invoiceRows,
  deliveryRows,
  loading = false,
}: ExecutiveTradeDashboardProps) {
  const [visibleSections, setVisibleSections] = useState<SectionId[]>(DEFAULT_SECTIONS);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as SectionId[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const valid = parsed.filter((id) => SECTIONS.some((section) => section.id === id));
      if (valid.length > 0) setVisibleSections(valid);
    } catch {
      // Ignore invalid localStorage payload.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleSections));
  }, [visibleSections]);

  const nowMs = useMemo(() => new Date().setHours(0, 0, 0, 0), []);

  const normalizedContracts = useMemo(
    () =>
      contractRows.map((row) => {
        const ton = toNumber(row.ton);
        const delivered = toNumber(row.acc);
        const backlog = Math.max(0, ton - delivered);
        return {
          ...row,
          ton,
          delivered,
          backlog,
          customer: row.customer?.trim() || "Unknown customer",
          product: row.product?.trim() || "Unknown product",
        };
      }),
    [contractRows],
  );

  const kpis = useMemo(() => {
    const deliveredTons = deliveryRows.reduce((sum, row) => sum + toNumber(row.quantity), 0);
    const backlogTons = normalizedContracts.reduce((sum, row) => sum + row.backlog, 0);
    const overdueContracts = normalizedContracts.filter((row) => isContractOverdue(row, nowMs)).length;
    const invoiceUsd = invoiceRows.reduce((sum, row) => sum + toNumber(row.usd), 0);

    return { deliveredTons, backlogTons, overdueContracts, invoiceUsd };
  }, [deliveryRows, invoiceRows, normalizedContracts, nowMs]);

  const deliveredTrendData = useMemo(() => {
    const axis = new Set<string>();
    const deliveredMap = new Map<string, number>();

    deliveryRows.forEach((row) => {
      const key = formatMonthKey(row.deliveryDate);
      if (!key) return;
      axis.add(key);
      deliveredMap.set(key, (deliveredMap.get(key) ?? 0) + toNumber(row.quantity));
    });

    const sortedAxis = [...axis].sort((a, b) => a.localeCompare(b)).slice(-12);
    return sortedAxis.map((monthKey) => ({
      month: monthKey,
      label: formatMonthLabel(monthKey),
      deliveredTons: deliveredMap.get(monthKey) ?? 0,
    }));
  }, [deliveryRows]);

  const topCustomersByTons = useMemo<RankedRow[]>(() => {
    const map = new Map<string, number>();
    normalizedContracts.forEach((row) => {
      map.set(row.customer, (map.get(row.customer) ?? 0) + row.ton);
    });
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [normalizedContracts]);

  const topCustomersByUsd = useMemo<RankedRow[]>(() => {
    const map = new Map<string, number>();
    invoiceRows.forEach((row) => {
      const label = row.customerName?.trim() || "Unknown customer";
      map.set(label, (map.get(label) ?? 0) + toNumber(row.usd));
    });
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [invoiceRows]);

  const salesByProductRows = useMemo<RankedRow[]>(() => {
    const map = new Map<string, number>();
    normalizedContracts.forEach((row) => {
      map.set(row.product, (map.get(row.product) ?? 0) + row.ton);
    });
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [normalizedContracts]);

  const overdueRows = useMemo<OverdueRow[]>(() => {
    return normalizedContracts
      .filter((row) => isContractOverdue(row, nowMs))
      .map((row) => ({
        id: row.id,
        contractId: row.contractId,
        customer: row.customer,
        dueDate: row.dateTo ?? null,
        backlogTon: row.backlog,
        status: row.status || "Overdue",
      }))
      .sort((a, b) => {
        const aMs = toDayMs(a.dueDate);
        const bMs = toDayMs(b.dueDate);
        if (aMs === null && bMs === null) return b.backlogTon - a.backlogTon;
        if (aMs === null) return 1;
        if (bMs === null) return -1;
        return aMs - bMs;
      });
  }, [normalizedContracts, nowMs]);

  const overdueColumns = useMemo(
    () => [
      {
        key: "contractId",
        header: "Contract",
        render: (item: OverdueRow) => <span className="font-medium">{item.contractId || "-"}</span>,
      },
      {
        key: "customer",
        header: "Customer",
        render: (item: OverdueRow) => <span>{item.customer}</span>,
      },
      {
        key: "dueDate",
        header: "Due Date",
        render: (item: OverdueRow) => <span>{formatDate(item.dueDate)}</span>,
      },
      {
        key: "backlogTon",
        header: "Backlog Tons",
        align: "right" as const,
        render: (item: OverdueRow) => <span className="font-medium">{formatNumber(item.backlogTon)}</span>,
      },
      {
        key: "status",
        header: "Status",
        render: (item: OverdueRow) => (
          <Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-900">
            {item.status}
          </Badge>
        ),
      },
    ],
    [],
  );

  const isVisible = (id: SectionId) => visibleSections.includes(id);

  const toggleSection = (id: SectionId, checked: boolean | "indeterminate") => {
    const nextChecked = checked === true;
    if (nextChecked) {
      setVisibleSections((prev) => (prev.includes(id) ? prev : [...prev, id]));
      return;
    }

    setVisibleSections((prev) => {
      if (!prev.includes(id)) return prev;
      if (prev.length === 1) return prev;
      return prev.filter((sectionId) => sectionId !== id);
    });
  };

  return (
    <section className="rounded-2xl border bg-card/95 p-4 shadow-sm md:p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Trade Performance Dashboard</h2>
          <p className="text-sm text-muted-foreground">Customize the view by business function.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <LayoutGrid className="h-3.5 w-3.5" />
            {visibleSections.length} sections
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setVisibleSections(DEFAULT_SECTIONS)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" size="sm" className="gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Customize View
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[350px] space-y-3">
              <div>
                <p className="text-sm font-semibold">Choose Sections</p>
                <p className="text-xs text-muted-foreground">At least one section must remain visible.</p>
              </div>
              <div className="space-y-3">
                {SECTIONS.map((section) => {
                  const checked = visibleSections.includes(section.id);
                  return (
                    <label key={section.id} className="flex cursor-pointer items-start gap-3">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) => toggleSection(section.id, next)}
                        className="mt-0.5 border-slate-300 data-[state=unchecked]:bg-slate-100"
                      />
                      <div className={cn(!checked && "text-slate-400")}>
                        <p className={cn("text-sm font-medium leading-tight", !checked && "text-slate-500")}>
                          {section.title}
                        </p>
                        <p className={cn("text-xs text-muted-foreground", !checked && "text-slate-400")}>
                          {section.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-16 text-center text-sm text-muted-foreground">
          Loading dashboard data...
        </div>
      ) : (
        <div className="space-y-5">
          {isVisible("kpiCards") && (
            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Delivered Tons" value={formatNumber(kpis.deliveredTons)} />
              <MetricCard label="Backlog Tons" value={formatNumber(kpis.backlogTons)} />
              <MetricCard label="Overdue Contracts" value={formatNumber(kpis.overdueContracts)} />
              <MetricCard label="Invoice USD" value={formatMoney(kpis.invoiceUsd)} />
            </section>
          )}

          {isVisible("deliveredTrend") && (
            <ChartShell
              title="Delivered Tons Trend"
              description="Monthly delivered tons (Vertical Bar)"
            >
              {deliveredTrendData.length === 0 ? (
                <ChartEmptyState />
              ) : (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deliveredTrendData} margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                      <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(value) => formatNumber(value)} />
                      <Tooltip formatter={(value: number) => `${formatNumber(value)} Tons`} />
                      <Bar dataKey="deliveredTons" fill="#ffbd59" radius={[8, 8, 0, 0]} maxBarSize={34}>
                        <LabelList
                          dataKey="deliveredTons"
                          position="top"
                          formatter={(value: number) => formatNumber(value)}
                          style={{ fill: "#475569", fontSize: 11, fontWeight: 600 }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartShell>
          )}

          {isVisible("topCustomers") && (
            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <TopTable
                title="Top Customers by Tons (Operation)"
                unitLabel="Tons"
                rows={topCustomersByTons}
                valueFormatter={(value) => formatNumber(value)}
              />
              <TopTable
                title="Top Customers by USD (Finance)"
                unitLabel="USD"
                rows={topCustomersByUsd}
                valueFormatter={(value) => formatMoney(value)}
              />
            </section>
          )}

          {isVisible("salesByProduct") && (
            <ChartShell
              title="Sale by Product (Tons)"
              description="Horizontal bar chart by product"
            >
              {salesByProductRows.length === 0 ? (
                <ChartEmptyState />
              ) : (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesByProductRows} layout="vertical" margin={{ top: 8, right: 12, left: 38, bottom: 0 }}>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(value) => formatNumber(value)} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        width={130}
                        tick={AXIS_TICK}
                        tickFormatter={(value: string) => (value.length > 18 ? `${value.slice(0, 15)}...` : value)}
                      />
                      <Tooltip formatter={(value: number) => `${formatNumber(value)} Tons`} />
                      <Bar dataKey="value" fill="#334155" radius={[999, 999, 999, 999]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartShell>
          )}

          {isVisible("overdueContracts") && (
            <section className={cn(CARD_CLASS, "overflow-hidden")}>
              <div className="border-b border-border/70 px-4 py-4 md:px-5">
                <h3 className="text-base font-semibold tracking-tight text-foreground">Overdue Contracts Table</h3>
                <p className="text-sm text-muted-foreground">Contracts with overdue status or overdue pending backlog.</p>
              </div>
              <div className="p-0">
                <DataTable
                  columns={overdueColumns}
                  data={overdueRows}
                  emptyMessage="No overdue contracts."
                  className={[
                    "rounded-none border-0 shadow-none",
                    "[&_table]:min-w-[860px] [&_table]:border-separate [&_table]:border-spacing-0",
                    "[&_thead_tr]:border-b [&_thead_tr]:border-slate-200/70 [&_thead_tr]:bg-slate-50/90",
                    "[&_th]:px-5 [&_th]:py-3.5 [&_th]:text-[12px] [&_th]:font-semibold [&_th]:tracking-[0.01em] [&_th]:text-slate-600",
                    "[&_td]:px-5 [&_td]:py-4 [&_td]:align-middle [&_td]:text-[13px] sm:[&_td]:text-sm",
                    "[&_tbody_tr]:border-b [&_tbody_tr]:border-slate-200/70",
                    "[&_tbody_tr:nth-child(odd)]:bg-white [&_tbody_tr:nth-child(even)]:bg-slate-50/45",
                    "[&_tbody_tr:hover]:bg-slate-100/70",
                  ].join(" ")}
                />
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
