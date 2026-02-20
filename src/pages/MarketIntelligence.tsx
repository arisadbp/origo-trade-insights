import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronRight, RotateCcw, ArrowUpDown, Bookmark, BookmarkCheck, MoreHorizontal, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { WorldMap } from "@/components/market/WorldMap";
import { CompanyProfileDrawer } from "@/components/market/CompanyProfileDrawer";
import { MarketAnalysisTab } from "@/components/market-analysis/MarketAnalysisTab";
import { TopBar } from "@/components/layout/TopBar";
import { CountryFlag } from "@/components/ui/country-flag";
import { cn } from "@/lib/utils";
import { getFlagEmoji } from "@/lib/flags";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { loadProductRequests } from "@/lib/yourProductData";
import type { Company, Country, HsCode, TradeHistoryRow } from "@/data/market-intelligence/types";
import {
  getAvailableMonthsFromDataset,
  getCompanyByIdFromDataset,
  getCompanySummariesFromDataset,
  getCompanyTradeHistoryFromDataset,
  getCountryNameByCodeFromDataset,
  getHsCodesFromDataset,
  loadCompanyListDataset,
  type CompanyListDataset,
} from "@/data/market-intelligence/companyListSource";

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);
const metricLabel = "Total Weight (KG)";
const formatMetric = (value: number) => `${formatNumber(value)} KG`;
const BUYER_WINDOW_LABEL = "Buyers in the past 6 months";
const RECENT_MONTHS = 6;
const EMPTY_HS_CODE: HsCode = {
  code: "",
  product: "No product",
  description: "No product available in Supabase",
  category: "",
  chapter: "",
};
const formatMonthLabel = (month: string) => {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1, 1);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
};

type MarketSectionTab =
  | "market-insights"
  | "market-analysis";

type CompanyListMode = "overview" | "focus";
type CompanyColumnKey =
  | "pin"
  | "status"
  | "country"
  | "company"
  | "type"
  | "product"
  | "customerType"
  | "tradeSum"
  | "action";

type ReplacementRequestEntry = {
  companyId: string;
  reason: string;
  requestedAt: string;
};

type ReadyProductScopeOption = {
  id: string;
  name: string;
  hsCode: string;
};

const MARKET_TAB_STORAGE_KEY = "market-intelligence-active-tab";
const MARKET_FOCUS_IDS_STORAGE_PREFIX = "market-intelligence-focus-company-ids";
const MARKET_FOCUS_MODE_STORAGE_PREFIX = "market-intelligence-focus-mode";
const MARKET_TOP_PIN_IDS_STORAGE_PREFIX = "market-intelligence-top-pin-company-ids";
const MARKET_COMPANY_REPLACE_REQUESTS_STORAGE_PREFIX = "market-intelligence-company-replace-requests";
const MARKET_COMPANY_COLUMN_ORDER_STORAGE_KEY = "market-intelligence-company-column-order-v1";
const DEFAULT_COMPANY_COLUMN_ORDER: CompanyColumnKey[] = [
  "pin",
  "status",
  "country",
  "company",
  "type",
  "product",
  "customerType",
  "tradeSum",
  "action",
];

const marketSectionTabs: Array<{ key: MarketSectionTab; label: string }> = [
  { key: "market-insights", label: "Global Demand" },
  { key: "market-analysis", label: "Market Analysis" },
];

const sanitizeCompanyColumnOrder = (value: unknown): CompanyColumnKey[] => {
  if (!Array.isArray(value)) return DEFAULT_COMPANY_COLUMN_ORDER;
  const allowed = new Set<CompanyColumnKey>(DEFAULT_COMPANY_COLUMN_ORDER);
  const unique = value.filter((item): item is CompanyColumnKey => typeof item === "string" && allowed.has(item as CompanyColumnKey));
  const missing = DEFAULT_COMPANY_COLUMN_ORDER.filter((key) => !unique.includes(key));
  return [...unique, ...missing];
};

function CustomerTypeCell({ value }: { value?: string | null }) {
  const textValue = (value ?? "").trim() || "—";
  return (
    <div className="line-clamp-2 min-h-[2.5rem] break-words text-sm leading-5 text-foreground" title={textValue !== "—" ? textValue : undefined}>
      {textValue}
    </div>
  );
}

export default function MarketIntelligence() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { email } = useAuth();
  const [activeTab, setActiveTab] = useState<MarketSectionTab>(() => {
    if (typeof window === "undefined") return "market-insights";
    const stored = window.sessionStorage.getItem(MARKET_TAB_STORAGE_KEY);
    return stored === "market-analysis" || stored === "market-insights"
      ? stored
      : "market-insights";
  });
  const [selectedHsCode, setSelectedHsCode] = useState<HsCode>(EMPTY_HS_CODE);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isCompanyProfileOpen, setIsCompanyProfileOpen] = useState(false);
  const [companyListMode, setCompanyListMode] = useState<CompanyListMode>("overview");
  const [focusedCompanyIds, setFocusedCompanyIds] = useState<string[]>([]);
  const [topPinnedCompanyIds, setTopPinnedCompanyIds] = useState<string[]>([]);
  const isMobile = useIsMobile();
  const tableRef = useRef<HTMLDivElement | null>(null);

  const [companySortKey, setCompanySortKey] = useState("tradeSum");
  const [companySortDirection, setCompanySortDirection] = useState<"asc" | "desc">("desc");
  const [companyColumnOrder, setCompanyColumnOrder] = useState<CompanyColumnKey[]>(() => {
    if (typeof window === "undefined") return DEFAULT_COMPANY_COLUMN_ORDER;
    try {
      const raw = window.localStorage.getItem(MARKET_COMPANY_COLUMN_ORDER_STORAGE_KEY);
      if (!raw) return DEFAULT_COMPANY_COLUMN_ORDER;
      return sanitizeCompanyColumnOrder(JSON.parse(raw));
    } catch {
      return DEFAULT_COMPANY_COLUMN_ORDER;
    }
  });

  const [companySearch, setCompanySearch] = useState("");
  const [companyPageSize, setCompanyPageSize] = useState(20);
  const [companyCurrentPage, setCompanyCurrentPage] = useState(1);
  const [replacementRequests, setReplacementRequests] = useState<ReplacementRequestEntry[]>([]);
  const [replaceRequestHydrated, setReplaceRequestHydrated] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [requestCompanyDraft, setRequestCompanyDraft] = useState<{ id: string; name: string } | null>(null);
  const [replaceRequestReason, setReplaceRequestReason] = useState("");
  const [replaceRequestReasonError, setReplaceRequestReasonError] = useState<string | null>(null);
  const [isViewLoading, setIsViewLoading] = useState(true);
  const [isCompanyDataLoading, setIsCompanyDataLoading] = useState(false);
  const [companyDataSource, setCompanyDataSource] = useState<CompanyListDataset | null>(null);
  const [companyDataError, setCompanyDataError] = useState<string | null>(null);
  const [readyScopeProducts, setReadyScopeProducts] = useState<ReadyProductScopeOption[]>([]);

  const focusIdsStorageKey = useMemo(
    () => `${MARKET_FOCUS_IDS_STORAGE_PREFIX}:${selectedHsCode.code || "__default__"}`,
    [selectedHsCode.code],
  );
  const focusModeStorageKey = useMemo(
    () => `${MARKET_FOCUS_MODE_STORAGE_PREFIX}:${selectedHsCode.code || "__default__"}`,
    [selectedHsCode.code],
  );
  const topPinIdsStorageKey = useMemo(
    () => `${MARKET_TOP_PIN_IDS_STORAGE_PREFIX}:${selectedHsCode.code || "__default__"}`,
    [selectedHsCode.code],
  );
  const replacementRequestsStorageKey = useMemo(
    () => `${MARKET_COMPANY_REPLACE_REQUESTS_STORAGE_PREFIX}:${selectedHsCode.code || "__default__"}`,
    [selectedHsCode.code],
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsCompanyDataLoading(true);
      try {
        const dataset = await loadCompanyListDataset();
        if (!active) return;
        if (!dataset) {
          setCompanyDataSource(null);
          setCompanyDataError("Supabase is not configured or unavailable.");
          return;
        }
        setCompanyDataSource(dataset);
        setCompanyDataError(null);
      } catch (error) {
        console.error("Unable to load Market Intelligence company dataset", error);
        if (active) {
          setCompanyDataSource(null);
          setCompanyDataError("Unable to load data from Supabase.");
        }
      } finally {
        if (active) {
          setIsCompanyDataLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setReadyScopeProducts([]);
      return () => {
        active = false;
      };
    }

    const loadReadyProducts = async () => {
      try {
        const requestResult = await loadProductRequests();
        if (!active) return;
        const rows = requestResult.rows
          .filter(
            (row) =>
              row.customer_email.trim().toLowerCase() === normalizedEmail &&
              (row.status === "READY" || row.status === "UNLOCKED"),
          )
          .map((row) => ({
            id: row.id,
            name: row.product_name,
            hsCode: (row.hs_code ?? "").trim(),
          }))
          .filter((row) => row.name.trim().length > 0 && row.hsCode.length > 0)
          .filter(
            (row, index, array) =>
              array.findIndex(
                (item) =>
                  item.name.trim().toUpperCase() === row.name.trim().toUpperCase() &&
                  item.hsCode === row.hsCode,
              ) === index,
          );
        setReadyScopeProducts(rows);
      } catch {
        if (active) setReadyScopeProducts([]);
      }
    };

    void loadReadyProducts();
    return () => {
      active = false;
    };
  }, [email]);

  const hsCodeOptions = useMemo(
    () => (companyDataSource ? getHsCodesFromDataset(companyDataSource) : []),
    [companyDataSource],
  );

  const effectiveHsCodeOptions = useMemo(() => {
    const byCode = new Map(hsCodeOptions.map((row) => [row.code, row]));
    readyScopeProducts.forEach((row) => {
      const existing = byCode.get(row.hsCode);
      if (existing) {
        byCode.set(row.hsCode, {
          ...existing,
          product: row.name,
        });
        return;
      }
      byCode.set(row.hsCode, {
        code: row.hsCode,
        product: row.name,
        description: "From YOUR Product (READY)",
        category: `HS ${row.hsCode.slice(0, 2)}`,
        chapter: row.hsCode.slice(0, 2),
      });
    });
    return Array.from(byCode.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [hsCodeOptions, readyScopeProducts]);

  useEffect(() => {
    if (!effectiveHsCodeOptions.length) {
      if (selectedHsCode.code) {
        setSelectedHsCode(EMPTY_HS_CODE);
      }
      return;
    }
    const hasSelected = effectiveHsCodeOptions.some((option) => option.code === selectedHsCode.code);
    if (!hasSelected) {
      setSelectedHsCode(effectiveHsCodeOptions[0]);
    }
  }, [effectiveHsCodeOptions, selectedHsCode.code]);

  const dbAvailableMonths = useMemo(
    () =>
      companyDataSource && selectedHsCode.code
        ? getAvailableMonthsFromDataset(companyDataSource, selectedHsCode.code)
        : [],
    [companyDataSource, selectedHsCode.code],
  );

  const availableMonths = useMemo(() => dbAvailableMonths, [dbAvailableMonths]);

  const { startMonth, endMonth } = useMemo(() => {
    if (!availableMonths.length) {
      return { startMonth: "", endMonth: "" };
    }
    const end = availableMonths[availableMonths.length - 1];
    const start = availableMonths[Math.max(0, availableMonths.length - RECENT_MONTHS)];
    return { startMonth: start, endMonth: end };
  }, [availableMonths]);

  useEffect(() => {
    setSelectedCountryCode(null);
    setSelectedCompanyId(null);
    setIsCompanyProfileOpen(false);

    if (typeof window === "undefined") {
      setCompanyListMode("overview");
      setFocusedCompanyIds([]);
      return;
    }

    try {
      const rawIds = window.localStorage.getItem(focusIdsStorageKey);
      const parsedIds = rawIds ? JSON.parse(rawIds) : [];
      const restoredIds = Array.isArray(parsedIds)
        ? parsedIds.filter((value): value is string => typeof value === "string" && value.length > 0)
        : [];

      setFocusedCompanyIds(restoredIds);

      const rawMode = window.localStorage.getItem(focusModeStorageKey);
      if (rawMode === "focus" && restoredIds.length > 0) {
        setCompanyListMode("focus");
      } else {
        setCompanyListMode("overview");
      }
    } catch {
      setCompanyListMode("overview");
      setFocusedCompanyIds([]);
    }
  }, [selectedHsCode.code, focusIdsStorageKey, focusModeStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedHsCode.code) return;
    window.localStorage.setItem(focusIdsStorageKey, JSON.stringify(focusedCompanyIds));
  }, [focusedCompanyIds, selectedHsCode.code, focusIdsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      setTopPinnedCompanyIds([]);
      return;
    }

    try {
      const rawIds = window.localStorage.getItem(topPinIdsStorageKey);
      const parsedIds = rawIds ? JSON.parse(rawIds) : [];
      const restoredIds = Array.isArray(parsedIds)
        ? parsedIds.filter((value): value is string => typeof value === "string" && value.length > 0)
        : [];
      setTopPinnedCompanyIds(restoredIds);
    } catch {
      setTopPinnedCompanyIds([]);
    }
  }, [topPinIdsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedHsCode.code) return;
    window.localStorage.setItem(topPinIdsStorageKey, JSON.stringify(topPinnedCompanyIds));
  }, [selectedHsCode.code, topPinIdsStorageKey, topPinnedCompanyIds]);

  useEffect(() => {
    if (typeof window === "undefined" || !selectedHsCode.code) return;
    window.localStorage.setItem(focusModeStorageKey, companyListMode);
  }, [companyListMode, selectedHsCode.code, focusModeStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MARKET_COMPANY_COLUMN_ORDER_STORAGE_KEY, JSON.stringify(companyColumnOrder));
  }, [companyColumnOrder]);

  useEffect(() => {
    setReplaceRequestHydrated(false);
    if (typeof window === "undefined") {
      setReplacementRequests([]);
      setReplaceRequestHydrated(true);
      return;
    }
    try {
      const raw = window.localStorage.getItem(replacementRequestsStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        setReplacementRequests([]);
      } else {
        const mapped = parsed.flatMap((entry): ReplacementRequestEntry[] => {
          if (typeof entry === "string" && entry.trim()) {
            return [{
              companyId: entry,
              reason: "Requested by customer",
              requestedAt: new Date().toISOString(),
            }];
          }
          if (
            typeof entry === "object" &&
            entry !== null &&
            "companyId" in entry &&
            typeof entry.companyId === "string" &&
            entry.companyId.trim() &&
            "reason" in entry &&
            typeof entry.reason === "string"
          ) {
            return [{
              companyId: entry.companyId,
              reason: entry.reason.trim() || "No reason provided",
              requestedAt:
                "requestedAt" in entry && typeof entry.requestedAt === "string"
                  ? entry.requestedAt
                  : new Date().toISOString(),
            }];
          }
          return [];
        });
        setReplacementRequests(mapped);
      }
    } catch {
      setReplacementRequests([]);
    } finally {
      setReplaceRequestHydrated(true);
    }
  }, [replacementRequestsStorageKey]);

  useEffect(() => {
    if (!replaceRequestHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(replacementRequestsStorageKey, JSON.stringify(replacementRequests));
  }, [replaceRequestHydrated, replacementRequests, replacementRequestsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(MARKET_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    setIsViewLoading(true);
    const timer = setTimeout(() => setIsViewLoading(false), 320);
    return () => clearTimeout(timer);
  }, [selectedHsCode.code, startMonth, endMonth, selectedCountryCode, selectedCompanyId]);

  const isMapLoading = isViewLoading;
  const isCompanyLoading = isViewLoading || isCompanyDataLoading;

  useEffect(() => {
    if (selectedCompanyId) {
      setIsCompanyProfileOpen(true);
    }
  }, [selectedCompanyId]);

  const dateRangeLabel = useMemo(() => {
    if (!startMonth || !endMonth) return "";
    return `${formatMonthLabel(startMonth)} - ${formatMonthLabel(endMonth)}`;
  }, [startMonth, endMonth]);

  const dbCompanySummaries = useMemo(() => {
    if (!companyDataSource || !startMonth || !endMonth) return [];
    return getCompanySummariesFromDataset({
      dataset: companyDataSource,
      hsCode: selectedHsCode.code,
      startMonth,
      endMonth,
    });
  }, [companyDataSource, selectedHsCode.code, startMonth, endMonth]);

  const companySummaries = useMemo(
    () =>
      selectedCountryCode
        ? dbCompanySummaries.filter((row) => row.countryCode === selectedCountryCode)
        : dbCompanySummaries,
    [dbCompanySummaries, selectedCountryCode],
  );

  const getCountryLabel = useCallback((countryCode: string) => {
    if (!countryCode) return "Unknown";
    if (!companyDataSource) return countryCode;
    return getCountryNameByCodeFromDataset(companyDataSource, countryCode);
  }, [companyDataSource]);

  const mapCountryRows = useMemo(() => {
    const grouped = new Map<
      string,
      { metricTotal: number; importersCount: number; newCustomers: number; existingCustomers: number }
    >();

    dbCompanySummaries.forEach((row) => {
      if (!row.countryCode) return;
      const current = grouped.get(row.countryCode) ?? {
        metricTotal: 0,
        importersCount: 0,
        newCustomers: 0,
        existingCustomers: 0,
      };
      current.metricTotal += row.metricTotal;
      current.importersCount += 1;
      if (row.status === "new") {
        current.newCustomers += 1;
      } else {
        current.existingCustomers += 1;
      }
      grouped.set(row.countryCode, current);
    });

    const globalMetricTotal = Array.from(grouped.values()).reduce((sum, row) => sum + row.metricTotal, 0);

    return Array.from(grouped.entries()).map(([countryCode, summary]) => {
      const newCustomers = summary.newCustomers;
      const existingCustomers = summary.existingCustomers;
      return {
        code: countryCode,
        name: getCountryLabel(countryCode),
        flag: getFlagEmoji(countryCode),
        metricTotal: summary.metricTotal,
        importersCount: summary.importersCount,
        share: globalMetricTotal > 0 ? (summary.metricTotal / globalMetricTotal) * 100 : 0,
        customerStatus: (
          newCustomers > 0 && existingCustomers > 0
            ? "mixed"
            : newCustomers > 0
              ? "new"
              : "existing"
        ) as "new" | "existing" | "mixed",
        newCustomers,
        existingCustomers,
      };
    });
  }, [dbCompanySummaries, getCountryLabel]);

  const activeCountryCount = useMemo(
    () => mapCountryRows.filter((row) => row.importersCount > 0).length,
    [mapCountryRows],
  );

  const selectedCompanySummary = useMemo(
    () => (selectedCompanyId ? companySummaries.find((item) => item.id === selectedCompanyId) : undefined),
    [companySummaries, selectedCompanyId],
  );

  const selectedCompany = useMemo<Company | undefined>(() => {
    if (!selectedCompanyId || !companyDataSource) return undefined;
    const liveCompany = getCompanyByIdFromDataset(companyDataSource, selectedCompanyId);
    if (liveCompany) return liveCompany;
    if (!selectedCompanySummary) return undefined;

    return {
      id: selectedCompanySummary.id,
      name: selectedCompanySummary.name,
      countryCode: selectedCompanySummary.countryCode || selectedCountryCode || "",
      buyerType: selectedCompanySummary.buyerType,
      industry: selectedCompanySummary.industry,
      website: selectedCompanySummary.website,
    };
  }, [companyDataSource, selectedCompanyId, selectedCompanySummary, selectedCountryCode]);

  const selectedCountryCodeResolved = selectedCountryCode ?? selectedCompany?.countryCode ?? "";
  const selectedCountry: Country | undefined = selectedCountryCodeResolved
    ? {
        code: selectedCountryCodeResolved,
        name: getCountryLabel(selectedCountryCodeResolved),
      }
    : undefined;

  const { tradeHistory, tradeHistoryDateLabel, tradeHistoryUsedFallback } = useMemo(() => {
    if (!selectedCompanyId || !companyDataSource || !startMonth || !endMonth) {
      return {
        tradeHistory: [] as TradeHistoryRow[],
        tradeHistoryDateLabel: dateRangeLabel,
        tradeHistoryUsedFallback: false,
      };
    }

    const getHistoryRows = (rangeStart: string, rangeEnd: string) =>
      getCompanyTradeHistoryFromDataset({
        dataset: companyDataSource,
        companyId: selectedCompanyId,
        hsCode: selectedHsCode.code,
        startMonth: rangeStart,
        endMonth: rangeEnd,
      });

    const inRangeRows = getHistoryRows(startMonth, endMonth);

    if (inRangeRows.length > 0) {
      return {
        tradeHistory: inRangeRows,
        tradeHistoryDateLabel: dateRangeLabel,
        tradeHistoryUsedFallback: false,
      };
    }

    if (!availableMonths.length) {
      return {
        tradeHistory: [] as TradeHistoryRow[],
        tradeHistoryDateLabel: dateRangeLabel,
        tradeHistoryUsedFallback: false,
      };
    }

    const fallbackStart = availableMonths[0];
    const fallbackEnd = availableMonths[availableMonths.length - 1];
    const fallbackRows = getHistoryRows(fallbackStart, fallbackEnd);

    if (fallbackRows.length > 0) {
      return {
        tradeHistory: fallbackRows,
        tradeHistoryDateLabel: `${formatMonthLabel(fallbackStart)} - ${formatMonthLabel(fallbackEnd)}`,
        tradeHistoryUsedFallback: true,
      };
    }

    return {
      tradeHistory: [] as TradeHistoryRow[],
      tradeHistoryDateLabel: dateRangeLabel,
      tradeHistoryUsedFallback: false,
    };
  }, [
    companyDataSource,
    selectedCompanyId,
    selectedHsCode.code,
    startMonth,
    endMonth,
    availableMonths,
    dateRangeLabel,
  ]);

  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companySummaries;
    const term = companySearch.toLowerCase();
    return companySummaries.filter(
      (row) =>
        row.name.toLowerCase().includes(term) ||
        row.id.toLowerCase().includes(term) ||
        (row.buyerType ?? "").toLowerCase().includes(term) ||
        (row.product ?? "").toLowerCase().includes(term) ||
        (row.productDescription ?? "").toLowerCase().includes(term) ||
        row.countryCode.toLowerCase().includes(term) ||
        getCountryLabel(row.countryCode).toLowerCase().includes(term),
    );
  }, [companySummaries, companySearch, getCountryLabel]);

  const sortedCompanies = useMemo(() => {
    const direction = companySortDirection === "asc" ? 1 : -1;
    const getValue = (row: typeof companySummaries[number]) => {
      switch (companySortKey) {
        case "company":
          return row.name;
        case "type":
          return row.buyerType ?? "";
        case "customerType":
          return row.productDescription ?? "";
        case "country":
          return getCountryLabel(row.countryCode);
        case "status":
          return row.status;
        case "product":
          return row.product ?? "";
        case "tradeSum":
        default:
          return row.tradeSum;
      }
    };
    return [...filteredCompanies].sort((a, b) => {
      const aValue = getValue(a);
      const bValue = getValue(b);
      if (typeof aValue === "string" && typeof bValue === "string") {
        return aValue.localeCompare(bValue) * direction;
      }
      return ((aValue as number) - (bValue as number)) * direction;
    });
  }, [filteredCompanies, companySortDirection, companySortKey, getCountryLabel]);

  const focusedCompanySet = useMemo(() => new Set(focusedCompanyIds), [focusedCompanyIds]);
  const topPinnedCompanySet = useMemo(() => new Set(topPinnedCompanyIds), [topPinnedCompanyIds]);
  const replaceRequestCompanySet = useMemo(
    () => new Set(replacementRequests.map((entry) => entry.companyId)),
    [replacementRequests],
  );
  const replaceRequestReasonByCompanyId = useMemo(() => {
    const reasonMap = new Map<string, string>();
    replacementRequests.forEach((entry) => reasonMap.set(entry.companyId, entry.reason));
    return reasonMap;
  }, [replacementRequests]);

  const visibleCompanies = useMemo(() => {
    const sortedMap = new Map(sortedCompanies.map((row) => [row.id, row]));
    const focusedInCurrentResult = focusedCompanyIds
      .map((id) => sortedMap.get(id))
      .filter((row): row is (typeof sortedCompanies)[number] => Boolean(row));
    const topPinnedInCurrentResult = topPinnedCompanyIds
      .map((id) => sortedMap.get(id))
      .filter((row): row is (typeof sortedCompanies)[number] => Boolean(row));

    if (companyListMode === "focus") {
      return focusedInCurrentResult;
    }

    const topPinnedIds = new Set(topPinnedInCurrentResult.map((row) => row.id));
    const unpinned = sortedCompanies.filter((row) => !topPinnedIds.has(row.id));
    return [...topPinnedInCurrentResult, ...unpinned];
  }, [companyListMode, sortedCompanies, focusedCompanyIds, topPinnedCompanyIds]);

  const companyTotalRows = visibleCompanies.length;
  const companyTotalPages = useMemo(
    () => Math.max(1, Math.ceil(companyTotalRows / companyPageSize)),
    [companyTotalRows, companyPageSize],
  );
  const paginatedCompanies = useMemo(() => {
    const start = (companyCurrentPage - 1) * companyPageSize;
    return visibleCompanies.slice(start, start + companyPageSize);
  }, [visibleCompanies, companyCurrentPage, companyPageSize]);
  const companyPageStart = companyTotalRows === 0 ? 0 : (companyCurrentPage - 1) * companyPageSize + 1;
  const companyPageEnd = Math.min(companyCurrentPage * companyPageSize, companyTotalRows);

  useEffect(() => {
    setCompanyCurrentPage(1);
  }, [companySearch, companyListMode, selectedCountryCode, selectedHsCode.code, startMonth, endMonth]);

  useEffect(() => {
    if (companyCurrentPage > companyTotalPages) {
      setCompanyCurrentPage(companyTotalPages);
    }
  }, [companyCurrentPage, companyTotalPages]);

  const handleToggleFocusCompany = useCallback((companyId: string) => {
    setFocusedCompanyIds((prev) => (
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [companyId, ...prev]
    ));
  }, []);

  const handleToggleTopPinCompany = useCallback((companyId: string) => {
    setTopPinnedCompanyIds((prev) => (
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [companyId, ...prev]
    ));
  }, []);

  const handleSelectCompanyForFocus = useCallback((companyId: string) => {
    setFocusedCompanyIds((prev) => (
      prev.includes(companyId)
        ? prev
        : [companyId, ...prev]
    ));
    setCompanyListMode("focus");
  }, []);

  const handleClearFocusMode = useCallback(() => {
    setFocusedCompanyIds([]);
    setCompanyListMode("overview");
  }, []);

  const openRequestCompanyReplacementDialog = useCallback((companyId: string, companyName: string) => {
    setRequestCompanyDraft({ id: companyId, name: companyName });
    setReplaceRequestReason("");
    setReplaceRequestReasonError(null);
    setIsRequestDialogOpen(true);
  }, []);

  const handleUndoCompanyReplacement = useCallback((companyId: string, companyName: string) => {
    setReplacementRequests((prev) => prev.filter((entry) => entry.companyId !== companyId));
    toast({
      title: "Request removed",
      description: `${companyName} replacement request was undone.`,
    });
  }, [toast]);

  const handleConfirmCompanyReplacement = useCallback(() => {
    if (!requestCompanyDraft) return;
    const reason = replaceRequestReason.trim();
    if (!reason) {
      setReplaceRequestReasonError("Please enter a reason.");
      return;
    }

    setReplacementRequests((prev) => {
      const next = prev.filter((entry) => entry.companyId !== requestCompanyDraft.id);
      next.unshift({
        companyId: requestCompanyDraft.id,
        reason,
        requestedAt: new Date().toISOString(),
      });
      return next;
    });

    toast({
      title: "Replacement request sent",
      description: `${requestCompanyDraft.name} was flagged for ORIGO backoffice review.`,
    });

    setIsRequestDialogOpen(false);
    setReplaceRequestReason("");
    setReplaceRequestReasonError(null);
    setRequestCompanyDraft(null);
  }, [replaceRequestReason, requestCompanyDraft, toast]);

  const handleReorderCompanyColumn = useCallback((fromKey: string, toKey: string) => {
    setCompanyColumnOrder((prev) => {
      const normalized = sanitizeCompanyColumnOrder(prev);
      if (!normalized.includes(fromKey as CompanyColumnKey) || !normalized.includes(toKey as CompanyColumnKey)) {
        return normalized;
      }
      const next = [...normalized];
      const fromIndex = next.indexOf(fromKey as CompanyColumnKey);
      const toIndex = next.indexOf(toKey as CompanyColumnKey);
      if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return normalized;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const handleCompanySort = (key: string) => {
    setCompanySortDirection((prev) =>
      companySortKey === key ? (prev === "asc" ? "desc" : "asc") : "desc",
    );
    setCompanySortKey(key);
  };

  const handleMobileSortKeyChange = (key: string) => {
    setCompanySortKey(key);
    setCompanySortDirection("desc");
  };

  const toggleMobileSortDirection = () => {
    setCompanySortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const mobileSortOptions = [
    { value: "tradeSum", label: "Trade Sum" },
    { value: "status", label: "Status" },
    { value: "country", label: "Country" },
    { value: "type", label: "Type" },
    { value: "customerType", label: "Customer Type" },
    { value: "product", label: "Product" },
    { value: "company", label: "Company" },
  ];

  const handleSelectCountry = (code: string) => {
    setSelectedCountryCode(code);
    setSelectedCompanyId(null);
    setIsCompanyProfileOpen(false);
  };

  const handleResetView = () => {
    setSelectedCountryCode(null);
    setSelectedCompanyId(null);
    setIsCompanyProfileOpen(false);
  };

  const handleViewCompaniesFor = (code?: string) => {
    if (code && code !== selectedCountryCode) {
      setSelectedCountryCode(code);
      setSelectedCompanyId(null);
    }
    requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const openCompanyProfilePage = useCallback((companyId: string) => {
    const params = new URLSearchParams();
    if (selectedHsCode.code) params.set("hs", selectedHsCode.code);
    if (startMonth) params.set("start", startMonth);
    if (endMonth) params.set("end", endMonth);
    if (selectedCountryCode) params.set("country", selectedCountryCode);
    navigate(`/market-intelligence/company/${encodeURIComponent(companyId)}?${params.toString()}`);
  }, [endMonth, navigate, selectedCountryCode, selectedHsCode.code, startMonth]);

  const companyColumnMap = useMemo(() => ({
    pin: {
      key: "pin",
      header: "Focus",
      width: "132px",
      align: "center" as const,
      render: (item: typeof companySummaries[number]) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 rounded-full",
            focusedCompanySet.has(item.id) ? "text-[#b27700] hover:text-[#8b5f00]" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (focusedCompanySet.has(item.id)) {
              handleToggleFocusCompany(item.id);
            } else {
              handleSelectCompanyForFocus(item.id);
            }
          }}
          title={focusedCompanySet.has(item.id) ? "Remove from focus list" : "Add to focus list"}
          aria-label={focusedCompanySet.has(item.id) ? `Remove ${item.name} from focus` : `Add ${item.name} to focus`}
        >
          {focusedCompanySet.has(item.id) ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </Button>
      ),
    },
    status: {
      key: "status",
      header: "Status",
      width: "88px",
      sortable: true,
      align: "center" as const,
      render: (item: typeof companySummaries[number]) => (
        <span
          className={cn(
            "inline-block h-3 w-3 rounded-full",
            item.status === "new" ? "bg-[#ffbd59]" : "bg-emerald-500",
          )}
          title={item.status}
          aria-label={item.status}
        />
      ),
    },
    country: {
      key: "country",
      header: "Country",
      width: "190px",
      sortable: true,
      render: (item: typeof companySummaries[number]) => (
        <div className="flex items-center gap-2">
          <CountryFlag countryCode={item.countryCode} countryName={getCountryLabel(item.countryCode)} size="sm" />
          <div>
            <p className="font-medium">{getCountryLabel(item.countryCode)}</p>
            <p className="text-xs text-muted-foreground">{item.countryCode || "-"}</p>
          </div>
        </div>
      ),
    },
    company: {
      key: "company",
      header: "Company",
      width: "260px",
      sortable: true,
      render: (item: typeof companySummaries[number]) => (
        <div className="space-y-0.5">
          <p className="font-medium">{item.name}</p>
          {topPinnedCompanySet.has(item.id) ? (
            <p className="text-xs font-medium text-[#b27700]">Pinned to top</p>
          ) : null}
          {replaceRequestCompanySet.has(item.id) ? (
            <p className="text-xs font-medium text-amber-700">
              Replacement requested
              {replaceRequestReasonByCompanyId.get(item.id) ? ` · ${replaceRequestReasonByCompanyId.get(item.id)}` : ""}
            </p>
          ) : null}
        </div>
      ),
    },
    type: {
      key: "type",
      header: "Type",
      width: "130px",
      sortable: true,
      render: (item: typeof companySummaries[number]) => (
        <span>{item.buyerType ?? "Importer"}</span>
      ),
    },
    product: {
      key: "product",
      header: "Product",
      width: "190px",
      sortable: true,
      align: "left" as const,
      render: (item: typeof companySummaries[number]) => (
        <span>{item.product ?? selectedHsCode.product}</span>
      ),
    },
    customerType: {
      key: "customerType",
      header: "Customer Type",
      width: "300px",
      sortable: true,
      align: "left" as const,
      render: (item: typeof companySummaries[number]) => (
        <CustomerTypeCell value={item.productDescription} />
      ),
    },
    tradeSum: {
      key: "tradeSum",
      header: "Trade Sum",
      width: "150px",
      sortable: true,
      align: "right" as const,
      render: (item: typeof companySummaries[number]) => (
        <span className="font-medium">{formatNumber(item.tradeSum)}</span>
      ),
    },
    action: {
      key: "action",
      header: "",
      width: "300px",
      render: (item: typeof companySummaries[number]) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 text-primary hover:text-primary"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openCompanyProfilePage(item.id);
            }}
          >
            View Profile
            <ChevronRight className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full border-border/70 bg-background/90"
                aria-label={`More actions for ${item.name}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-popover">
              <DropdownMenuItem
                onSelect={() => {
                  handleToggleTopPinCompany(item.id);
                }}
              >
                {topPinnedCompanySet.has(item.id) ? "Unpin from Top" : "Pin to Top"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  if (replaceRequestCompanySet.has(item.id)) {
                    handleUndoCompanyReplacement(item.id, item.name);
                  } else {
                    openRequestCompanyReplacementDialog(item.id, item.name);
                  }
                }}
              >
                {replaceRequestCompanySet.has(item.id) ? "Undo Requested" : "Request Replace"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  }), [
    focusedCompanySet,
    topPinnedCompanySet,
    getCountryLabel,
    handleSelectCompanyForFocus,
    handleToggleTopPinCompany,
    handleToggleFocusCompany,
    handleUndoCompanyReplacement,
    openRequestCompanyReplacementDialog,
    openCompanyProfilePage,
    replaceRequestReasonByCompanyId,
    replaceRequestCompanySet,
    selectedHsCode.product,
  ]);

  const companyColumns = useMemo(() => {
    const orderedKeys = sanitizeCompanyColumnOrder(companyColumnOrder);
    return orderedKeys.map((key) => companyColumnMap[key]);
  }, [companyColumnMap, companyColumnOrder]);

  const isCaneSugarSelected = useMemo(
    () => selectedHsCode.product.trim().toLowerCase().includes("cane sugar"),
    [selectedHsCode.product],
  );

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Market Intelligence"
        subtitle="Explore global trade data and market opportunities"
      />

      <div className="relative flex-1 overflow-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-5 md:pb-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="overflow-x-auto pb-1">
            <div className="inline-flex min-w-full rounded-2xl border border-border/70 bg-card/80 p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] backdrop-blur">
              {marketSectionTabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "min-w-[148px] flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition sm:min-w-[176px]",
                      isActive
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {activeTab === "market-analysis" ? (
          <div className="mt-6">
            <MarketAnalysisTab selectedProduct={selectedHsCode.product} dateRangeLabel={dateRangeLabel} />
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <section className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Market Scope
                </p>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Product
                  </label>
                  <Select
                    value={selectedHsCode.code}
                    onValueChange={(value) => {
                      const hs = effectiveHsCodeOptions.find((item) => item.code === value);
                      if (hs) {
                        setSelectedHsCode(hs);
                      }
                    }}
                    disabled={effectiveHsCodeOptions.length === 0}
                  >
                    <SelectTrigger className="h-10 w-full rounded-2xl border-border/70 bg-background/90 px-3.5 text-sm focus:ring-1 focus:ring-slate-300">
                      <SelectValue>
                        {effectiveHsCodeOptions.length > 0 ? selectedHsCode.product : "No product data"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {effectiveHsCodeOptions.map((hs) => (
                        <SelectItem key={hs.code} value={hs.code}>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{hs.product}</p>
                            <p className="truncate text-xs text-muted-foreground">{hs.description}</p>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/90 px-4 py-3 lg:min-w-[168px]">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Active Countries
                  </p>
                  <p className="mt-1 text-xl font-semibold leading-none text-foreground">{activeCountryCount}</p>
                </div>
              </div>
            </section>

            <div className="relative">
              <div className={cn("space-y-5", isCaneSugarSelected && "pointer-events-none blur-[2px]")}>
                {companyDataError && !isCompanyDataLoading && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {companyDataError}
                  </div>
                )}
                {!companyDataError && !isCompanyDataLoading && effectiveHsCodeOptions.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-card/90 px-4 py-3 text-sm text-muted-foreground">
                    No HS code data found in Supabase.
                  </div>
                )}

                <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur">
              <div className="border-b border-border/70 px-4 py-4 md:px-5">
                <h2 className="text-base font-semibold text-foreground">Global Import Volume</h2>
                <p className="text-sm text-muted-foreground">Country-level distribution with customer counts</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="text-muted-foreground">Marker colors:</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ffbd59]/55 bg-[#fffbf0] px-2 py-0.5 font-medium text-amber-800">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd59] ring-2 ring-[#ffbd59]/35" />
                    New
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/45 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
                    Existing
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/45 bg-blue-50 px-2 py-0.5 font-medium text-blue-800">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-blue-500/30" />
                    Mixed
                  </span>
                </div>
              </div>
              <div className="border-b border-border/70 bg-background/70 px-4 py-2.5 md:px-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#0a84ff]" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Time Window
                  </span>
                  <span className="text-sm font-medium text-foreground">{BUYER_WINDOW_LABEL}</span>
                </div>
              </div>
              <section className="w-full p-1 md:p-2">
                <div className="relative aspect-[1.9/1] w-full md:aspect-[2.35/1]">
                  {isMapLoading ? (
                    <Skeleton className="h-full w-full rounded-xl" />
                  ) : (
                    <ErrorBoundary
                      fallback={
                        <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-sm text-muted-foreground">
                          Map is temporarily unavailable. Please refresh the page.
                        </div>
                      }
                    >
                      <WorldMap
                        data={mapCountryRows.map((row) => ({
                          code: row.code,
                          name: row.name,
                          flag: row.flag,
                          metricValue: row.metricTotal,
                          share: row.share,
                          importersCount: row.importersCount,
                          customerStatus: row.customerStatus,
                          newCustomers: row.newCustomers,
                          existingCustomers: row.existingCustomers,
                        }))}
                        metricLabel={metricLabel}
                        formatMetric={formatMetric}
                        onCountryClick={handleSelectCountry}
                        selectedCountryCode={selectedCountryCode}
                        dateRangeLabel={dateRangeLabel}
                        enableHoverCard={!isMobile}
                        onViewCompanies={handleViewCompaniesFor}
                        onClearSelection={handleResetView}
                        autoZoomKey={`${selectedHsCode.code}-${startMonth}-${endMonth}`}
                      />
                    </ErrorBoundary>
                  )}
                </div>
              </section>
                </section>

                <section
                  ref={tableRef}
                  className="overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur"
                >
              <div className="border-b border-border/70 px-4 py-4 md:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold">Company List</h2>
                    <p className="text-sm text-muted-foreground">
                      {companyListMode === "focus"
                        ? `Focused companies (${companyTotalRows})`
                        : selectedCountry
                          ? `Showing companies in ${selectedCountry.name}`
                          : "Showing all companies across all countries"}
                    </p>
                    {companyListMode === "overview" && (
                      <p className="text-xs text-muted-foreground">Use the Focus button to add a company into Focus mode.</p>
                    )}
                    {!isMobile && (
                      <p className="text-xs text-muted-foreground">Drag table headers to reorder columns.</p>
                    )}
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <div className="inline-flex items-center rounded-full border border-border/70 bg-muted/20 p-1">
                      <button
                        type="button"
                        onClick={() => setCompanyListMode("overview")}
                        className={cn(
                          "h-8 rounded-full px-3.5 text-xs font-medium transition",
                          companyListMode === "overview"
                            ? "bg-[#ffbd59] text-[#3b2a06]"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Overview
                      </button>
                      <button
                        type="button"
                        onClick={() => setCompanyListMode("focus")}
                        className={cn(
                          "h-8 rounded-full px-3.5 text-xs font-medium transition",
                          companyListMode === "focus"
                            ? "bg-[#ffbd59] text-[#3b2a06]"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Focus
                      </button>
                    </div>
                    {companyListMode === "focus" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleClearFocusMode}
                        className="rounded-2xl border-border/70 bg-background/90"
                      >
                        Clear focus
                      </Button>
                    )}
                    {selectedCountry && (
                      <Badge variant="secondary" className="gap-2">
                        Selected: {selectedCountry.name} ({selectedCountry.code})
                        <button type="button" onClick={handleResetView} className="text-xs hover:underline">
                          × Clear
                        </button>
                      </Badge>
                    )}
                    {selectedCountry && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetView}
                        className="hidden rounded-2xl border-border/70 bg-background/90 sm:inline-flex"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset view
                      </Button>
                    )}
                    {!isMobile && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCompanyColumnOrder(DEFAULT_COMPANY_COLUMN_ORDER)}
                        className="rounded-2xl border-border/70 bg-background/90"
                      >
                        Reset columns
                      </Button>
                    )}
                    <div className="relative w-full sm:w-auto">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search company, type, product..."
                        className="h-10 w-full rounded-2xl border-border/70 bg-background/90 pl-10 text-sm focus-visible:ring-1 focus-visible:ring-slate-300 sm:w-72"
                        value={companySearch}
                        onChange={(event) => setCompanySearch(event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-4 md:p-5">
                {isMobile && (
                  <div className="mb-3 flex items-center gap-2 md:hidden">
                    <Select value={companySortKey} onValueChange={handleMobileSortKeyChange}>
                      <SelectTrigger className="h-10 rounded-2xl border-border/70 bg-background/90 text-sm focus:ring-1 focus:ring-slate-300">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {mobileSortOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 shrink-0 gap-1.5 rounded-2xl border-border/70 bg-background/90 px-3"
                      onClick={toggleMobileSortDirection}
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" />
                      {companySortDirection === "desc" ? "Desc" : "Asc"}
                    </Button>
                  </div>
                )}

                {isCompanyLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full rounded-2xl" />
                    <Skeleton className="h-12 w-full rounded-2xl" />
                    <Skeleton className="h-12 w-full rounded-2xl" />
                  </div>
                ) : isMobile ? (
                  companyTotalRows === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-card/90 p-6 text-center text-sm text-muted-foreground">
                      {companyListMode === "focus" ? "No focused companies yet. Focus a company in Overview." : "No companies found"}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {paginatedCompanies.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "rounded-2xl border border-border/60 bg-card px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
                            focusedCompanySet.has(item.id) && "border-[#ffbd59]/65",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex items-center gap-3">
                              <CountryFlag countryCode={item.countryCode} countryName={getCountryLabel(item.countryCode)} size="md" />
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">{item.name}</p>
                                {focusedCompanySet.has(item.id) && (
                                  <p className="text-xs font-medium text-[#b27700]">Pinned in Focus</p>
                                )}
                                {topPinnedCompanySet.has(item.id) && (
                                  <p className="text-xs font-medium text-[#b27700]">Pinned to Top</p>
                                )}
                                {replaceRequestCompanySet.has(item.id) && (
                                  <p className="truncate text-xs font-medium text-amber-700">
                                    Requested · {replaceRequestReasonByCompanyId.get(item.id)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "inline-block h-3 w-3 rounded-full",
                                  item.status === "new" ? "bg-[#ffbd59]" : "bg-emerald-500",
                                )}
                                title={item.status}
                                aria-label={item.status}
                              />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className={cn(
                                      "h-8 w-8 rounded-xl border-border/70 bg-background/90",
                                      replaceRequestCompanySet.has(item.id) &&
                                        "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-50",
                                    )}
                                    aria-label={`More actions for ${item.name}`}
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                    }}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44 bg-popover">
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      handleToggleTopPinCompany(item.id);
                                    }}
                                  >
                                    {topPinnedCompanySet.has(item.id) ? "Unpin from Top" : "Pin to Top"}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => {
                                      if (replaceRequestCompanySet.has(item.id)) {
                                        handleUndoCompanyReplacement(item.id, item.name);
                                      } else {
                                        openRequestCompanyReplacementDialog(item.id, item.name);
                                      }
                                    }}
                                  >
                                    {replaceRequestCompanySet.has(item.id) ? "Undo Requested" : "Request Replace"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-secondary/45 p-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Trade Sum</p>
                              <p className="font-semibold text-foreground">{formatNumber(item.tradeSum)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Type</p>
                              <p className="font-semibold text-foreground">{item.buyerType ?? "Importer"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Product</p>
                              <p className="font-semibold text-foreground">{item.product ?? selectedHsCode.product}</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-xs text-muted-foreground">Customer Type</p>
                              <p className="font-semibold text-foreground">{item.productDescription ?? "—"}</p>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-10 rounded-2xl border-border/70 bg-background/90"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (focusedCompanySet.has(item.id)) {
                                  handleToggleFocusCompany(item.id);
                                } else {
                                  handleSelectCompanyForFocus(item.id);
                                }
                              }}
                            >
                              {focusedCompanySet.has(item.id) ? "Unfocus" : "Focus"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="relative h-10 justify-center rounded-2xl border-border/70 bg-background/90"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                openCompanyProfilePage(item.id);
                              }}
                            >
                              <span>View Profile</span>
                              <ChevronRight className="pointer-events-none absolute right-4 h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <DataTable
                    columns={companyColumns}
                    data={paginatedCompanies}
                    sortKey={companySortKey}
                    sortDirection={companySortDirection}
                    onSort={handleCompanySort}
                    enableColumnReorder
                    onColumnReorder={handleReorderCompanyColumn}
                    emptyMessage={companyListMode === "focus" ? "No focused companies yet. Focus a company in Overview." : "No companies found"}
                    className={[
                      "[&_table]:min-w-[1340px] [&_table]:border-separate [&_table]:border-spacing-0",
                      "[&_th]:px-6 [&_th]:py-4 [&_th]:text-[13px] [&_th]:font-semibold [&_th]:tracking-[0.01em] [&_th]:text-slate-600",
                      "[&_td]:px-6 [&_td]:py-4 [&_td]:align-middle [&_td]:text-[14px] [&_td]:leading-6",
                      "[&_tbody_tr]:border-b [&_tbody_tr]:border-slate-200/70",
                      "[&_tbody_tr:nth-child(odd)]:bg-white [&_tbody_tr:nth-child(even)]:bg-slate-50/45",
                      "[&_tbody_tr:hover]:bg-slate-100/70",
                    ].join(" ")}
                  />
                )}

                {!isCompanyLoading && companyTotalRows > 0 && (
                  <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      Showing {formatNumber(companyPageStart)}-{formatNumber(companyPageEnd)} of {formatNumber(companyTotalRows)}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2 py-1">
                        <span className="text-[11px] font-medium text-muted-foreground">Per page</span>
                        <Select
                          value={String(companyPageSize)}
                          onValueChange={(value) => {
                            setCompanyPageSize(Number(value));
                            setCompanyCurrentPage(1);
                          }}
                        >
                          <SelectTrigger className="h-7 w-[74px] rounded-full border-none bg-transparent px-2 text-xs shadow-none focus:ring-0">
                            <SelectValue placeholder="20" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="30">30</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 min-w-[84px] rounded-full px-3 text-xs"
                        onClick={() => setCompanyCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={companyCurrentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-xs font-medium text-slate-600">
                        Page {formatNumber(companyCurrentPage)} / {formatNumber(companyTotalPages)}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 min-w-[84px] rounded-full px-3 text-xs"
                        onClick={() => setCompanyCurrentPage((prev) => Math.min(companyTotalPages, prev + 1))}
                        disabled={companyCurrentPage >= companyTotalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
                </section>
              </div>

              {isCaneSugarSelected ? (
                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-slate-900/10 backdrop-blur-sm">
                  <div className="space-y-2 rounded-2xl border border-slate-200/90 bg-white/90 px-5 py-4 text-center shadow-[0_18px_45px_-26px_rgba(15,23,42,0.45)]">
                    <Lock className="mx-auto h-10 w-10 text-slate-700" />
                    <p className="text-sm font-medium text-slate-700">Locked for Cane Sugar</p>
                    <p className="text-xs text-slate-500">Change Product to Refined Sugar in Market Scope.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={isRequestDialogOpen}
        onOpenChange={(open) => {
          setIsRequestDialogOpen(open);
          if (!open) {
            setReplaceRequestReason("");
            setReplaceRequestReasonError(null);
            setRequestCompanyDraft(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>Request company replacement</DialogTitle>
            <DialogDescription>
              {requestCompanyDraft ? `Why do you want to replace "${requestCompanyDraft.name}"?` : "Please provide a reason."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {[
                "Not relevant to current target",
                "Duplicate company",
                "Wrong market/country fit",
                "Low potential",
              ].map((reason) => (
                <Button
                  key={reason}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => {
                    setReplaceRequestReason(reason);
                    setReplaceRequestReasonError(null);
                  }}
                >
                  {reason}
                </Button>
              ))}
            </div>

            <Textarea
              value={replaceRequestReason}
              onChange={(event) => {
                setReplaceRequestReason(event.target.value);
                if (replaceRequestReasonError) setReplaceRequestReasonError(null);
              }}
              placeholder="Type reason (required)"
              className="min-h-[110px] rounded-xl"
            />
            {replaceRequestReasonError ? (
              <p className="text-xs text-destructive">{replaceRequestReasonError}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsRequestDialogOpen(false);
                setReplaceRequestReason("");
                setReplaceRequestReasonError(null);
                setRequestCompanyDraft(null);
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirmCompanyReplacement}>
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CompanyProfileDrawer
        open={isCompanyProfileOpen}
        onOpenChange={(open) => {
          setIsCompanyProfileOpen(open);
          if (!open) setSelectedCompanyId(null);
        }}
        company={selectedCompany}
        country={selectedCountry}
        hsCode={selectedHsCode}
        dateRangeLabel={tradeHistoryDateLabel || dateRangeLabel}
        tradeHistory={tradeHistory}
        tradeHistoryUsedFallback={tradeHistoryUsedFallback}
        isLoading={isCompanyLoading}
      />
    </div>
  );
}

