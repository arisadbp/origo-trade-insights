import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Database, Package2, Search } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type RawStockRow = Record<string, unknown>;

type InventoryRow = {
  id: string;
  stockId: string;
  factory: string;
  qty: number;
  tag: string;
  type: string;
};

type FactorySummaryRow = {
  id: string;
  factory: string;
  totalQty: number;
  rowCount: number;
  lowCount: number;
  emptyCount: number;
  types: string[];
  tags: string[];
  details: InventoryRow[];
};

const toNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeFactory = (value: unknown) => String(value ?? "-").trim().toUpperCase();

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);

const formatMt = (qty: number) => `${formatNumber(qty)} MT`;

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const getFactoryStatus = (factory: FactorySummaryRow): { status: "neutral" | "warning" | "success"; label: string } => {
  if (factory.totalQty <= 0) {
    return { status: "neutral", label: "Empty" };
  }
  if (factory.lowCount > 0 || factory.emptyCount > 0) {
    return { status: "warning", label: "Mixed" };
  }
  return { status: "success", label: "Available" };
};

export default function Inventory() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [expandedFactoryId, setExpandedFactoryId] = useState<string | null>(null);

  const fetchStock = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase is not configured.");
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("stock")
      .select("*");

    console.log(data);
    console.log(error);

    if (error) {
      setError(error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const mappedRows = ((data ?? []) as RawStockRow[]).map((row, index) => ({
      id: String(row.stock_id ?? index),
      stockId: String(row.stock_id ?? "-"),
      factory: normalizeFactory(row.factory),
      qty: toNumber(row.qty),
      tag: String(row.tag ?? "-"),
      type: String(row.type ?? "-"),
    }));

    setRows(mappedRows);
    setLoading(false);
  };

  useEffect(() => {
    fetchStock();
  }, []);

  const uniqueFactories = useMemo(() => {
    return [...new Set(rows.map((row) => row.factory).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const groupedRows = useMemo(() => {
    const map = new Map<string, FactorySummaryRow>();
    rows.forEach((row) => {
      const current = map.get(row.factory) ?? {
        id: row.factory,
        factory: row.factory,
        totalQty: 0,
        rowCount: 0,
        lowCount: 0,
        emptyCount: 0,
        types: [],
        tags: [],
        details: [],
      };
      current.totalQty += row.qty;
      current.rowCount += 1;
      if (row.qty <= 0) current.emptyCount += 1;
      if (row.qty > 0 && row.qty < 50) current.lowCount += 1;
      if (!current.types.includes(row.type)) current.types.push(row.type);
      if (!current.tags.includes(row.tag)) current.tags.push(row.tag);
      current.details.push(row);
      map.set(row.factory, current);
    });

    return [...map.values()].sort((a, b) => b.totalQty - a.totalQty);
  }, [rows]);

  const totalQty = useMemo(() => rows.reduce((sum, row) => sum + row.qty, 0), [rows]);
  const factoryBreakdown = useMemo(() => {
    const map = new Map<string, { factory: string; qty: number; count: number }>();
    rows.forEach((row) => {
      const current = map.get(row.factory) ?? { factory: row.factory, qty: 0, count: 0 };
      current.qty += row.qty;
      current.count += 1;
      map.set(row.factory, current);
    });
    return [...map.values()].sort((a, b) => b.qty - a.qty);
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return groupedRows.filter((row) => {
      const factoryMatch = factoryFilter === "all" || row.factory === factoryFilter;
      if (!factoryMatch) return false;
      if (!term) return true;
      return (
        row.factory.toLowerCase().includes(term) ||
        row.types.some((type) => type.toLowerCase().includes(term)) ||
        row.tags.some((tag) => tag.toLowerCase().includes(term))
      );
    });
  }, [groupedRows, search, factoryFilter]);

  useEffect(() => {
    if (!expandedFactoryId) return;
    if (!filteredRows.some((row) => row.id === expandedFactoryId)) {
      setExpandedFactoryId(null);
    }
  }, [expandedFactoryId, filteredRows]);

  const getFactoryDetailRows = (factory: FactorySummaryRow) =>
    factory.details.map((detail, index) => ({
      ...detail,
      rowKey: `${factory.id}-${detail.id}-${index}`,
      share: factory.totalQty > 0 ? (detail.qty / factory.totalQty) * 100 : 0,
    }));

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Inventory"
        subtitle="Monitor stock levels and allocation across factories"
      />

      <div className="flex-1 overflow-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
        <div className="rounded-2xl border bg-card/90 backdrop-blur">
          <div className="border-b border-border/70 px-4 py-4 md:px-5">
            <h2 className="text-base font-semibold">Inventory Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Unified stock view across factories, product types, and tags.
            </p>
          </div>

          <div className="space-y-4 p-4 md:p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-3xl border border-border/60 bg-card/80 px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Total Quantity</p>
                <p className="mt-1.5 text-[24px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums md:text-[30px]">
                  {formatMt(totalQty)}
                </p>
                <div className="mt-2">
                  <Package2 className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-slate-50 to-card px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_24px_rgba(15,23,42,0.04)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Factories</p>
                <p className="mt-1.5 text-[24px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums md:text-[30px]">
                  {formatNumber(uniqueFactories.length)}
                </p>
                <div className="mt-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-sm md:p-5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-foreground">Factory Stock Distribution</h3>
                <p className="mt-1 text-xs text-muted-foreground">Stock updated as of January 25, 2026.</p>
              </div>
              {factoryBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">No factory data available.</p>
              ) : (
                <>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden">
                    {factoryBreakdown.map((bucket) => {
                      const share = totalQty > 0 ? (bucket.qty / totalQty) * 100 : 0;
                      return (
                        <article
                          key={`mobile-${bucket.factory}`}
                          className="w-[220px] shrink-0 snap-start rounded-2xl border border-border/70 bg-card px-3 py-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground">
                              {bucket.factory}
                            </p>
                            <p className="shrink-0 rounded-full border border-border/70 bg-muted/20 px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                              {formatPercent(share)}
                            </p>
                          </div>
                          <p className="mt-2 text-xl font-semibold leading-none tracking-tight tabular-nums text-foreground">
                            {formatNumber(bucket.qty)}
                          </p>
                          <p className="mt-1 text-xs font-medium text-muted-foreground">MT</p>
                        </article>
                      );
                    })}
                  </div>

                  <div className="hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-3">
                    {factoryBreakdown.map((bucket) => {
                      const share = totalQty > 0 ? (bucket.qty / totalQty) * 100 : 0;
                      return (
                        <article key={`desktop-${bucket.factory}`} className="rounded-2xl border border-border/70 bg-card px-4 py-3.5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="min-w-0 truncate text-sm font-semibold tracking-tight text-foreground">
                              {bucket.factory}
                            </p>
                            <p className="shrink-0 rounded-full border border-border/70 bg-muted/20 px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums">
                              {formatPercent(share)}
                            </p>
                          </div>
                          <p className="mt-2.5 text-2xl font-semibold leading-none tracking-tight tabular-nums text-foreground md:text-[30px]">
                            {formatNumber(bucket.qty)}
                          </p>
                          <p className="mt-1 text-sm font-medium text-muted-foreground">MT</p>
                        </article>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-sm md:p-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="order-2 space-y-1.5 md:order-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Factory
                    </p>
                    <Select value={factoryFilter} onValueChange={setFactoryFilter}>
                      <SelectTrigger className="h-10 w-full rounded-2xl border-border/70 bg-background/90 text-sm focus:ring-1 focus:ring-slate-300 sm:w-[220px]">
                        <SelectValue placeholder="Factory" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="all">All Factories</SelectItem>
                        {uniqueFactories.map((factory) => (
                          <SelectItem key={factory} value={factory}>
                            {factory}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="order-1 w-full space-y-1.5 md:order-2 md:max-w-sm xl:max-w-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:hidden">
                      Quick Search
                    </p>
                    <div className="relative w-full">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search factory, type, tag..."
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        className="h-11 rounded-2xl border-border/70 bg-background/90 pl-10 text-sm focus-visible:ring-1 focus-visible:ring-slate-300 md:h-10"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          {loading ? (
            <section className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
              Loading inventory data...
            </section>
          ) : error ? (
            <section className="rounded-2xl border border-destructive/30 bg-card p-6 text-sm text-destructive">
              {error}
            </section>
          ) : (
            <>
              <div className="space-y-2.5 md:hidden">
                {filteredRows.length === 0 ? (
                  <section className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                    No factory data found
                  </section>
                ) : (
                  filteredRows.map((item) => {
                    const isExpanded = expandedFactoryId === item.id;
                    const detailRows = getFactoryDetailRows(item);
                    const status = getFactoryStatus(item);

                    return (
                      <section key={item.id} className="rounded-xl border border-border/70 bg-card px-3.5 py-3">
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-3 text-left"
                          onClick={() =>
                            setExpandedFactoryId((prev) => (prev === item.id ? null : item.id))
                          }
                        >
                          <div className="min-w-0">
                            <p className="text-base font-semibold tracking-tight">{item.factory}</p>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                        </button>

                        <div className="mt-2.5 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">Total Qty</p>
                            <p className="text-sm font-semibold tabular-nums">{formatMt(item.totalQty)}</p>
                          </div>
                          <StatusBadge status={status.status} label={status.label} />
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Product Types</p>
                            <div className="flex flex-wrap gap-1.5">
                              {item.types.map((type, index) => (
                                <Badge
                                  key={`${type}-${index}`}
                                  variant="outline"
                                  className="border-border/70 bg-background px-2 py-0.5 text-[12px] font-medium"
                                >
                                  {type}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Tags: {item.tags.length > 0 ? item.tags.join(" • ") : "-"}
                          </p>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              Details
                            </p>
                            {detailRows.map((row) => (
                              <div key={row.rowKey} className="rounded-lg border border-border/60 bg-muted/10 p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium">{row.type}</p>
                                  <p className="text-sm font-semibold tabular-nums">{formatMt(row.qty)}</p>
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-2">
                                  <p className="text-xs text-muted-foreground">{row.tag}</p>
                                  <p className="text-xs text-muted-foreground tabular-nums">
                                    {formatPercent(row.share)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })
                )}
              </div>

              <div className="hidden overflow-hidden rounded-2xl border border-border/70 bg-card md:block">
                <div className="overflow-x-auto">
                  <Table className="min-w-[900px] border-separate border-spacing-0">
                    <TableHeader>
                      <TableRow className="border-b border-slate-200/70 bg-slate-50/90 hover:bg-slate-50/90">
                        <TableHead className="w-[19%] px-5 py-3.5 text-[12px] font-semibold tracking-[0.01em] text-slate-600">Factory</TableHead>
                        <TableHead className="w-[41%] px-5 py-3.5 text-[12px] font-semibold tracking-[0.01em] text-slate-600">Product Types</TableHead>
                        <TableHead className="w-[16%] px-5 py-3.5 text-[12px] font-semibold tracking-[0.01em] text-slate-600">Tags</TableHead>
                        <TableHead className="w-[14%] px-5 py-3.5 text-right text-[12px] font-semibold tracking-[0.01em] text-slate-600">Total Qty</TableHead>
                        <TableHead className="w-[10%] px-5 py-3.5 text-center text-[12px] font-semibold tracking-[0.01em] text-slate-600">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                            No factory data found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRows.map((item, rowIndex) => {
                          const isExpanded = expandedFactoryId === item.id;
                          const detailRows = getFactoryDetailRows(item);
                          const status = getFactoryStatus(item);
                          return (
                            <Fragment key={item.id}>
                              <TableRow
                                key={item.id}
                                className={cn(
                                  "align-top border-b border-slate-200/70 transition-colors hover:bg-slate-100/70",
                                  rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/45",
                                )}
                              >
                                <TableCell className="px-5 py-4 align-top">
                                  <button
                                    type="button"
                                    className="flex items-start gap-2 text-left"
                                    onClick={() =>
                                      setExpandedFactoryId((prev) => (prev === item.id ? null : item.id))
                                    }
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                    )}
                                    <span>
                                      <p className="text-base font-semibold tracking-tight hover:underline">{item.factory}</p>
                                    </span>
                                  </button>
                                </TableCell>
                                <TableCell className="min-w-[300px] px-5 py-4 align-top">
                                  <div className="rounded-xl border border-border/60 bg-muted/[0.24] p-2.5">
                                    <div className="flex flex-wrap gap-1.5">
                                      {item.types.map((type, index) => (
                                        <Badge
                                          key={`${type}-${index}`}
                                          variant="outline"
                                          className="border-border/70 bg-background px-2.5 py-0.5 text-[13px] font-medium"
                                        >
                                          {type}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="px-5 py-4 align-top">
                                  <div className="flex flex-wrap gap-1.5">
                                    {item.tags.map((tag, index) => (
                                      <Badge
                                        key={`${tag}-${index}`}
                                        variant="secondary"
                                        className="max-w-[120px] truncate px-2 py-0.5 text-[12px] font-normal"
                                      >
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="px-5 py-4 align-top text-right font-semibold">{formatMt(item.totalQty)}</TableCell>
                                <TableCell className="px-5 py-4 align-top text-center">
                                  <StatusBadge status={status.status} label={status.label} />
                                </TableCell>
                              </TableRow>

                              {isExpanded && (
                                <TableRow
                                  className={cn(
                                    "border-b border-slate-200/70 hover:bg-transparent",
                                    rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/45",
                                  )}
                                >
                                  <TableCell colSpan={5} className="px-5 py-2.5">
                                    <div className="overflow-hidden rounded-lg border border-border/60 bg-background">
                                      <Table className="border-separate border-spacing-0 text-sm">
                                        <TableHeader>
                                          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                                            <TableHead className="h-9 px-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                              Product Type
                                            </TableHead>
                                            <TableHead className="h-9 px-4 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                              Tag
                                            </TableHead>
                                            <TableHead className="h-9 px-4 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                              Remaining (MT)
                                            </TableHead>
                                            <TableHead className="h-9 px-4 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                              Share
                                            </TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {detailRows.map((row, detailIndex) => (
                                            <TableRow
                                              key={row.rowKey}
                                              className={cn(
                                                "h-11 border-b border-slate-200/60 hover:bg-slate-100/60",
                                                detailIndex % 2 === 0 ? "bg-white" : "bg-slate-50/45",
                                              )}
                                            >
                                              <TableCell className="px-4 py-2.5">
                                                <span className="text-sm font-medium text-foreground">{row.type}</span>
                                              </TableCell>
                                              <TableCell className="px-4 py-2.5">
                                                <Badge variant="secondary" className="px-2 py-0.5 text-xs font-normal text-muted-foreground">
                                                  {row.tag}
                                                </Badge>
                                              </TableCell>
                                              <TableCell className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums">
                                                {formatMt(row.qty)}
                                              </TableCell>
                                              <TableCell className="px-4 py-2.5 text-right text-sm text-muted-foreground tabular-nums">
                                                {formatPercent(row.share)}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}
