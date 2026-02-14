import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

type WidgetId =
  | "inventoryVsSalesCapacity"
  | "invoiceValueTrend"
  | "deliveryProgress"
  | "topCustomers"
  | "contractStatusMix"
  | "invoiceStatusMix"
  | "commitVolumeTrend"
  | "deliveryVsCommit"
  | "inventoryByFactory"
  | "inventoryByType";

type WidgetDefinition = {
  id: WidgetId;
  title: string;
  description: string;
};

type MixRow = {
  name: string;
  value: number;
  color: string;
};

type RankedRow = {
  label: string;
  value: number;
};

interface ExecutiveTradeDashboardProps {
  contractRows: DashboardContractRow[];
  stockRows: DashboardStockRow[];
  invoiceRows: DashboardInvoiceRow[];
  loading?: boolean;
}

const STORAGE_KEY = "trade-performance-visible-widgets-v4";

const WIDGETS: WidgetDefinition[] = [
  {
    id: "inventoryVsSalesCapacity",
    title: "Inventory vs Sales",
    description: "The primary performance view for executive review",
  },
  {
    id: "invoiceValueTrend",
    title: "Invoice Value Trend",
    description: "How invoice value is moving over time",
  },
  {
    id: "deliveryProgress",
    title: "Delivery Progress",
    description: "Current state of delivery execution",
  },
  {
    id: "topCustomers",
    title: "Top Customers by Commit",
    description: "Largest committed volume by customer",
  },
  {
    id: "contractStatusMix",
    title: "Contract Status Mix",
    description: "Pending, overdue, complete split",
  },
  {
    id: "invoiceStatusMix",
    title: "Invoice Status Mix",
    description: "Final, provisional, adjustment split",
  },
  {
    id: "commitVolumeTrend",
    title: "Commit Volume Trend",
    description: "Monthly commit volume movement",
  },
  {
    id: "deliveryVsCommit",
    title: "Delivered vs Commit",
    description: "Delivery execution against commitment",
  },
  {
    id: "inventoryByFactory",
    title: "Inventory by Factory",
    description: "Factory-level inventory concentration",
  },
  {
    id: "inventoryByType",
    title: "Inventory by Product Type",
    description: "Product type concentration view",
  },
];

const DEFAULT_WIDGETS: WidgetId[] = [
  "inventoryVsSalesCapacity",
  "invoiceValueTrend",
  "deliveryProgress",
  "topCustomers",
];

const AXIS_TICK = { fontSize: 11 };
const CHART_CARD_CLASS = "rounded-[22px] border border-border/70 bg-card px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

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

const formatMt = (value: number) => `${formatNumber(value)} MT`;

const formatMoneyCompact = (value: number) => {
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${Math.round(value)}`;
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const truncateLabel = (value: string, maxLength = 16) => {
  const input = (value ?? "").trim();
  if (input.length <= maxLength) return input;
  return `${input.slice(0, Math.max(1, maxLength - 3))}...`;
};

const toMonthKey = (value: string | null | undefined) => {
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

const monthLabel = (key: string) => {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
};

const buildMonthAxis = (dates: Array<string | null>, limit = 12) => {
  const set = new Set<string>();
  dates.forEach((value) => {
    const key = toMonthKey(value);
    if (key) set.add(key);
  });

  const sorted = [...set].sort((a, b) => a.localeCompare(b));
  if (sorted.length > 0) return sorted.slice(-limit);

  const fallback: string[] = [];
  const now = new Date();
  for (let i = limit - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    fallback.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return fallback;
};

const normalizeContractStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes("overdue")) return "Overdue";
  if (normalized.includes("pending")) return "Pending";
  if (normalized.includes("complete")) return "Complete";
  return "Other";
};

const normalizeInvoiceStatus = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized.includes("final")) return "Final";
  if (normalized.includes("provisional")) return "Provisional";
  if (normalized.includes("adjust")) return "Adjustment";
  return "Other";
};

const getDeliveryProgress = (ton: number, acc: number) => {
  if (acc <= 0) return "Not started";
  if (ton > 0 && acc >= ton) return "Completed";
  return "In progress";
};

function ChartShell({
  title,
  description,
  children,
  contentClassName,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <section className={CHART_CARD_CLASS}>
      <div className="mb-4">
        <h3 className="text-[17px] font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
      </div>
      <div className={cn("w-full", contentClassName ?? "h-[210px]")}>{children}</div>
    </section>
  );
}

function ChartEmptyState({ message = "No data available" }: { message?: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/70 bg-muted/10 text-xs text-muted-foreground">
      {message}
    </div>
  );
}

function MixStrip({ rows }: { rows: MixRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  if (total <= 0) {
    return <ChartEmptyState />;
  }

  return (
    <div className="space-y-4">
      <div className="h-2 overflow-hidden rounded-full bg-muted/60">
        <div className="flex h-full w-full">
          {rows.map((row) => {
            const pct = (row.value / total) * 100;
            return (
              <div
                key={row.name}
                style={{ width: `${Math.max(2, pct)}%`, backgroundColor: row.color }}
                title={`${row.name}: ${formatNumber(row.value)} (${formatPercent(pct)})`}
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row) => {
          const pct = total > 0 ? (row.value / total) * 100 : 0;
          return (
            <div key={row.name} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
              <div className="min-w-0 flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                <span className="truncate text-xs font-medium text-foreground">{row.name}</span>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold text-foreground">{formatPercent(pct)}</p>
                <p className="text-[11px] text-muted-foreground">{formatNumber(row.value)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgressStrip({ rows }: { rows: RankedRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  if (total <= 0) {
    return <ChartEmptyState />;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const pct = total > 0 ? (row.value / total) * 100 : 0;
        return (
          <div key={row.label} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{row.label}</span>
              <span className="text-muted-foreground">{formatNumber(row.value)} ({formatPercent(pct)})</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
              <div className="h-full rounded-full bg-slate-700" style={{ width: `${Math.max(2, pct)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankedHorizontalBars({
  rows,
  valueFormatter,
}: {
  rows: RankedRow[];
  valueFormatter: (value: number) => string;
}) {
  if (rows.length === 0) {
    return <ChartEmptyState />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 6, right: 8, left: 42, bottom: 0 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          tickFormatter={(value) => formatNumber(value)}
        />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={AXIS_TICK}
          width={132}
          tickFormatter={(value: string) => truncateLabel(value, 16)}
        />
        <Tooltip
          formatter={(value: number) => valueFormatter(value)}
          labelFormatter={(label) => String(label)}
        />
        <Bar dataKey="value" fill="#334155" radius={[999, 999, 999, 999]} barSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ExecutiveTradeDashboard({
  contractRows,
  stockRows,
  invoiceRows,
  loading = false,
}: ExecutiveTradeDashboardProps) {
  const [selectedWidgets, setSelectedWidgets] = useState<WidgetId[]>(DEFAULT_WIDGETS);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as WidgetId[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const valid = parsed.filter((id) => WIDGETS.some((widget) => widget.id === id));
      if (valid.length > 0) setSelectedWidgets(valid);
    } catch {
      // Ignore invalid localStorage payload.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedWidgets));
  }, [selectedWidgets]);

  const monthAxis = useMemo(
    () =>
      buildMonthAxis([
        ...contractRows.map((row) => row.commitDate),
        ...invoiceRows.map((row) => row.invoiceDate),
      ]),
    [contractRows, invoiceRows],
  );

  const monthlySeries = useMemo(() => {
    const commitMap = new Map<string, number>();
    const deliveredMap = new Map<string, number>();
    const invoiceUsdMap = new Map<string, number>();
    const invoiceTonMap = new Map<string, number>();

    contractRows.forEach((row) => {
      const key = toMonthKey(row.commitDate);
      if (!key) return;
      commitMap.set(key, (commitMap.get(key) ?? 0) + toNumber(row.ton));
      deliveredMap.set(key, (deliveredMap.get(key) ?? 0) + toNumber(row.acc));
    });

    invoiceRows.forEach((row) => {
      const key = toMonthKey(row.invoiceDate);
      if (!key) return;
      invoiceUsdMap.set(key, (invoiceUsdMap.get(key) ?? 0) + toNumber(row.usd));
      invoiceTonMap.set(key, (invoiceTonMap.get(key) ?? 0) + toNumber(row.tons));
    });

    return monthAxis.map((key) => ({
      month: key,
      label: monthLabel(key),
      commitTon: commitMap.get(key) ?? 0,
      deliveredTon: deliveredMap.get(key) ?? 0,
      invoiceUsd: invoiceUsdMap.get(key) ?? 0,
      invoiceTon: invoiceTonMap.get(key) ?? 0,
    }));
  }, [contractRows, invoiceRows, monthAxis]);

  const totals = useMemo(() => {
    const totalCommit = contractRows.reduce((sum, row) => sum + toNumber(row.ton), 0);
    const totalDelivered = contractRows.reduce((sum, row) => sum + toNumber(row.acc), 0);
    const totalInventory = stockRows.reduce((sum, row) => sum + toNumber(row.qty), 0);
    const totalInvoiceUsd = invoiceRows.reduce((sum, row) => sum + toNumber(row.usd), 0);

    return {
      totalCommit,
      totalDelivered,
      totalInventory,
      totalInvoiceUsd,
    };
  }, [contractRows, stockRows, invoiceRows]);

  const inventoryVsSalesCapacityData = useMemo(() => {
    const hasInvoiceTons = monthlySeries.some((row) => row.invoiceTon > 0);

    return monthlySeries.map((row) => ({
      month: row.month,
      label: row.label,
      inventory: totals.totalInventory,
      sales: hasInvoiceTons ? row.invoiceTon : row.deliveredTon,
      capacity: 0,
    }));
  }, [monthlySeries, totals.totalInventory]);

  const inventoryVsSalesSummary = useMemo(() => {
    const count = Math.max(1, inventoryVsSalesCapacityData.length);
    const aggregated = inventoryVsSalesCapacityData.reduce(
      (acc, row) => {
        acc.inventory += row.inventory;
        acc.sales += row.sales;
        if (row.sales > row.inventory) acc.salesAboveInventory += 1;
        return acc;
      },
      { inventory: 0, sales: 0, salesAboveInventory: 0 },
    );

    return {
      avgInventory: aggregated.inventory / count,
      avgSales: aggregated.sales / count,
      salesAboveInventory: aggregated.salesAboveInventory,
      months: inventoryVsSalesCapacityData.length,
    };
  }, [inventoryVsSalesCapacityData]);

  const contractStatusMixRows = useMemo<MixRow[]>(() => {
    const map = new Map<string, number>();
    contractRows.forEach((row) => {
      const key = normalizeContractStatus(row.status);
      map.set(key, (map.get(key) ?? 0) + 1);
    });

    const palette: Record<string, string> = {
      Pending: "#f59e0b",
      Overdue: "#ef4444",
      Complete: "#334155",
      Other: "#94a3b8",
    };

    return ["Pending", "Overdue", "Complete", "Other"]
      .map((name) => ({ name, value: map.get(name) ?? 0, color: palette[name] }))
      .filter((row) => row.value > 0);
  }, [contractRows]);

  const invoiceStatusMixRows = useMemo<MixRow[]>(() => {
    const map = new Map<string, number>();
    invoiceRows.forEach((row) => {
      const key = normalizeInvoiceStatus(row.statusType);
      map.set(key, (map.get(key) ?? 0) + 1);
    });

    const palette: Record<string, string> = {
      Final: "#334155",
      Provisional: "#f59e0b",
      Adjustment: "#3b82f6",
      Other: "#94a3b8",
    };

    return ["Final", "Provisional", "Adjustment", "Other"]
      .map((name) => ({ name, value: map.get(name) ?? 0, color: palette[name] }))
      .filter((row) => row.value > 0);
  }, [invoiceRows]);

  const deliveryProgressRows = useMemo<RankedRow[]>(() => {
    const map = new Map<string, number>();
    contractRows.forEach((row) => {
      const key = getDeliveryProgress(toNumber(row.ton), toNumber(row.acc));
      map.set(key, (map.get(key) ?? 0) + 1);
    });

    return ["Not started", "In progress", "Completed"].map((label) => ({
      label,
      value: map.get(label) ?? 0,
    }));
  }, [contractRows]);

  const topCustomers = useMemo<RankedRow[]>(() => {
    const map = new Map<string, number>();
    contractRows.forEach((row) => {
      const key = row.customer?.trim() || "Unknown";
      map.set(key, (map.get(key) ?? 0) + toNumber(row.ton));
    });

    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [contractRows]);

  const inventoryByFactory = useMemo<RankedRow[]>(() => {
    const map = new Map<string, number>();
    stockRows.forEach((row) => {
      const key = row.factory?.trim() || "Unknown";
      map.set(key, (map.get(key) ?? 0) + toNumber(row.qty));
    });

    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [stockRows]);

  const inventoryByType = useMemo<RankedRow[]>(() => {
    const map = new Map<string, number>();
    stockRows.forEach((row) => {
      const key = row.type?.trim() || "Unknown";
      map.set(key, (map.get(key) ?? 0) + toNumber(row.qty));
    });

    const sorted = [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    if (sorted.length <= 6) return sorted;

    const top = sorted.slice(0, 5);
    const other = sorted.slice(5).reduce((sum, row) => sum + row.value, 0);
    return [...top, { label: "Other", value: other }];
  }, [stockRows]);

  const isVisible = (id: WidgetId) => selectedWidgets.includes(id);

  const toggleWidget = (id: WidgetId, checked: boolean | "indeterminate") => {
    const nextChecked = checked === true;
    if (nextChecked) {
      setSelectedWidgets((prev) => (prev.includes(id) ? prev : [...prev, id]));
      return;
    }

    setSelectedWidgets((prev) => {
      if (!prev.includes(id)) return prev;
      if (prev.length === 1) return prev;
      return prev.filter((widgetId) => widgetId !== id);
    });
  };

  const renderWidget = (id: WidgetId) => {
    switch (id) {
      case "contractStatusMix":
        return <MixStrip rows={contractStatusMixRows} />;

      case "invoiceStatusMix":
        return <MixStrip rows={invoiceStatusMixRows} />;

      case "deliveryProgress":
        return <ProgressStrip rows={deliveryProgressRows} />;

      case "topCustomers":
        return <RankedHorizontalBars rows={topCustomers} valueFormatter={formatMt} />;

      case "inventoryByFactory":
        return <RankedHorizontalBars rows={inventoryByFactory} valueFormatter={formatMt} />;

      case "inventoryByType":
        return <RankedHorizontalBars rows={inventoryByType} valueFormatter={formatMt} />;

      case "commitVolumeTrend":
        return monthlySeries.length === 0 ? (
          <ChartEmptyState />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlySeries} margin={{ top: 8, right: 8, left: 12, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={22} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={78}
                tick={AXIS_TICK}
                tickFormatter={(value) => formatNumber(value)}
              />
              <Tooltip formatter={(value: number) => formatMt(value)} />
              <Line type="monotone" dataKey="commitTon" stroke="#334155" strokeWidth={2.4} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        );

      case "deliveryVsCommit":
        return monthlySeries.length === 0 ? (
          <ChartEmptyState />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlySeries} margin={{ top: 8, right: 8, left: 12, bottom: 0 }}>
              <defs>
                <linearGradient id="executive-delivery-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ffbd59" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#ffbd59" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={22} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={78}
                tick={AXIS_TICK}
                tickFormatter={(value) => formatNumber(value)}
              />
              <Tooltip formatter={(value: number, name) => `${name === "deliveredTon" ? "Delivered" : "Commit"}: ${formatMt(value)}`} />
              <Area type="monotone" dataKey="deliveredTon" stroke="#ffbd59" fill="url(#executive-delivery-fill)" strokeWidth={2.2} />
              <Line type="monotone" dataKey="commitTon" stroke="#334155" strokeWidth={1.8} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        );

      case "invoiceValueTrend":
        return monthlySeries.length === 0 ? (
          <ChartEmptyState />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlySeries} margin={{ top: 8, right: 8, left: 18, bottom: 0 }}>
              <defs>
                <linearGradient id="executive-invoice-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={22} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={88}
                tick={AXIS_TICK}
                tickFormatter={(value) => formatMoneyCompact(value)}
              />
              <Tooltip formatter={(value: number) => formatMoneyCompact(value)} />
              <Area type="monotone" dataKey="invoiceUsd" stroke="#2563eb" fill="url(#executive-invoice-fill)" strokeWidth={2.4} />
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return <ChartEmptyState />;
    }
  };

  const renderWidgetCard = (id: WidgetId) => {
    if (!isVisible(id)) return null;
    const widget = WIDGETS.find((item) => item.id === id);
    if (!widget) return null;

    if (id === "inventoryVsSalesCapacity") {
      return (
        <section key={id} className={cn(CHART_CARD_CLASS, "lg:col-span-2 2xl:col-span-3")}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[20px] font-semibold tracking-tight text-foreground">Inventory vs Sales</h3>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Monthly structure view. Production capacity is paused.
              </p>
            </div>
            <div className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs text-muted-foreground">
              Last 12 months
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-background px-3.5 py-3">
              <p className="text-[11px] text-muted-foreground">Average Inventory</p>
              <p className="mt-1 text-base font-semibold text-foreground">{formatMt(inventoryVsSalesSummary.avgInventory)}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background px-3.5 py-3">
              <p className="text-[11px] text-muted-foreground">Average Sales</p>
              <p className="mt-1 text-base font-semibold text-foreground">{formatMt(inventoryVsSalesSummary.avgSales)}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background px-3.5 py-3">
              <p className="text-[11px] text-muted-foreground">Sales Above Inventory</p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {inventoryVsSalesSummary.salesAboveInventory} / {inventoryVsSalesSummary.months}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background px-3.5 py-3">
              <p className="text-[11px] text-muted-foreground">Capacity</p>
              <p className="mt-1 text-base font-semibold text-muted-foreground">Paused</p>
            </div>
          </div>

          {inventoryVsSalesCapacityData.length === 0 ? (
            <div className="h-[320px]">
              <ChartEmptyState />
            </div>
          ) : (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={inventoryVsSalesCapacityData} margin={{ top: 8, right: 10, left: 14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="executive-inventory-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.06} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={20} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={82}
                    tick={AXIS_TICK}
                    tickFormatter={(value) => formatNumber(value)}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "inventory") return `Inventory: ${formatMt(value)}`;
                      if (name === "sales") return `Sales: ${formatMt(value)}`;
                      return `Capacity: ${formatMt(value)}`;
                    }}
                  />
                  <Area type="monotone" dataKey="inventory" stroke="#94a3b8" fill="url(#executive-inventory-fill)" strokeWidth={1.8} />
                  <Line type="monotone" dataKey="sales" stroke="#ffbd59" strokeWidth={2.6} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-400" />
              Inventory
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#ffbd59]" />
              Sales
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              Capacity (paused)
            </span>
          </div>
        </section>
      );
    }

    const compactWidgets: WidgetId[] = ["contractStatusMix", "invoiceStatusMix", "deliveryProgress"];
    const isCompact = compactWidgets.includes(id);

    return (
      <ChartShell
        key={id}
        title={widget.title}
        description={widget.description}
        contentClassName={isCompact ? "h-auto" : "h-[210px]"}
      >
        {renderWidget(id)}
      </ChartShell>
    );
  };

  return (
    <section className="rounded-2xl border bg-card/95 p-4 shadow-sm md:p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Trade Performance Dashboard</h2>
          <p className="text-sm text-muted-foreground">Executive-minimal layout focused on signal, not noise.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <LayoutGrid className="h-3.5 w-3.5" />
            {selectedWidgets.length} charts
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setSelectedWidgets(DEFAULT_WIDGETS)}
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
            <PopoverContent align="end" className="w-[336px] space-y-3">
              <div>
                <p className="text-sm font-semibold">Choose Dashboard Charts</p>
                <p className="text-xs text-muted-foreground">Default view is minimal. Add more charts when needed.</p>
              </div>
              <div className="max-h-[320px] space-y-3 overflow-auto pr-1">
                {WIDGETS.map((widget) => {
                  const isChecked = selectedWidgets.includes(widget.id);
                  return (
                    <label key={widget.id} className="flex cursor-pointer items-start gap-3">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => toggleWidget(widget.id, checked)}
                        className="mt-0.5 border-slate-300 data-[state=unchecked]:bg-slate-100"
                      />
                      <div className={cn(!isChecked && "text-slate-400")}>
                        <p className={cn("text-sm font-medium leading-tight", !isChecked && "text-slate-500")}>
                          {widget.title}
                        </p>
                        <p className={cn("text-xs text-muted-foreground", !isChecked && "text-slate-400")}>
                          {widget.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">At least 1 chart must remain visible.</p>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-16 text-center text-sm text-muted-foreground">
          Loading dashboard charts from Supabase...
        </div>
      ) : selectedWidgets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-16 text-center text-sm text-muted-foreground">
          Select at least one chart from Customize View.
        </div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {WIDGETS.map((widget) => renderWidgetCard(widget.id))}
        </div>
      )}
    </section>
  );
}
