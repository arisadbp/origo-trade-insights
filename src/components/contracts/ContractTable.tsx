import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, CalendarDays, ChevronDown, ChevronUp, Search, SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { cn } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type ContractRelation =
  | { customer: string | null; type: string | null; contractdate: string | null }
  | Array<{ customer: string | null; type: string | null; contractdate: string | null }>
  | null;

type ContractLineRow = {
  line_id: string;
  contract_id: string | null;
  job: string | null;
  product: string | null;
  price: number | null;
  team: string | null;
  status: string | null;
  ton: number | null;
  acc: number | null;
  date_from: string | null;
  date_to: string | null;
  extra_fields: Record<string, unknown> | null;
  contracts: ContractRelation;
};

type ContractTableRow = {
  id: string;
  customer: string;
  contractType: string;
  contractId: string;
  commitDate: string | null;
  job: string;
  jobValue: string | null;
  product: string;
  team: string;
  status: string;
  price: number | null;
  paymentTerms: string | null;
  ton: number;
  acc: number;
  remainingTon: number;
  dateFrom: string | null;
  dateTo: string | null;
};

type StatusFilter = "all" | "pending" | "overdue" | "complete";
type DeliveryProgressFilter = "all" | "not_started" | "in_progress" | "completed";
type AttentionOrdersFilter = "none" | "overdue_orders" | "due_orders_3d";
type SortKey =
  | "job"
  | "commitDate"
  | "customer"
  | "contractId"
  | "deliveryPeriod"
  | "commitBalance"
  | "status";
type SortDirection = "asc" | "desc";

type DeliveryRow = {
  delivery_id: string;
  contract_id: string;
  job: string | null;
  delivery_date: string | null;
  record: string | null;
  quantity: number | null;
  remark: string | null;
};

type CustomerDeliveryRow = DeliveryRow;

const SELLER_NAME = "THAI ROONG RUANG INDUSTRY CO., LTD.";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
const formatMt = (value: number) => `${formatNumber(value)} MT`;
const getDeliveryPercent = (commitTon: number, sentTon: number) => {
  if (commitTon <= 0) return sentTon > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, (sentTon / commitTon) * 100));
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const formatMonthYear = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

const formatDeliveryPeriod = (from: string | null, to: string | null) => {
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  const fromValid = fromDate && !Number.isNaN(fromDate.getTime());
  const toValid = toDate && !Number.isNaN(toDate.getTime());

  if (fromValid && toValid && fromDate.getFullYear() === toDate.getFullYear()) {
    const fromLabel = fromDate.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
    const toLabel = toDate.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
    return `${fromLabel} - ${toLabel}`;
  }

  const fromLabel = formatDate(from);
  const toLabel = formatDate(to);
  if (fromLabel === "-" && toLabel === "-") return "-";
  if (fromLabel === "-") return toLabel;
  if (toLabel === "-") return fromLabel;
  return `${fromLabel} - ${toLabel}`;
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

const getDeliveryProgress = (commitTon: number, sentTon: number): Exclude<DeliveryProgressFilter, "all"> => {
  if (sentTon <= 0) return "not_started";
  if (sentTon >= commitTon) return "completed";
  return "in_progress";
};

const parseJobSortNumber = (job: string) => {
  const match = job.match(/\d+/g);
  if (!match) return null;
  const joined = match.join("");
  const value = Number(joined);
  return Number.isFinite(value) ? value : null;
};

const compareJobNumberDesc = (a: ContractTableRow, b: ContractTableRow) => {
  const aNum = parseJobSortNumber(a.job);
  const bNum = parseJobSortNumber(b.job);
  if (aNum !== null && bNum !== null && aNum !== bNum) return bNum - aNum;
  if (aNum !== null && bNum === null) return -1;
  if (aNum === null && bNum !== null) return 1;

  return b.job.localeCompare(a.job, undefined, { numeric: true, sensitivity: "base" });
};

const compareJobNumberAsc = (a: ContractTableRow, b: ContractTableRow) => {
  const aNum = parseJobSortNumber(a.job);
  const bNum = parseJobSortNumber(b.job);
  if (aNum !== null && bNum !== null && aNum !== bNum) return aNum - bNum;
  if (aNum !== null && bNum === null) return -1;
  if (aNum === null && bNum !== null) return 1;

  return a.job.localeCompare(b.job, undefined, { numeric: true, sensitivity: "base" });
};

const getCustomerName = (contracts: ContractRelation) => {
  if (!contracts) return "-";
  if (Array.isArray(contracts)) return contracts[0]?.customer ?? "-";
  return contracts.customer ?? "-";
};

const getContractType = (contracts: ContractRelation) => {
  if (!contracts) return "-";
  if (Array.isArray(contracts)) return contracts[0]?.type ?? "-";
  return contracts.type ?? "-";
};

const getContractDate = (contracts: ContractRelation) => {
  if (!contracts) return null;
  if (Array.isArray(contracts)) return contracts[0]?.contractdate ?? null;
  return contracts.contractdate ?? null;
};

const getPaymentTerms = (extraFields: Record<string, unknown> | null) => {
  if (!extraFields || typeof extraFields !== "object") return null;

  const normalized = Object.entries(extraFields).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[key.toLowerCase().replace(/\s+/g, "").replace(/_/g, "")] = value;
    return acc;
  }, {});

  const candidate =
    normalized.paymentterms ??
    normalized.paymentterm ??
    normalized.terms ??
    normalized.paymentcondition ??
    null;

  if (typeof candidate === "string" && candidate.trim().length > 0) return candidate.trim();
  return null;
};

const getStatusBadge = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === "pending") {
    return (
      <StatusBadge
        status="pending"
        label="Pending"
        showIcon={false}
        className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
      />
    );
  }
  if (normalized === "overdue") {
    return (
      <StatusBadge
        status="error"
        label="Overdue"
        showIcon={false}
        className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
      />
    );
  }
  if (normalized === "complete" || normalized === "completed") {
    return (
      <StatusBadge
        status="success"
        label="Complete"
        showIcon={false}
        className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
      />
    );
  }
  return (
    <StatusBadge
      status="neutral"
      label={status || "Unknown"}
      showIcon={false}
      className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
    />
  );
};

const getStatusCategory = (status: string): Exclude<StatusFilter, "all"> => {
  const normalized = status.toLowerCase();
  if (normalized === "pending") return "pending";
  if (normalized === "overdue") return "overdue";
  return "complete";
};

const statusFilterLabels: Record<StatusFilter, string> = {
  all: "All",
  pending: "Pending",
  overdue: "Overdue",
  complete: "Complete",
};

const deliveryProgressLabels: Record<DeliveryProgressFilter, string> = {
  all: "All Progress",
  not_started: "Not Started",
  in_progress: "In Progress",
  completed: "Completed",
};

const statusFilterTheme: Record<
  StatusFilter,
  { active: string; inactive: string; dot: string }
> = {
  all: {
    active: "bg-slate-900 text-white shadow-sm",
    inactive: "text-slate-600 hover:bg-white/80 hover:text-slate-900",
    dot: "bg-slate-400",
  },
  pending: {
    active: "bg-blue-50 text-blue-700 ring-1 ring-blue-200 shadow-sm",
    inactive: "text-slate-600 hover:bg-white/80 hover:text-slate-900",
    dot: "bg-blue-500",
  },
  overdue: {
    active: "bg-red-50 text-red-700 ring-1 ring-red-200 shadow-sm",
    inactive: "text-slate-600 hover:bg-white/80 hover:text-slate-900",
    dot: "bg-red-500",
  },
  complete: {
    active: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 shadow-sm",
    inactive: "text-slate-600 hover:bg-white/80 hover:text-slate-900",
    dot: "bg-emerald-500",
  },
};

export function ContractTable() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<ContractTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [deliveryProgressFilter, setDeliveryProgressFilter] = useState<DeliveryProgressFilter>("all");
  const [attentionFilter, setAttentionFilter] = useState<AttentionOrdersFilter>("none");
  const [commitDateFrom, setCommitDateFrom] = useState("");
  const [commitDateTo, setCommitDateTo] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "commitDate",
    direction: "desc",
  });
  const [selectedRow, setSelectedRow] = useState<ContractTableRow | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [deliveriesError, setDeliveriesError] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [isCustomerSummaryOpen, setIsCustomerSummaryOpen] = useState(false);
  const [customerDeliveries, setCustomerDeliveries] = useState<CustomerDeliveryRow[]>([]);
  const [customerDeliveriesLoading, setCustomerDeliveriesLoading] = useState(false);
  const [customerDeliveriesError, setCustomerDeliveriesError] = useState<string | null>(null);

  useEffect(() => {
    const attention = searchParams.get("attention");
    const job = searchParams.get("job");

    if (job && job.trim().length > 0) {
      setAttentionFilter("none");
      setStatusFilter("all");
      setSearch(job.trim());
      return;
    }

    if (attention === "overdue-orders") {
      setAttentionFilter("overdue_orders");
      setStatusFilter("overdue");
      setSearch("");
      return;
    }
    if (attention === "due-orders-3d") {
      setAttentionFilter("due_orders_3d");
      setStatusFilter("pending");
      setSearch("");
      return;
    }

    setAttentionFilter("none");
    setSearch("");

    const status = searchParams.get("status");
    if (status === "all" || status === "pending" || status === "overdue" || status === "complete") {
      setStatusFilter(status);
      return;
    }

    setStatusFilter("all");
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setError("Supabase is not configured.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("contract_lines")
        .select(
          "line_id, contract_id, job, product, price, team, status, ton, acc, date_from, date_to, extra_fields, contracts(customer, type, contractdate)",
        )
        .order("date_to", { ascending: true });

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const mappedRows = ((data ?? []) as ContractLineRow[]).map((row) => {
        const ton = row.ton ?? 0;
        const acc = row.acc ?? 0;
        return {
          id: row.line_id,
          customer: getCustomerName(row.contracts),
          contractType: getContractType(row.contracts),
          contractId: row.contract_id ?? "-",
          commitDate: getContractDate(row.contracts),
          job: row.job ?? "-",
          jobValue: row.job ?? null,
          product: row.product ?? "-",
          team: row.team ?? "-",
          status: row.status ?? "Unknown",
          price: row.price ?? null,
          paymentTerms: getPaymentTerms(row.extra_fields),
          ton,
          acc,
          remainingTon: ton - acc,
          dateFrom: row.date_from ?? null,
          dateTo: row.date_to ?? null,
        };
      });

      setRows(mappedRows);
      setLoading(false);
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchDeliveries = async () => {
      if (!isDetailOpen || !selectedRow) return;
      if (!isSupabaseConfigured || !supabase || selectedRow.contractId === "-") {
        setDeliveries([]);
        setDeliveriesError(null);
        return;
      }

      setDeliveriesLoading(true);
      setDeliveriesError(null);

      let query = supabase
        .from("deliveries")
        .select("delivery_id, contract_id, job, delivery_date, record, quantity, remark")
        .eq("contract_id", selectedRow.contractId);

      if (selectedRow.jobValue) {
        query = query.eq("job", selectedRow.jobValue);
      } else {
        query = query.is("job", null);
      }

      const { data, error } = await query.order("delivery_date", { ascending: false });

      if (cancelled) return;

      if (error) {
        setDeliveriesError(error.message);
        setDeliveries([]);
        setDeliveriesLoading(false);
        return;
      }

      setDeliveries((data ?? []) as DeliveryRow[]);
      setDeliveriesLoading(false);
    };

    fetchDeliveries();
    return () => {
      cancelled = true;
    };
  }, [isDetailOpen, selectedRow]);

  const openDetails = (row: ContractTableRow) => {
    setSelectedRow(row);
    setIsDetailOpen(true);
  };

  const openCustomerSummary = (customer: string) => {
    setSelectedCustomer(customer);
    setIsCustomerSummaryOpen(true);
  };

  const selectedCustomerRows = useMemo(() => {
    if (!selectedCustomer) return [];
    return rows.filter((row) => row.customer === selectedCustomer);
  }, [rows, selectedCustomer]);

  const customerSummary = useMemo(() => {
    const contractIds = new Set<string>();
    const jobs = new Set<string>();
    let commitTon = 0;
    let deliveredTon = 0;
    let balanceTon = 0;
    let pending = 0;
    let overdue = 0;
    let complete = 0;
    let latestCommitDate: string | null = null;

    for (const row of selectedCustomerRows) {
      if (row.contractId && row.contractId !== "-") contractIds.add(row.contractId);
      if (row.job && row.job !== "-") jobs.add(row.job);
      commitTon += row.ton;
      deliveredTon += row.acc;
      balanceTon += row.remainingTon;
      const category = getStatusCategory(row.status);
      if (category === "pending") pending += 1;
      if (category === "overdue") overdue += 1;
      if (category === "complete") complete += 1;

      if (row.commitDate) {
        if (!latestCommitDate || new Date(row.commitDate).getTime() > new Date(latestCommitDate).getTime()) {
          latestCommitDate = row.commitDate;
        }
      }
    }

    const progressPct = commitTon > 0 ? Math.max(0, Math.min(100, (deliveredTon / commitTon) * 100)) : 0;

    return {
      contractCount: contractIds.size,
      jobCount: jobs.size,
      commitTon,
      deliveredTon,
      balanceTon,
      progressPct,
      pending,
      overdue,
      complete,
      latestCommitDate,
      contractIds: Array.from(contractIds),
    };
  }, [selectedCustomerRows]);

  const customerJobPriceMap = useMemo(() => {
    const byJob = new Map<string, Set<number>>();
    const byContract = new Map<string, Set<number>>();

    for (const row of selectedCustomerRows) {
      if (!row.contractId || row.contractId === "-" || row.price === null) continue;

      const contractKey = row.contractId;
      const jobKey = `${row.contractId}::${row.jobValue ?? ""}`;

      if (!byContract.has(contractKey)) byContract.set(contractKey, new Set<number>());
      byContract.get(contractKey)!.add(row.price);

      if (!byJob.has(jobKey)) byJob.set(jobKey, new Set<number>());
      byJob.get(jobKey)!.add(row.price);
    }

    const toPriceLabel = (values: Set<number>) => {
      const prices = Array.from(values).sort((a, b) => a - b);
      if (prices.length === 0) return "";
      if (prices.length === 1) return `USD ${formatNumber(prices[0])}`;
      return `USD ${formatNumber(prices[0])} - ${formatNumber(prices[prices.length - 1])}`;
    };

    const byJobLabel = new Map<string, string>();
    const byContractLabel = new Map<string, string>();

    byJob.forEach((values, key) => byJobLabel.set(key, toPriceLabel(values)));
    byContract.forEach((values, key) => byContractLabel.set(key, toPriceLabel(values)));

    return { byJobLabel, byContractLabel };
  }, [selectedCustomerRows]);

  const getDeliveryPriceLabel = (delivery: CustomerDeliveryRow) => {
    const byJobKey = `${delivery.contract_id}::${delivery.job ?? ""}`;
    return (
      customerJobPriceMap.byJobLabel.get(byJobKey) ??
      customerJobPriceMap.byContractLabel.get(delivery.contract_id) ??
      ""
    );
  };

  useEffect(() => {
    let cancelled = false;

    const fetchCustomerDeliveries = async () => {
      if (!isCustomerSummaryOpen || !selectedCustomer) return;
      if (!isSupabaseConfigured || !supabase) {
        setCustomerDeliveries([]);
        setCustomerDeliveriesError("Supabase is not configured.");
        setCustomerDeliveriesLoading(false);
        return;
      }

      const contractIds = customerSummary.contractIds;
      if (contractIds.length === 0) {
        setCustomerDeliveries([]);
        setCustomerDeliveriesError(null);
        setCustomerDeliveriesLoading(false);
        return;
      }

      setCustomerDeliveriesLoading(true);
      setCustomerDeliveriesError(null);

      const { data, error } = await supabase
        .from("deliveries")
        .select("delivery_id, contract_id, job, delivery_date, record, quantity, remark")
        .in("contract_id", contractIds)
        .order("delivery_date", { ascending: false });

      if (cancelled) return;

      if (error) {
        setCustomerDeliveries([]);
        setCustomerDeliveriesError(error.message);
        setCustomerDeliveriesLoading(false);
        return;
      }

      setCustomerDeliveries((data ?? []) as CustomerDeliveryRow[]);
      setCustomerDeliveriesLoading(false);
    };

    fetchCustomerDeliveries();
    return () => {
      cancelled = true;
    };
  }, [isCustomerSummaryOpen, selectedCustomer, customerSummary.contractIds]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.total += 1;
        acc.remainingTon += row.remainingTon;
        const category = getStatusCategory(row.status);
        acc[category] += 1;
        return acc;
      },
      { total: 0, pending: 0, overdue: 0, complete: 0, remainingTon: 0 },
    );
  }, [rows]);

  const typeOptions = useMemo(() => {
    return Array.from(
      new Set(rows.map((row) => row.contractType).filter((value) => value && value !== "-")),
    ).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const teamOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.team).filter((value) => value && value !== "-"))).sort(
      (a, b) => a.localeCompare(b),
    );
  }, [rows]);

  const hasAdvancedFilters =
    attentionFilter !== "none" ||
    typeFilter !== "all" ||
    teamFilter !== "all" ||
    deliveryProgressFilter !== "all" ||
    Boolean(commitDateFrom) ||
    Boolean(commitDateTo);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const commitFromMs = parseDateToDayMs(commitDateFrom);
    const commitToMs = parseDateToDayMs(commitDateTo);
    const nowMs = new Date().setHours(0, 0, 0, 0);
    const dayMs = 1000 * 60 * 60 * 24;
    return rows
      .filter((row) => {
        const statusMatch = statusFilter === "all" || getStatusCategory(row.status) === statusFilter;
        if (!statusMatch) return false;
        if (attentionFilter === "overdue_orders") {
          const normalized = row.status.toLowerCase();
          const dueMs = parseDateToDayMs(row.dateTo);
          const isMarkedOverdue = normalized.includes("overdue");
          const isPastDuePending =
            normalized.includes("pending") && dueMs !== null && dueMs < nowMs && row.remainingTon > 0;
          if (!isMarkedOverdue && !isPastDuePending) return false;
        }
        if (attentionFilter === "due_orders_3d") {
          const normalized = row.status.toLowerCase();
          const dueMs = parseDateToDayMs(row.dateTo);
          if (!normalized.includes("pending") || dueMs === null) return false;
          const days = Math.floor((dueMs - nowMs) / dayMs);
          if (days < 0 || days > 3) return false;
        }
        if (typeFilter !== "all" && row.contractType !== typeFilter) return false;
        if (teamFilter !== "all" && row.team !== teamFilter) return false;
        if (
          deliveryProgressFilter !== "all" &&
          getDeliveryProgress(row.ton, row.acc) !== deliveryProgressFilter
        ) {
          return false;
        }
        if (commitFromMs !== null || commitToMs !== null) {
          const commitMs = parseDateToDayMs(row.commitDate);
          if (commitMs === null) return false;
          if (commitFromMs !== null && commitMs < commitFromMs) return false;
          if (commitToMs !== null && commitMs > commitToMs) return false;
        }
        if (!term) return true;
        return (
          row.customer.toLowerCase().includes(term) ||
          row.contractId.toLowerCase().includes(term) ||
          row.job.toLowerCase().includes(term) ||
          row.team.toLowerCase().includes(term) ||
          row.contractType.toLowerCase().includes(term)
        );
      });
  }, [
    rows,
    statusFilter,
    attentionFilter,
    typeFilter,
    teamFilter,
    deliveryProgressFilter,
    commitDateFrom,
    commitDateTo,
    search,
  ]);

  const sortedRows = useMemo(() => {
    const compareNullableNumber = (a: number | null, b: number | null) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return a - b;
    };

    const statusRank = (status: string) => {
      const category = getStatusCategory(status);
      if (category === "overdue") return 0;
      if (category === "pending") return 1;
      return 2;
    };

    const baseSorted = [...filteredRows].sort((a, b) => {
      switch (sortConfig.key) {
        case "job":
          return sortConfig.direction === "asc" ? compareJobNumberAsc(a, b) : compareJobNumberDesc(a, b);
        case "commitDate":
          return compareNullableNumber(parseDateToDayMs(a.commitDate), parseDateToDayMs(b.commitDate));
        case "customer":
          return a.customer.localeCompare(b.customer, undefined, { sensitivity: "base" });
        case "contractId":
          return a.contractId.localeCompare(b.contractId, undefined, { numeric: true, sensitivity: "base" });
        case "deliveryPeriod": {
          const byTo = compareNullableNumber(parseDateToDayMs(a.dateTo), parseDateToDayMs(b.dateTo));
          if (byTo !== 0) return byTo;
          return compareNullableNumber(parseDateToDayMs(a.dateFrom), parseDateToDayMs(b.dateFrom));
        }
        case "commitBalance":
          return a.remainingTon - b.remainingTon;
        case "status":
          return statusRank(a.status) - statusRank(b.status);
        default:
          return 0;
      }
    });

    if (sortConfig.direction === "asc" || sortConfig.key === "job") return baseSorted;
    return baseSorted.reverse();
  }, [filteredRows, sortConfig]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    statusFilter,
    attentionFilter,
    typeFilter,
    teamFilter,
    deliveryProgressFilter,
    commitDateFrom,
    commitDateTo,
    search,
    pageSize,
    sortConfig.key,
    sortConfig.direction,
  ]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const pageStart = sortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(currentPage * pageSize, sortedRows.length);

  const activeFilterCount =
    (attentionFilter !== "none" ? 1 : 0) +
    (typeFilter !== "all" ? 1 : 0) +
    (teamFilter !== "all" ? 1 : 0) +
    (deliveryProgressFilter !== "all" ? 1 : 0) +
    (commitDateFrom ? 1 : 0) +
    (commitDateTo ? 1 : 0);

  const toggleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      const defaultDirection: SortDirection =
        key === "job" || key === "commitDate" || key === "deliveryPeriod" ? "desc" : "asc";
      return { key, direction: defaultDirection };
    });
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />;
    if (sortConfig.direction === "asc") return <ChevronUp className="h-3.5 w-3.5 text-foreground" />;
    return <ChevronDown className="h-3.5 w-3.5 text-foreground" />;
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
        Loading contract lines...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-card p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-3xl border border-border/60 bg-card/80 px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Contract Number</p>
          <p className="mt-1.5 text-[24px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums md:text-[30px]">
            {formatNumber(summary.total)}
          </p>
        </div>
        <div className="rounded-3xl border border-blue-100 bg-blue-50/70 px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-700/80">Pending</p>
          <p className="mt-1.5 text-[24px] font-semibold leading-none tracking-tight text-blue-700 tabular-nums md:text-[30px]">
            {formatNumber(summary.pending)}
          </p>
        </div>
        <div className="rounded-3xl border border-red-100 bg-red-50/70 px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-red-700/80">Overdue</p>
          <p className="mt-1.5 text-[24px] font-semibold leading-none tracking-tight text-red-700 tabular-nums md:text-[30px]">
            {formatNumber(summary.overdue)}
          </p>
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700/80">Completed</p>
          <p className="mt-1.5 text-[24px] font-semibold leading-none tracking-tight text-emerald-700 tabular-nums md:text-[30px]">
            {formatNumber(summary.complete)}
          </p>
        </div>
        <div className="col-span-2 rounded-3xl border border-border/60 bg-gradient-to-br from-slate-50 to-card px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_24px_rgba(15,23,42,0.04)] md:col-span-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Remaining Volume (MT)
          </p>
          <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-tight text-slate-900 tabular-nums md:text-[24px]">
            {formatNumber(summary.remainingTon)}
            <span className="ml-1 text-sm font-medium text-slate-500">MT</span>
          </p>
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-sm md:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="order-2 space-y-2 md:order-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Status
              </p>
              <div className="grid w-full grid-cols-2 gap-1 rounded-2xl border border-border/60 bg-muted/25 p-1 sm:inline-flex sm:w-auto sm:max-w-full sm:items-center sm:rounded-full">
                {(Object.keys(statusFilterLabels) as StatusFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setStatusFilter(filter)}
                    className={cn(
                      "inline-flex w-full items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-all sm:w-auto sm:justify-start",
                      statusFilter === filter
                        ? statusFilterTheme[filter].active
                        : statusFilterTheme[filter].inactive,
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusFilterTheme[filter].dot)} />
                    {statusFilterLabels[filter]}
                  </button>
                ))}
              </div>
            </div>
            <div className="order-1 w-full space-y-1.5 md:order-2 md:max-w-sm xl:max-w-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground md:hidden">
                Quick Search
              </p>
              <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search customer, contract, team, type..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 rounded-2xl border-border/70 bg-background/90 pl-10 text-sm focus-visible:ring-1 focus-visible:ring-slate-300 md:h-10"
              />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between md:hidden">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-full px-3 text-xs"
              onClick={() => setShowMobileFilters((prev) => !prev)}
            >
              <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
              {showMobileFilters ? "Hide filters" : "Filters"}
            </Button>
            {hasAdvancedFilters ? (
              <span className="rounded-full bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                {activeFilterCount} active
              </span>
            ) : null}
            {attentionFilter !== "none" ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                {attentionFilter === "overdue_orders" ? "Alert: Overdue orders" : "Alert: Due in 3 days"}
              </span>
            ) : null}
          </div>

          <div className={cn("grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4", !showMobileFilters && "hidden md:grid")}>
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Type</p>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-10 rounded-2xl border-border/70 bg-background/90 text-sm focus:ring-1 focus:ring-slate-300">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Type</SelectItem>
                  {typeOptions.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Team</p>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="h-10 rounded-2xl border-border/70 bg-background/90 text-sm focus:ring-1 focus:ring-slate-300">
                  <SelectValue placeholder="Team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Team</SelectItem>
                  {teamOptions.map((team) => (
                    <SelectItem key={team} value={team}>
                      {team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Delivery Progress
              </p>
              <Select
                value={deliveryProgressFilter}
                onValueChange={(value) => setDeliveryProgressFilter(value as DeliveryProgressFilter)}
              >
                <SelectTrigger className="h-10 rounded-2xl border-border/70 bg-background/90 text-sm focus:ring-1 focus:ring-slate-300">
                  <SelectValue placeholder="Delivery Progress" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(deliveryProgressLabels) as DeliveryProgressFilter[]).map((progress) => (
                    <SelectItem key={progress} value={progress}>
                      {deliveryProgressLabels[progress]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Commit Date Range
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  type="date"
                  value={commitDateFrom}
                  onChange={(event) => setCommitDateFrom(event.target.value)}
                  className="h-10 rounded-2xl border-border/70 bg-background/90 text-sm focus-visible:ring-1 focus-visible:ring-slate-300"
                  aria-label="Commit date from"
                />
                <Input
                  type="date"
                  value={commitDateTo}
                  onChange={(event) => setCommitDateTo(event.target.value)}
                  className="h-10 rounded-2xl border-border/70 bg-background/90 text-sm focus-visible:ring-1 focus-visible:ring-slate-300"
                  aria-label="Commit date to"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-medium text-slate-600">{formatNumber(filteredRows.length)} visible lines</p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2 py-1">
                <span className="text-[11px] font-medium text-muted-foreground">Per page</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => setPageSize(Number(value))}
                >
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
              {hasAdvancedFilters ? (
                <span className="rounded-full bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  {activeFilterCount} active filters
                </span>
              ) : null}
              {attentionFilter !== "none" ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                  {attentionFilter === "overdue_orders" ? "Alert filter: Overdue orders" : "Alert filter: Due in 3 days"}
                </span>
              ) : null}
              {hasAdvancedFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs text-slate-600 hover:bg-muted/50"
                  onClick={() => {
                    setAttentionFilter("none");
                    setTypeFilter("all");
                    setTeamFilter("all");
                    setDeliveryProgressFilter("all");
                    setCommitDateFrom("");
                    setCommitDateTo("");
                    setShowMobileFilters(false);
                  }}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
          No contract lines match this filter.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1320px] border-separate border-spacing-0">
              <thead>
                <tr className="border-b border-slate-200/70 bg-slate-50/90">
                  <th className="w-[190px] whitespace-nowrap px-6 py-4 text-left text-[13px] font-semibold tracking-[0.01em] text-slate-600">
                    <button type="button" onClick={() => toggleSort("job")} className="inline-flex items-center gap-1.5">
                      <span>Job Number</span>
                      {renderSortIcon("job")}
                    </button>
                  </th>
                  <th className="w-[180px] whitespace-nowrap px-6 py-4 text-left text-[13px] font-semibold tracking-[0.01em] text-slate-600">
                    <button type="button" onClick={() => toggleSort("commitDate")} className="inline-flex items-center gap-1.5">
                      <span>Commit Date</span>
                      {renderSortIcon("commitDate")}
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-[13px] font-semibold tracking-[0.01em] text-slate-600">
                    <button type="button" onClick={() => toggleSort("customer")} className="inline-flex items-center gap-1.5">
                      <span>Customer</span>
                      {renderSortIcon("customer")}
                    </button>
                  </th>
                  <th className="w-[220px] whitespace-nowrap px-6 py-4 text-left text-[13px] font-semibold tracking-[0.01em] text-slate-600">
                    <button type="button" onClick={() => toggleSort("contractId")} className="inline-flex items-center gap-1.5">
                      <span>Contract Number</span>
                      {renderSortIcon("contractId")}
                    </button>
                  </th>
                  <th className="w-[270px] whitespace-nowrap px-6 py-4 text-left text-[13px] font-semibold tracking-[0.01em] text-slate-600">
                    <button type="button" onClick={() => toggleSort("deliveryPeriod")} className="inline-flex items-center gap-1.5">
                      <span>Delivery Period</span>
                      {renderSortIcon("deliveryPeriod")}
                    </button>
                  </th>
                  <th className="w-[320px] whitespace-nowrap px-6 py-4 text-left text-[13px] font-semibold tracking-[0.01em] text-slate-600">
                    <button type="button" onClick={() => toggleSort("commitBalance")} className="inline-flex items-center gap-1.5">
                      <span>Commit/Balance</span>
                      {renderSortIcon("commitBalance")}
                    </button>
                  </th>
                  <th className="w-[140px] whitespace-nowrap px-6 py-4 text-left text-[13px] font-semibold tracking-[0.01em] text-slate-600">
                    <button type="button" onClick={() => toggleSort("status")} className="inline-flex items-center gap-1.5">
                      <span>Status</span>
                      {renderSortIcon("status")}
                    </button>
                  </th>
                  <th className="w-[110px] whitespace-nowrap px-6 py-4 text-right text-[13px] font-semibold tracking-[0.01em] text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="[&>tr:nth-child(odd)]:bg-white [&>tr:nth-child(even)]:bg-slate-50/45">
                {paginatedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-200/70 transition-colors hover:bg-slate-100/70 last:border-b-0"
                  >
                    <td className="whitespace-nowrap px-6 py-4 align-middle">
                      <p className="whitespace-nowrap text-sm font-medium text-foreground">Job: {row.job}</p>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 align-middle">
                      <div className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span className="whitespace-nowrap">{formatDate(row.commitDate)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <button
                        type="button"
                        onClick={() => openCustomerSummary(row.customer)}
                        className="truncate text-left text-[17px] font-semibold text-foreground underline-offset-2 hover:text-primary hover:underline"
                      >
                        {row.customer}
                      </button>
                      <p className="mt-1 text-sm text-muted-foreground">Team: {row.team}</p>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => openDetails(row)}
                          className="whitespace-nowrap text-base font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {row.contractId}
                        </button>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {row.contractType}
                        </p>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 align-middle">
                      <div className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span className="whitespace-nowrap">{formatDeliveryPeriod(row.dateFrom, row.dateTo)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">
                      <div className="min-w-[220px] space-y-2.5">
                        <div className="flex items-end justify-between">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Commit</p>
                          <p className="text-sm font-semibold text-foreground">{formatMt(row.ton)}</p>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Delivered</span>
                          <span className="font-semibold text-foreground">
                            {Math.round(getDeliveryPercent(row.ton, row.acc))}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(100, getDeliveryPercent(row.ton, row.acc)),
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                            Sent {formatMt(row.acc)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                            Balance {formatMt(row.remainingTon)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle">{getStatusBadge(row.status)}</td>
                    <td className="px-6 py-4 text-right align-middle">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openDetails(row)}
                        className="h-8 rounded-full border border-border/70 px-3.5 text-xs font-medium"
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2.5 p-2 md:hidden">
            {paginatedRows.map((row) => (
              <article
                key={row.id}
                className="rounded-xl border border-border/70 bg-card px-3.5 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => openDetails(row)}
                      className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {row.contractId}
                    </button>
                    <button
                      type="button"
                      onClick={() => openCustomerSummary(row.customer)}
                      className="mt-1 block truncate text-left text-base font-semibold text-foreground underline-offset-2 hover:underline"
                    >
                      {row.customer}
                    </button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.contractType} · Team: {row.team}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Job: {row.job}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Commit Date: {formatDate(row.commitDate)}
                    </p>
                  </div>
                  <div className="shrink-0">{getStatusBadge(row.status)}</div>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>{formatDeliveryPeriod(row.dateFrom, row.dateTo)}</span>
                  </div>
                  <div className="w-full space-y-1.5">
                    <div className="flex items-end justify-between">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Commit</p>
                      <p className="text-xs font-semibold text-foreground">{formatMt(row.ton)}</p>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Delivered</span>
                      <span className="font-semibold text-foreground">
                        {Math.round(getDeliveryPercent(row.ton, row.acc))}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, getDeliveryPercent(row.ton, row.acc)),
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                        Sent {formatMt(row.acc)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                        Balance {formatMt(row.remainingTon)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openDetails(row)}
                    className="h-8 rounded-full border border-border/70 px-3 text-xs font-medium"
                  >
                    View
                  </Button>
                </div>
              </article>
            ))}
          </div>
          </div>

          <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {formatNumber(pageStart)}-{formatNumber(pageEnd)} of {formatNumber(sortedRows.length)}
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
                Page {formatNumber(currentPage)} / {formatNumber(totalPages)}
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
      )}

      <Dialog open={isCustomerSummaryOpen} onOpenChange={setIsCustomerSummaryOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Customer Summary</DialogTitle>
            <DialogDescription>
              {selectedCustomer ? `Executive view for ${selectedCustomer}` : "Customer performance summary"}
            </DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-6">
                <div className="rounded-xl border border-border/70 bg-background px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground">Contracts</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{formatNumber(customerSummary.contractCount)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground">Jobs</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{formatNumber(customerSummary.jobCount)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground">Commit</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{formatMt(customerSummary.commitTon)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground">Delivered</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{formatMt(customerSummary.deliveredTon)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground">Balance</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{formatMt(customerSummary.balanceTon)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-3 py-2.5">
                  <p className="text-[11px] text-muted-foreground">Delivery Progress</p>
                  <p className="mt-1 text-base font-semibold text-foreground">
                    {formatNumber(Math.round(customerSummary.progressPct))}%
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card/70">
                <div className="border-b border-border/60 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Delivery History</p>
                  <p className="text-xs text-muted-foreground">
                    Latest commit date: {formatDate(customerSummary.latestCommitDate)}
                  </p>
                </div>
                <div className="max-h-72 space-y-2 overflow-auto p-3">
                  {customerDeliveriesLoading ? (
                    <p className="text-sm text-muted-foreground">Loading customer deliveries...</p>
                  ) : customerDeliveriesError ? (
                    <p className="text-sm text-destructive">{customerDeliveriesError}</p>
                  ) : customerDeliveries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No delivery history found for this customer.</p>
                  ) : (
                    customerDeliveries.map((delivery) => (
                      <div key={delivery.delivery_id} className="rounded-lg border border-border/70 bg-background px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-foreground">
                            {delivery.record?.trim() ? delivery.record : formatMonthYear(delivery.delivery_date)}
                          </p>
                          <p className="text-sm font-semibold text-foreground">Qty: {formatMt(delivery.quantity ?? 0)}</p>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span>Date: {formatDate(delivery.delivery_date)}</span>
                          <span>Contract: {delivery.contract_id}</span>
                          <span>Job: {delivery.job ?? "-"}</span>
                          {getDeliveryPriceLabel(delivery) ? (
                            <span>Price: {getDeliveryPriceLabel(delivery)}</span>
                          ) : null}
                          {delivery.remark ? <span>Remark: {delivery.remark}</span> : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Contract Detail</DialogTitle>
            <DialogDescription>
              {selectedRow ? `${selectedRow.customer} · ${selectedRow.contractId}` : "Contract information"}
            </DialogDescription>
          </DialogHeader>

          {selectedRow && (
            <div className="space-y-4">
              <section className="rounded-2xl border border-border/70 bg-card/70">
                <div className="border-b border-border/60 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Section 1 · Contract Overview</p>
                  <p className="text-xs text-muted-foreground">Executive summary for counterparty and commercial terms.</p>
                </div>
                <div className="space-y-3 p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-background px-3.5 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Seller</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{SELLER_NAME}</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background px-3.5 py-3">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Buyer</p>
                      <p className="mt-1 min-h-[20px] text-sm font-semibold text-foreground">
                        {" "}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 md:grid-cols-6">
                    <div className="rounded-xl border border-border/70 bg-background px-3 py-2.5">
                      <p className="text-[11px] text-muted-foreground">Status</p>
                      <div className="mt-1">{getStatusBadge(selectedRow.status)}</div>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background px-3 py-2.5">
                      <p className="text-[11px] text-muted-foreground">Contract Number</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{selectedRow.contractId}</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background px-3 py-2.5">
                      <p className="text-[11px] text-muted-foreground">Type</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{selectedRow.contractType}</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background px-3 py-2.5">
                      <p className="text-[11px] text-muted-foreground">Payment Terms</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{selectedRow.paymentTerms ?? ""}</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background px-3 py-2.5">
                      <p className="text-[11px] text-muted-foreground">Price</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">
                        {selectedRow.price !== null ? `USD ${formatNumber(selectedRow.price)}` : ""}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-background px-3 py-2.5">
                      <p className="text-[11px] text-muted-foreground">Quantity</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{formatMt(selectedRow.ton)}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border/70 bg-card/70">
                <div className="border-b border-border/60 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">Section 2 · Deliveries</p>
                  <p className="text-xs text-muted-foreground">Contract {selectedRow.contractId}</p>
                </div>
                <div className="space-y-3 p-4">
                  {!deliveriesLoading && !deliveriesError && deliveries.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
                      <div className="rounded-xl border border-border/70 bg-background px-3 py-2.5">
                        <p className="text-[11px] text-muted-foreground">Total Deliveries</p>
                        <p className="mt-1 text-base font-semibold text-foreground">{formatNumber(deliveries.length)}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-background px-3 py-2.5">
                        <p className="text-[11px] text-muted-foreground">Delivered Quantity</p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {formatMt(deliveries.reduce((sum, d) => sum + (d.quantity ?? 0), 0))}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-background px-3 py-2.5">
                        <p className="text-[11px] text-muted-foreground">Latest Delivery</p>
                        <p className="mt-1 text-base font-semibold text-foreground">
                          {formatDate(deliveries[0]?.delivery_date ?? null)}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="max-h-64 overflow-auto rounded-xl border border-border/60 bg-background p-3">
                  {deliveriesLoading ? (
                    <p className="text-sm text-muted-foreground">Loading deliveries...</p>
                  ) : deliveriesError ? (
                    <p className="text-sm text-destructive">{deliveriesError}</p>
                  ) : deliveries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No deliveries found for this contract.</p>
                  ) : (
                    <div className="space-y-2">
                      {deliveries.map((delivery) => (
                        <div key={delivery.delivery_id} className="rounded-lg border border-border/70 bg-card px-3 py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium">{delivery.record ?? "-"}</p>
                            <p className="text-xs font-medium text-muted-foreground">{formatDate(delivery.delivery_date)}</p>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>Job: {delivery.job ?? "-"}</span>
                            <span>Qty: {formatMt(delivery.quantity ?? 0)}</span>
                            {delivery.remark ? <span>Remark: {delivery.remark}</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
