import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, ChevronRight, RotateCcw, ArrowUpDown, Pin, PinOff } from "lucide-react";
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
import { WorldMap } from "@/components/market/WorldMap";
import { CompanyProfileDrawer } from "@/components/market/CompanyProfileDrawer";
import { MarketAnalysisTab } from "@/components/market-analysis/MarketAnalysisTab";
import { TopBar } from "@/components/layout/TopBar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getFlagEmoji } from "@/lib/flags";
import { useIsMobile } from "@/hooks/use-mobile";
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

const MARKET_TAB_STORAGE_KEY = "market-intelligence-active-tab";
const MARKET_FOCUS_IDS_STORAGE_PREFIX = "market-intelligence-focus-company-ids";
const MARKET_FOCUS_MODE_STORAGE_PREFIX = "market-intelligence-focus-mode";

const marketSectionTabs: Array<{ key: MarketSectionTab; label: string }> = [
  { key: "market-insights", label: "Global Demand" },
  { key: "market-analysis", label: "Market Analysis" },
];

function CustomerTypeCell({ value }: { value?: string | null }) {
  const textValue = (value ?? "").trim() || "—";
  const contentId = useId();
  const textRef = useRef<HTMLDivElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element) {
      setIsOverflowing(false);
      return;
    }

    const checkOverflow = () => {
      const quickOverflow = element.scrollHeight - element.clientHeight > 1;
      if (quickOverflow) {
        setIsOverflowing(true);
        return;
      }

      const clone = element.cloneNode(true) as HTMLDivElement;
      clone.style.position = "fixed";
      clone.style.left = "-9999px";
      clone.style.top = "0";
      clone.style.visibility = "hidden";
      clone.style.pointerEvents = "none";
      clone.style.height = "auto";
      clone.style.maxHeight = "none";
      clone.style.overflow = "visible";
      clone.style.display = "block";
      clone.style.webkitLineClamp = "unset";
      clone.style.WebkitLineClamp = "unset";
      clone.classList.remove("line-clamp-2");
      clone.style.width = `${element.clientWidth}px`;
      document.body.appendChild(clone);
      const fullHeight = clone.scrollHeight;
      clone.remove();

      const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight || "20");
      const twoLineHeight = lineHeight * 2 + 1;
      setIsOverflowing(fullHeight > twoLineHeight);
    };

    checkOverflow();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => checkOverflow());
      observer.observe(element);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", checkOverflow);
    return () => window.removeEventListener("resize", checkOverflow);
  }, [textValue]);

  const trigger = (
    <div
      ref={textRef}
      className="line-clamp-2 min-h-[2.5rem] break-words text-sm leading-5 text-foreground focus:outline-none"
      tabIndex={isOverflowing ? 0 : -1}
      aria-describedby={isOverflowing ? contentId : undefined}
    >
      {textValue}
    </div>
  );

  if (!isOverflowing || textValue === "—") {
    return trigger;
  }

  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent
        id={contentId}
        side="top"
        align="start"
        className="max-w-[320px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-5 text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.10)]"
      >
        {textValue}
      </TooltipContent>
    </Tooltip>
  );
}

export default function MarketIntelligence() {
  const navigate = useNavigate();
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
  const isMobile = useIsMobile();
  const tableRef = useRef<HTMLDivElement | null>(null);

  const [companySortKey, setCompanySortKey] = useState("tradeSum");
  const [companySortDirection, setCompanySortDirection] = useState<"asc" | "desc">("desc");

  const [companySearch, setCompanySearch] = useState("");
  const [isViewLoading, setIsViewLoading] = useState(true);
  const [isCompanyDataLoading, setIsCompanyDataLoading] = useState(false);
  const [companyDataSource, setCompanyDataSource] = useState<CompanyListDataset | null>(null);
  const [companyDataError, setCompanyDataError] = useState<string | null>(null);

  const focusIdsStorageKey = useMemo(
    () => `${MARKET_FOCUS_IDS_STORAGE_PREFIX}:${selectedHsCode.code || "__default__"}`,
    [selectedHsCode.code],
  );
  const focusModeStorageKey = useMemo(
    () => `${MARKET_FOCUS_MODE_STORAGE_PREFIX}:${selectedHsCode.code || "__default__"}`,
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

  const hsCodeOptions = useMemo(
    () => (companyDataSource ? getHsCodesFromDataset(companyDataSource) : []),
    [companyDataSource],
  );

  useEffect(() => {
    if (!hsCodeOptions.length) {
      if (selectedHsCode.code) {
        setSelectedHsCode(EMPTY_HS_CODE);
      }
      return;
    }
    const hasSelected = hsCodeOptions.some((option) => option.code === selectedHsCode.code);
    if (!hasSelected) {
      setSelectedHsCode(hsCodeOptions[0]);
    }
  }, [hsCodeOptions, selectedHsCode.code]);

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
    if (typeof window === "undefined" || !selectedHsCode.code) return;
    window.localStorage.setItem(focusModeStorageKey, companyListMode);
  }, [companyListMode, selectedHsCode.code, focusModeStorageKey]);

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

  const allCompanySummaries = useMemo(() => dbCompanySummaries, [dbCompanySummaries]);

  const companySummaries = useMemo(
    () =>
      selectedCountryCode
        ? allCompanySummaries.filter((row) => row.countryCode === selectedCountryCode)
        : allCompanySummaries,
    [allCompanySummaries, selectedCountryCode],
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

    allCompanySummaries.forEach((row) => {
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
  }, [allCompanySummaries, getCountryLabel]);

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

  const visibleCompanies = useMemo(() => {
    if (companyListMode === "overview") return sortedCompanies;
    return sortedCompanies.filter((row) => focusedCompanySet.has(row.id));
  }, [companyListMode, sortedCompanies, focusedCompanySet]);

  const handleToggleFocusCompany = useCallback((companyId: string) => {
    setFocusedCompanyIds((prev) => (
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

  const openCompanyProfilePage = (companyId: string) => {
    const params = new URLSearchParams();
    if (selectedHsCode.code) params.set("hs", selectedHsCode.code);
    if (startMonth) params.set("start", startMonth);
    if (endMonth) params.set("end", endMonth);
    if (selectedCountryCode) params.set("country", selectedCountryCode);
    navigate(`/market-intelligence/company/${encodeURIComponent(companyId)}?${params.toString()}`);
  };

  const companyColumns = [
    {
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
    {
      key: "country",
      header: "Country",
      width: "190px",
      sortable: true,
      render: (item: typeof companySummaries[number]) => (
        <div className="flex items-center gap-2">
          <span className="text-lg">{getFlagEmoji(item.countryCode)}</span>
          <div>
            <p className="font-medium">{getCountryLabel(item.countryCode)}</p>
            <p className="text-xs text-muted-foreground">{item.countryCode || "—"}</p>
          </div>
        </div>
      ),
    },
    {
      key: "company",
      header: "Company",
      width: "260px",
      sortable: true,
      render: (item: typeof companySummaries[number]) => (
        <div className="flex items-center gap-2">
          {focusedCompanySet.has(item.id) && <Pin className="h-3.5 w-3.5 text-[#ffbd59]" />}
          <p className="font-medium">{item.name}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      width: "130px",
      sortable: true,
      render: (item: typeof companySummaries[number]) => (
        <span>{item.buyerType ?? "Importer"}</span>
      ),
    },
    {
      key: "product",
      header: "Product",
      width: "190px",
      sortable: true,
      align: "left" as const,
      render: (item: typeof companySummaries[number]) => (
        <span>{item.product ?? selectedHsCode.product}</span>
      ),
    },
    {
      key: "customerType",
      header: "Customer Type",
      width: "300px",
      sortable: true,
      align: "left" as const,
      render: (item: typeof companySummaries[number]) => (
        <CustomerTypeCell value={item.productDescription} />
      ),
    },
    {
      key: "tradeSum",
      header: "Trade Sum",
      width: "150px",
      sortable: true,
      align: "right" as const,
      render: (item: typeof companySummaries[number]) => (
        <span className="font-medium">{formatNumber(item.tradeSum)}</span>
      ),
    },
    {
      key: "action",
      header: "",
      width: "220px",
      render: (item: typeof companySummaries[number]) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 text-foreground hover:text-foreground"
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
            {focusedCompanySet.has(item.id) ? (
              <>
                <PinOff className="h-4 w-4" />
                Unpin
              </>
            ) : (
              <>
                <Pin className="h-4 w-4" />
                Pin
              </>
            )}
          </Button>
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
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Market Intelligence"
        subtitle="Explore global trade data and market opportunities"
      />

      <div className="flex-1 overflow-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-5 md:pb-6">
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
                      const hs = hsCodeOptions.find((item) => item.code === value);
                      if (hs) setSelectedHsCode(hs);
                    }}
                    disabled={hsCodeOptions.length === 0}
                  >
                    <SelectTrigger className="h-10 w-full rounded-2xl border-border/70 bg-background/90 px-3.5 text-sm focus:ring-1 focus:ring-slate-300">
                      <SelectValue>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium">
                            {hsCodeOptions.length > 0 ? selectedHsCode.product : "No product data"}
                          </span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-popover">
                      {hsCodeOptions.map((hs) => (
                        <SelectItem key={hs.code} value={hs.code}>
                          <div className="flex w-full items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{hs.product}</p>
                              <p className="truncate text-xs text-muted-foreground">{hs.description}</p>
                            </div>
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

            {companyDataError && !isCompanyDataLoading && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {companyDataError}
              </div>
            )}
            {!companyDataError && !isCompanyDataLoading && hsCodeOptions.length === 0 && (
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
                        ? `Focused companies (${visibleCompanies.length})`
                        : selectedCountry
                          ? `Showing companies in ${selectedCountry.name}`
                          : "Showing all companies across all countries"}
                    </p>
                    {companyListMode === "overview" && (
                      <p className="text-xs text-muted-foreground">Click a company to pin and switch to Focus mode.</p>
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
                  visibleCompanies.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-card/90 p-6 text-center text-sm text-muted-foreground">
                      {companyListMode === "focus" ? "No focused companies yet. Select a company in Overview." : "No companies found"}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleCompanies.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            "rounded-2xl border border-border/60 bg-card px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
                            companyListMode === "overview" && "cursor-pointer hover:bg-muted/20",
                            focusedCompanySet.has(item.id) && "border-[#ffbd59]/65",
                          )}
                          onClick={() => {
                            if (companyListMode === "overview") {
                              handleSelectCompanyForFocus(item.id);
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex items-center gap-3">
                              <span className="text-2xl">{getFlagEmoji(item.countryCode)}</span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-foreground">{item.name}</p>
                                {focusedCompanySet.has(item.id) && (
                                  <p className="text-xs font-medium text-[#b27700]">Pinned in Focus</p>
                                )}
                              </div>
                            </div>
                            <span
                              className={cn(
                                "inline-block h-3 w-3 rounded-full",
                                item.status === "new" ? "bg-[#ffbd59]" : "bg-emerald-500",
                              )}
                              title={item.status}
                              aria-label={item.status}
                            />
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

                          <div className="mt-3 grid grid-cols-2 gap-2">
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
                              {focusedCompanySet.has(item.id) ? "Unpin" : "Pin to Focus"}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-10 justify-between rounded-2xl border-border/70 bg-background/90"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                openCompanyProfilePage(item.id);
                              }}
                            >
                              View Profile
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <DataTable
                    columns={companyColumns}
                    data={visibleCompanies}
                    sortKey={companySortKey}
                    sortDirection={companySortDirection}
                    onSort={handleCompanySort}
                    onRowClick={
                      companyListMode === "overview"
                        ? (item) => {
                            handleSelectCompanyForFocus((item as typeof companySummaries[number]).id);
                          }
                        : undefined
                    }
                    emptyMessage={companyListMode === "focus" ? "No focused companies yet. Select a company in Overview." : "No companies found"}
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
              </div>
            </section>
          </div>
        )}
      </div>

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
