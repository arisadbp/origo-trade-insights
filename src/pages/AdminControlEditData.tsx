import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RefreshCcw, Save, Search, Trash2, X } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type DatasetKey = "deliveries" | "stock" | "finance_invoices";
type DataRow = Record<string, unknown>;

type DatasetConfig = {
  key: DatasetKey;
  label: string;
  table: string;
  primaryKey: string;
  orderBy: string;
  preferredColumns: string[];
  numberColumns: string[];
  booleanColumns: string[];
  dropdownColumns?: string[];
  hiddenColumns?: string[];
  tableMinWidthClass?: string;
  columnWidthClasses?: Record<string, string>;
  columnMinWidthClasses?: Record<string, string>;
  wrapColumns?: string[];
};

const DATASETS: Record<DatasetKey, DatasetConfig> = {
  deliveries: {
    key: "deliveries",
    label: "Orders & Shipments",
    table: "deliveries",
    primaryKey: "delivery_id",
    orderBy: "delivery_date",
    preferredColumns: [
      "delivery_id",
      "contract_id",
      "job",
      "delivery_date",
      "record",
      "status",
      "quantity",
      "remark",
      "created_at",
    ],
    numberColumns: ["quantity"],
    booleanColumns: [],
    dropdownColumns: ["status"],
    hiddenColumns: ["delivery_id"],
    tableMinWidthClass: "min-w-0",
    columnWidthClasses: {
      contract_id: "w-[14%]",
      job: "w-[10%]",
      delivery_date: "w-[11%]",
      record: "w-[14%]",
      status: "w-[9%]",
      quantity: "w-[8%]",
      remark: "w-[22%]",
      created_at: "w-[12%]",
    },
    columnMinWidthClasses: {
      contract_id: "min-w-[110px]",
      job: "min-w-[90px]",
      delivery_date: "min-w-[100px]",
      record: "min-w-[110px]",
      status: "min-w-[90px]",
      quantity: "min-w-[90px]",
      remark: "min-w-[150px]",
      created_at: "min-w-[100px]",
    },
    wrapColumns: ["remark"],
  },
  stock: {
    key: "stock",
    label: "Inventory",
    table: "stock",
    primaryKey: "stock_id",
    orderBy: "stock_id",
    preferredColumns: ["stock_id", "factory", "type", "tag", "qty"],
    numberColumns: ["qty"],
    booleanColumns: [],
    dropdownColumns: ["factory"],
    hiddenColumns: ["stock_id"],
    tableMinWidthClass: "min-w-0",
  },
  finance_invoices: {
    key: "finance_invoices",
    label: "Invoices & Payments",
    table: "finance_invoices",
    primaryKey: "id",
    orderBy: "invoice_date",
    preferredColumns: [
      "id",
      "invoice",
      "customer_name",
      "contract",
      "invoice_date",
      "status_type",
      "usd",
      "tons",
      "total_invoice",
      "team",
      "fac",
      "status_detail",
    ],
    numberColumns: ["tons", "total_invoice", "usd", "thb", "convert_rate", "price"],
    booleanColumns: ["contact", "credit", "export"],
    dropdownColumns: ["status_type", "status", "team"],
    hiddenColumns: ["id", "contact", "credit", "export", "status_detail"],
    tableMinWidthClass: "min-w-0",
  },
};

const DATASET_ORDER: DatasetKey[] = ["deliveries", "stock", "finance_invoices"];
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];
const READ_ONLY_COLUMNS = new Set(["created_at", "updated_at"]);

const stringifyCell = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const normalizeRowKey = (row: DataRow, primaryKey: string, index: number) => {
  const pkValue = row[primaryKey];
  if (pkValue === null || pkValue === undefined || String(pkValue).trim() === "") {
    return `row-${index}`;
  }
  return `${String(pkValue)}-${index}`;
};

const coerceByColumn = (column: string, rawValue: string, config: DatasetConfig, sampleValue?: unknown) => {
  const trimmed = rawValue.trim();
  if (trimmed.length === 0) return null;

  if (config.booleanColumns.includes(column)) {
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    return null;
  }

  if (config.numberColumns.includes(column)) {
    const parsed = Number(trimmed.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : rawValue;
  }

  if (sampleValue && typeof sampleValue === "object") {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  return trimmed;
};

export default function AdminControlEditData() {
  const { toast } = useToast();
  const [datasetKey, setDatasetKey] = useState<DatasetKey>("deliveries");
  const [rows, setRows] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [editingPrimaryValue, setEditingPrimaryValue] = useState<unknown>(null);
  const [editingSourceRow, setEditingSourceRow] = useState<DataRow | null>(null);
  const [rowDraft, setRowDraft] = useState<Record<string, string>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<Record<string, string>>({});

  const config = DATASETS[datasetKey];

  const loadRows = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase is not configured.");
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setEditingRowKey(null);

    let response = await supabase
      .from(config.table)
      .select("*")
      .order(config.orderBy, { ascending: false })
      .limit(1000);

    if (response.error && /column .* does not exist|schema cache/i.test(response.error.message ?? "")) {
      response = await supabase.from(config.table).select("*").limit(1000);
    }

    if (response.error) {
      setError(response.error.message);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((response.data ?? []) as DataRow[]);
    setLoading(false);
  }, [config.orderBy, config.table]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const columns = useMemo(() => {
    const hidden = new Set(config.hiddenColumns ?? []);
    const keySet = new Set<string>();
    rows.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (!hidden.has(key)) keySet.add(key);
      });
    });
    const rest = Array.from(keySet).filter((key) => !config.preferredColumns.includes(key));
    return [...config.preferredColumns.filter((key) => keySet.has(key) && !hidden.has(key)), ...rest];
  }, [rows, config.preferredColumns, config.hiddenColumns]);

  useEffect(() => {
    const initialDraft: Record<string, string> = {};
    columns.forEach((column) => {
      initialDraft[column] = "";
    });
    setCreateDraft(initialDraft);
  }, [columns, datasetKey]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      columns.some((column) => stringifyCell(row[column]).toLowerCase().includes(term)),
    );
  }, [rows, search, columns]);

  const dropdownOptionsByColumn = useMemo(() => {
    const optionsMap = new Map<string, string[]>();
    const dropdownSet = new Set(config.dropdownColumns ?? []);
    if (dropdownSet.size === 0) return optionsMap;

    columns.forEach((column) => {
      if (!dropdownSet.has(column)) return;
      const unique = new Set<string>();
      rows.forEach((row) => {
        const value = row[column];
        if (value === null || value === undefined) return;
        const normalized = String(value).trim();
        if (!normalized) return;
        unique.add(normalized);
      });
      optionsMap.set(column, Array.from(unique).sort((a, b) => a.localeCompare(b)));
    });
    return optionsMap;
  }, [columns, config.dropdownColumns, rows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [datasetKey, search, pageSize]);

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

  const beginEdit = (row: DataRow, rowKey: string) => {
    const draft: Record<string, string> = {};
    columns.forEach((column) => {
      const cell = row[column];
      if (cell === null || cell === undefined) {
        draft[column] = "";
      } else if (typeof cell === "object") {
        try {
          draft[column] = JSON.stringify(cell);
        } catch {
          draft[column] = String(cell);
        }
      } else {
        draft[column] = String(cell);
      }
    });

    setEditingRowKey(rowKey);
    setEditingPrimaryValue(row[config.primaryKey] ?? null);
    setEditingSourceRow(row);
    setRowDraft(draft);
  };

  const cancelEdit = () => {
    setEditingRowKey(null);
    setEditingPrimaryValue(null);
    setEditingSourceRow(null);
    setRowDraft({});
  };

  const saveEdit = async () => {
    if (!supabase) return;
    if (editingRowKey === null || editingPrimaryValue === null || !editingSourceRow) {
      toast({ title: "Cannot save row", description: "Primary key is missing for this row.", variant: "destructive" });
      return;
    }

    const updatePayload: Record<string, unknown> = {};
    columns.forEach((column) => {
      if (column === config.primaryKey || READ_ONLY_COLUMNS.has(column)) return;
      const nextValue = coerceByColumn(column, rowDraft[column] ?? "", config, editingSourceRow[column]);
      const prevValue = editingSourceRow[column];
      const changed = JSON.stringify(nextValue) !== JSON.stringify(prevValue);
      if (changed) {
        updatePayload[column] = nextValue;
      }
    });

    if (Object.keys(updatePayload).length === 0) {
      cancelEdit();
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase
      .from(config.table)
      .update(updatePayload)
      .eq(config.primaryKey, editingPrimaryValue);
    setSaving(false);

    if (updateError) {
      toast({ title: "Update failed", description: updateError.message, variant: "destructive" });
      return;
    }

    toast({ title: "Row updated", description: `${config.label} has been updated.` });
    cancelEdit();
    await loadRows();
  };

  const createRow = async () => {
    if (!supabase) return;

    const payload: Record<string, unknown> = {};
    columns.forEach((column) => {
      if (READ_ONLY_COLUMNS.has(column)) return;
      const raw = createDraft[column] ?? "";
      if (column === config.primaryKey && raw.trim() === "") return;
      const parsed = coerceByColumn(column, raw, config);
      if (parsed !== null) {
        payload[column] = parsed;
      }
    });

    if (Object.keys(payload).length === 0) {
      toast({ title: "No data to insert", description: "Fill at least one field before saving.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error: insertError } = await supabase.from(config.table).insert(payload);
    setSaving(false);

    if (insertError) {
      toast({ title: "Insert failed", description: insertError.message, variant: "destructive" });
      return;
    }

    toast({ title: "Row created", description: `${config.label} has been updated with a new row.` });
    setIsCreateOpen(false);
    await loadRows();
  };

  const deleteRow = async (primaryValue: unknown) => {
    if (!supabase) return;
    const target = String(primaryValue ?? "").trim();
    if (!target) {
      toast({ title: "Cannot delete row", description: `Missing primary key (${config.primaryKey}).`, variant: "destructive" });
      return;
    }

    const confirmed = window.confirm(`Delete this row from ${config.label}? This action cannot be undone.`);
    if (!confirmed) return;

    setSaving(true);
    const { error: deleteError } = await supabase
      .from(config.table)
      .delete()
      .eq(config.primaryKey, primaryValue);
    setSaving(false);

    if (deleteError) {
      toast({ title: "Delete failed", description: deleteError.message, variant: "destructive" });
      return;
    }

    toast({ title: "Row deleted", description: `${config.label} row has been removed.` });
    if (editingPrimaryValue === primaryValue) {
      cancelEdit();
    }
    await loadRows();
  };

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title="Edit Data"
        subtitle="Update Orders & Shipments, Inventory, and Invoices & Payments from Supabase."
      />

      <div className="flex-1 space-y-6 overflow-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
        <div className="rounded-2xl border bg-card/90 backdrop-blur">
          <div className="border-b border-border/70 px-4 py-4 md:px-5">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold">Data Editor</h2>
              <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                Beta
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Customer-managed table editing for live operational data.
            </p>
          </div>

          <div className="space-y-4 p-4 md:p-5">
            <div className="flex flex-wrap gap-2">
              {DATASET_ORDER.map((key) => {
                const item = DATASETS[key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setDatasetKey(item.key)}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                      datasetKey === item.key
                        ? "border-[#ffbd59] bg-[#ffbd59]/25 text-[#7a4a00]"
                        : "border-border/70 bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${config.label}...`}
                  className="h-10 rounded-xl bg-background pl-9"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-full"
                  onClick={() => void loadRows()}
                  disabled={loading}
                >
                  <RefreshCcw className="mr-1.5 h-4 w-4" />
                  Refresh
                </Button>
                <Button
                  type="button"
                  className="h-10 rounded-full bg-[#ffbd59] text-[#3b2a06] hover:bg-[#ffbd59]/90"
                  onClick={() => setIsCreateOpen(true)}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add Row
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {pageStart}-{pageEnd} of {filteredRows.length} rows
              </p>
              <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2 py-1">
                <span className="text-[11px] font-medium text-muted-foreground">Per page</span>
                <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                  <SelectTrigger className="h-7 w-[74px] rounded-full border-none bg-transparent px-2 text-xs shadow-none focus:ring-0">
                    <SelectValue placeholder="10" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
                Loading {config.label}...
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-destructive/30 bg-card p-6 text-sm text-destructive">
                {error}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                  <div className="hidden overflow-x-auto md:block">
                    <table className={cn("w-full table-fixed border-separate border-spacing-0", config.tableMinWidthClass ?? "min-w-0")}>
                      <thead>
                        <tr className="border-b border-slate-200/70 bg-slate-50/90">
                          {columns.map((column) => (
                            <th
                              key={column}
                              className={cn(
                                "px-3 py-3 text-left text-[12px] font-semibold tracking-[0.01em] text-slate-600",
                                config.columnWidthClasses?.[column],
                                config.numberColumns.includes(column) && "text-right",
                              )}
                            >
                              {column}
                            </th>
                          ))}
                          <th className="w-[120px] px-3 py-3 text-right text-[12px] font-semibold tracking-[0.01em] text-slate-600">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="[&>tr:nth-child(odd)]:bg-white [&>tr:nth-child(even)]:bg-slate-50/45">
                        {paginatedRows.length === 0 ? (
                          <tr>
                            <td colSpan={columns.length + 1} className="h-32 px-6 py-4 text-center text-sm text-muted-foreground">
                              No rows found
                            </td>
                          </tr>
                        ) : (
                          paginatedRows.map((row, index) => {
                            const rowKey = normalizeRowKey(row, config.primaryKey, index);
                            const isEditing = editingRowKey === rowKey;
                            const primaryValue = row[config.primaryKey];
                            const canEdit = primaryValue !== null && primaryValue !== undefined && String(primaryValue).trim() !== "";

                            return (
                              <tr
                                key={rowKey}
                                className="border-b border-slate-200/70 transition-colors hover:bg-slate-100/70 last:border-b-0"
                              >
                                {columns.map((column) => {
                                  const readOnly = READ_ONLY_COLUMNS.has(column) || (isEditing && column === config.primaryKey);
                                  if (isEditing) {
                                    const sampleValue = editingSourceRow?.[column];
                                    const isBooleanColumn = config.booleanColumns.includes(column) || typeof sampleValue === "boolean";
                                    const isDropdownColumn = (config.dropdownColumns ?? []).includes(column);
                                    const dynamicOptions = dropdownOptionsByColumn.get(column) ?? [];
                                    const currentValue = rowDraft[column] ?? "";
                                    const dropdownOptions = currentValue && !dynamicOptions.includes(currentValue)
                                      ? [currentValue, ...dynamicOptions]
                                      : dynamicOptions;
                                    return (
                                      <td
                                        key={column}
                                        className={cn(
                                          "px-3 py-3 align-middle",
                                          config.columnMinWidthClasses?.[column] ?? "min-w-[96px]",
                                        )}
                                      >
                                        {isBooleanColumn ? (
                                          <Select
                                            value={rowDraft[column] === "" ? "null" : rowDraft[column]}
                                            onValueChange={(value) =>
                                              setRowDraft((prev) => ({
                                                ...prev,
                                                [column]: value === "null" ? "" : value,
                                              }))
                                            }
                                            disabled={readOnly}
                                          >
                                            <SelectTrigger className="h-8 w-full rounded-lg bg-background text-xs">
                                              <SelectValue placeholder="null" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="null">null</SelectItem>
                                              <SelectItem value="true">true</SelectItem>
                                              <SelectItem value="false">false</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        ) : isDropdownColumn ? (
                                          <Select
                                            value={rowDraft[column] === "" ? "null" : rowDraft[column]}
                                            onValueChange={(value) =>
                                              setRowDraft((prev) => ({
                                                ...prev,
                                                [column]: value === "null" ? "" : value,
                                              }))
                                            }
                                            disabled={readOnly}
                                          >
                                            <SelectTrigger className="h-8 w-full rounded-lg bg-background text-xs">
                                              <SelectValue placeholder="Select..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="null">null</SelectItem>
                                              {dropdownOptions.map((option) => (
                                                <SelectItem key={`${column}-${option}`} value={option}>
                                                  {option}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        ) : (
                                          <Input
                                            value={rowDraft[column] ?? ""}
                                            onChange={(event) =>
                                              setRowDraft((prev) => ({ ...prev, [column]: event.target.value }))
                                            }
                                            className="h-8 rounded-lg bg-background text-xs"
                                            disabled={readOnly}
                                          />
                                        )}
                                      </td>
                                    );
                                  }

                                  const cellText = stringifyCell(row[column]);
                                  return (
                                    <td
                                      key={column}
                                      className={cn(
                                        "px-3 py-3.5 align-middle text-xs",
                                        config.columnWidthClasses?.[column],
                                        config.numberColumns.includes(column) && "text-right tabular-nums",
                                      )}
                                      title={cellText}
                                    >
                                      <p className={cn("truncate", (config.wrapColumns ?? []).includes(column) && "whitespace-normal break-words line-clamp-2")}>
                                        {cellText}
                                      </p>
                                    </td>
                                  );
                                })}
                                <td className="px-3 py-3.5 text-right align-middle">
                                  {isEditing ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="h-8 rounded-full bg-[#ffbd59] px-2.5 text-[#3b2a06] hover:bg-[#ffbd59]/90"
                                        onClick={() => void saveEdit()}
                                        disabled={saving}
                                        aria-label="Save row"
                                      >
                                        <Save className="h-3.5 w-3.5" />
                                        <span className="hidden xl:inline xl:pl-1">Save</span>
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 rounded-full px-2.5"
                                        onClick={cancelEdit}
                                        aria-label="Cancel edit"
                                      >
                                        <X className="h-3.5 w-3.5" />
                                        <span className="hidden xl:inline xl:pl-1">Cancel</span>
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1.5">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 rounded-full px-2.5"
                                        onClick={() => beginEdit(row, rowKey)}
                                        disabled={!canEdit || saving}
                                        title={!canEdit ? `Missing primary key (${config.primaryKey})` : "Edit row"}
                                        aria-label="Edit row"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                        <span className="hidden xl:inline xl:pl-1">Edit</span>
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 rounded-full border-red-200 px-2.5 text-red-700 hover:bg-red-50 hover:text-red-800"
                                        onClick={() => void deleteRow(primaryValue)}
                                        disabled={!canEdit || saving}
                                        title={!canEdit ? `Missing primary key (${config.primaryKey})` : "Delete row"}
                                        aria-label="Delete row"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span className="hidden xl:inline xl:pl-1">Delete</span>
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-2.5 p-2 md:hidden">
                    {paginatedRows.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
                        No rows found
                      </div>
                    ) : (
                      paginatedRows.map((row, index) => {
                        const rowKey = normalizeRowKey(row, config.primaryKey, index);
                        const isEditing = editingRowKey === rowKey;
                        const primaryValue = row[config.primaryKey];
                        const canEdit = primaryValue !== null && primaryValue !== undefined && String(primaryValue).trim() !== "";

                        return (
                          <article key={rowKey} className="rounded-xl border border-border/70 bg-card px-3.5 py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground">
                                  {config.primaryKey}: {stringifyCell(primaryValue)}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">{config.label}</p>
                              </div>
                              {isEditing ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-8 rounded-full bg-[#ffbd59] px-3 text-[#3b2a06] hover:bg-[#ffbd59]/90"
                                    onClick={() => void saveEdit()}
                                    disabled={saving}
                                  >
                                    <Save className="mr-1 h-3.5 w-3.5" />
                                    Save
                                  </Button>
                                  <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3" onClick={cancelEdit}>
                                    <X className="mr-1 h-3.5 w-3.5" />
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-full px-3"
                                    onClick={() => beginEdit(row, rowKey)}
                                    disabled={!canEdit || saving}
                                  >
                                    <Pencil className="mr-1 h-3.5 w-3.5" />
                                    Edit
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 rounded-full border-red-200 px-3 text-red-700 hover:bg-red-50 hover:text-red-800"
                                    onClick={() => void deleteRow(primaryValue)}
                                    disabled={!canEdit || saving}
                                  >
                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                                    Delete
                                  </Button>
                                </div>
                              )}
                            </div>

                            <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                              {columns.map((column) => {
                                const readOnly = READ_ONLY_COLUMNS.has(column) || (isEditing && column === config.primaryKey);
                                if (isEditing) {
                                  const sampleValue = editingSourceRow?.[column];
                                  const isBooleanColumn = config.booleanColumns.includes(column) || typeof sampleValue === "boolean";
                                  const isDropdownColumn = (config.dropdownColumns ?? []).includes(column);
                                  const dynamicOptions = dropdownOptionsByColumn.get(column) ?? [];
                                  const currentValue = rowDraft[column] ?? "";
                                  const dropdownOptions = currentValue && !dynamicOptions.includes(currentValue)
                                    ? [currentValue, ...dynamicOptions]
                                    : dynamicOptions;
                                  return (
                                    <div key={column} className="space-y-1">
                                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                        {column}
                                      </p>
                                      {isBooleanColumn ? (
                                        <Select
                                          value={rowDraft[column] === "" ? "null" : rowDraft[column]}
                                          onValueChange={(value) =>
                                            setRowDraft((prev) => ({
                                              ...prev,
                                              [column]: value === "null" ? "" : value,
                                            }))
                                          }
                                          disabled={readOnly}
                                        >
                                          <SelectTrigger className="h-8 w-full rounded-lg bg-background text-xs">
                                            <SelectValue placeholder="null" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="null">null</SelectItem>
                                            <SelectItem value="true">true</SelectItem>
                                            <SelectItem value="false">false</SelectItem>
                                            </SelectContent>
                                          </Select>
                                      ) : isDropdownColumn ? (
                                        <Select
                                          value={rowDraft[column] === "" ? "null" : rowDraft[column]}
                                          onValueChange={(value) =>
                                            setRowDraft((prev) => ({
                                              ...prev,
                                              [column]: value === "null" ? "" : value,
                                            }))
                                          }
                                          disabled={readOnly}
                                        >
                                          <SelectTrigger className="h-8 w-full rounded-lg bg-background text-xs">
                                            <SelectValue placeholder="Select..." />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="null">null</SelectItem>
                                            {dropdownOptions.map((option) => (
                                              <SelectItem key={`${column}-${option}`} value={option}>
                                                {option}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <Input
                                          value={rowDraft[column] ?? ""}
                                          onChange={(event) =>
                                            setRowDraft((prev) => ({ ...prev, [column]: event.target.value }))
                                          }
                                          className="h-8 rounded-lg bg-background text-xs"
                                          disabled={readOnly}
                                        />
                                      )}
                                    </div>
                                  );
                                }
                                const cellText = stringifyCell(row[column]);
                                return (
                                  <div key={column} className="space-y-0.5">
                                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{column}</p>
                                    <p className="text-sm text-foreground break-all">{cellText}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {!loading && !error && (
              <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Page {currentPage} / {totalPages}
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
            )}
          </div>
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Add Row</DialogTitle>
            <DialogDescription>{config.label} ({config.table})</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {columns
              .filter((column) => !READ_ONLY_COLUMNS.has(column))
              .map((column) => (
                <div key={column} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{column}</p>
                  {config.booleanColumns.includes(column) ? (
                    <Select
                      value={createDraft[column] === "" ? "null" : createDraft[column]}
                      onValueChange={(value) =>
                        setCreateDraft((prev) => ({ ...prev, [column]: value === "null" ? "" : value }))
                      }
                    >
                      <SelectTrigger className="h-9 rounded-lg bg-background text-sm">
                        <SelectValue placeholder="null" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="null">null</SelectItem>
                        <SelectItem value="true">true</SelectItem>
                        <SelectItem value="false">false</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (config.dropdownColumns ?? []).includes(column) ? (
                    <Select
                      value={createDraft[column] === "" ? "null" : createDraft[column]}
                      onValueChange={(value) =>
                        setCreateDraft((prev) => ({ ...prev, [column]: value === "null" ? "" : value }))
                      }
                    >
                      <SelectTrigger className="h-9 rounded-lg bg-background text-sm">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="null">null</SelectItem>
                        {(dropdownOptionsByColumn.get(column) ?? []).map((option) => (
                          <SelectItem key={`create-${column}-${option}`} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={createDraft[column] ?? ""}
                      onChange={(event) =>
                        setCreateDraft((prev) => ({ ...prev, [column]: event.target.value }))
                      }
                      placeholder={column === config.primaryKey ? "(optional if auto-generated)" : ""}
                      className="h-9 rounded-lg bg-background text-sm"
                    />
                  )}
                </div>
              ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#ffbd59] text-[#3b2a06] hover:bg-[#ffbd59]/90"
              onClick={() => void createRow()}
              disabled={saving}
            >
              <Save className="mr-1.5 h-4 w-4" />
              Save Row
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
