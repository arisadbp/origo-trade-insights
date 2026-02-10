import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronRight, RotateCcw } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { getFlagEmoji } from "@/lib/flags";
import { useIsMobile } from "@/hooks/use-mobile";
import { hsCodes } from "@/data/market-intelligence/mockData";
import type { Company } from "@/data/market-intelligence/types";
import {
  formatMonthLabel,
  getAvailableMonths,
  getCompanyById,
  getCompanySummaries,
  getCompanyTradeHistory,
  getCountryByCode,
  getCountrySummaries,
  getHsCodeByCode,
} from "@/data/market-intelligence/selectors";
import type { TradeHistoryRow } from "@/data/market-intelligence/selectors";

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);
const metricLabel = "Total Weight (KG)";
const metricShortLabel = "Weight (KG)";
const formatMetric = (value: number) => `${formatNumber(value)} KG`;
const toSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);

type RangeKey = "6m" | "1y" | "3y";
const rangeOptions: Array<{ key: RangeKey; label: string; months: number }> = [
  { key: "6m", label: "6 months", months: 6 },
  { key: "1y", label: "1 year", months: 12 },
  { key: "3y", label: "3 year", months: 36 },
];

type MarketSectionTab =
  | "market-insights"
  | "market-analysis";

const MARKET_TAB_STORAGE_KEY = "market-intelligence-active-tab";

const marketSectionTabs: Array<{ key: MarketSectionTab; label: string }> = [
  { key: "market-insights", label: "Global Demand" },
  { key: "market-analysis", label: "Market Analysis" },
];

export default function MarketIntelligence() {
  const [activeTab, setActiveTab] = useState<MarketSectionTab>(() => {
    if (typeof window === "undefined") return "market-insights";
    const stored = window.sessionStorage.getItem(MARKET_TAB_STORAGE_KEY);
    return stored === "market-analysis" || stored === "market-insights"
      ? stored
      : "market-insights";
  });
  const [selectedHsCode, setSelectedHsCode] = useState(hsCodes[0]);
  const [selectedRange, setSelectedRange] = useState<RangeKey>("6m");
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isCompanyProfileOpen, setIsCompanyProfileOpen] = useState(false);
  const isMobile = useIsMobile();
  const tableRef = useRef<HTMLDivElement | null>(null);

  const [countrySortKey, setCountrySortKey] = useState("metric");
  const [countrySortDirection, setCountrySortDirection] = useState<"asc" | "desc">("desc");
  const [companySortKey, setCompanySortKey] = useState("metric");
  const [companySortDirection, setCompanySortDirection] = useState<"asc" | "desc">("desc");

  const [countrySearch, setCountrySearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const availableMonths = useMemo(
    () => getAvailableMonths(selectedHsCode.code),
    [selectedHsCode.code],
  );

  const { startMonth, endMonth } = useMemo(() => {
    if (!availableMonths.length) {
      return { startMonth: "", endMonth: "" };
    }
    const rangeMonths = rangeOptions.find((option) => option.key === selectedRange)?.months ?? 6;
    const end = availableMonths[availableMonths.length - 1];
    const start = availableMonths[Math.max(0, availableMonths.length - rangeMonths)];
    return { startMonth: start, endMonth: end };
  }, [availableMonths, selectedRange]);

  const selectedRangeMonths = useMemo(() => {
    if (!startMonth || !endMonth) return [] as string[];
    const startIndex = availableMonths.indexOf(startMonth);
    const endIndex = availableMonths.indexOf(endMonth);
    if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) return [] as string[];
    return availableMonths.slice(startIndex, endIndex + 1);
  }, [availableMonths, startMonth, endMonth]);

  useEffect(() => {
    setSelectedCountryCode(null);
    setSelectedCompanyId(null);
    setIsCompanyProfileOpen(false);
  }, [selectedHsCode.code]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(MARKET_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 320);
    return () => clearTimeout(timer);
  }, [selectedHsCode.code, startMonth, endMonth, selectedCountryCode, selectedCompanyId]);

  useEffect(() => {
    if (selectedCompanyId) {
      setIsCompanyProfileOpen(true);
    }
  }, [selectedCompanyId]);

  const dateRangeLabel = useMemo(() => {
    if (!startMonth || !endMonth) return "";
    return `${formatMonthLabel(startMonth)} - ${formatMonthLabel(endMonth)}`;
  }, [startMonth, endMonth]);

  const countrySummaries = useMemo(
    () =>
      getCountrySummaries({
        hsCode: selectedHsCode.code,
        startMonth,
        endMonth,
        metricKey: "weightKg",
      }),
    [selectedHsCode.code, startMonth, endMonth],
  );

  const countryRows = useMemo(
    () =>
      countrySummaries.map((country) => ({
        ...country,
        flag: getFlagEmoji(country.code),
      })),
    [countrySummaries],
  );

  const companySummaries = useMemo(() => {
    if (!selectedCountryCode) return [];
    return getCompanySummaries({
      hsCode: selectedHsCode.code,
      countryCode: selectedCountryCode,
      startMonth,
      endMonth,
      metricKey: "weightKg",
    });
  }, [selectedCountryCode, selectedHsCode.code, startMonth, endMonth]);

  const selectedCompanySummary = useMemo(
    () => (selectedCompanyId ? companySummaries.find((item) => item.id === selectedCompanyId) : undefined),
    [companySummaries, selectedCompanyId],
  );

  const selectedCompany = useMemo<Company | undefined>(() => {
    if (!selectedCompanyId) return undefined;
    const company = getCompanyById(selectedCompanyId);
    if (company) return company;
    if (!selectedCompanySummary) return undefined;

    const companySlug = toSlug(selectedCompanySummary.name) || "company";
    const shortName = selectedCompanySummary.name.split(/\s+/).slice(0, 2).join(" ");

    return {
      id: selectedCompanySummary.id,
      name: selectedCompanySummary.name,
      countryCode: selectedCompanySummary.countryCode || selectedCountryCode || "",
      buyerType: selectedCompanySummary.buyerType,
      industry: selectedCompanySummary.industry,
      website: selectedCompanySummary.website ?? `https://${companySlug}.example.com`,
      contacts: {
        person: `${shortName || "Sales"} Team`,
        email: `sales@${companySlug || "company"}.example.com`,
        phone: "+62 123-4567",
        website: selectedCompanySummary.website ?? `https://${companySlug}.example.com`,
        linkedIn: `https://www.linkedin.com/company/${selectedCompanySummary.id}`,
      },
    };
  }, [selectedCompanyId, selectedCompanySummary, selectedCountryCode]);

  const selectedCountry = selectedCountryCode
    ? getCountryByCode(selectedCountryCode)
    : selectedCompany?.countryCode
      ? getCountryByCode(selectedCompany.countryCode)
      : undefined;

  const { tradeHistory, tradeHistoryDateLabel, tradeHistoryUsedFallback } = useMemo(() => {
    if (!selectedCompanyId || !startMonth || !endMonth) {
      return {
        tradeHistory: [] as ReturnType<typeof getCompanyTradeHistory>,
        tradeHistoryDateLabel: dateRangeLabel,
        tradeHistoryUsedFallback: false,
      };
    }

    const inRangeRows = getCompanyTradeHistory({
      companyId: selectedCompanyId,
      hsCode: selectedHsCode.code,
      startMonth,
      endMonth,
    });

    if (inRangeRows.length > 0) {
      return {
        tradeHistory: inRangeRows,
        tradeHistoryDateLabel: dateRangeLabel,
        tradeHistoryUsedFallback: false,
      };
    }

    if (!availableMonths.length) {
      return {
        tradeHistory: [] as ReturnType<typeof getCompanyTradeHistory>,
        tradeHistoryDateLabel: dateRangeLabel,
        tradeHistoryUsedFallback: false,
      };
    }

    const fallbackStart = availableMonths[0];
    const fallbackEnd = availableMonths[availableMonths.length - 1];
    const fallbackRows = getCompanyTradeHistory({
      companyId: selectedCompanyId,
      hsCode: selectedHsCode.code,
      startMonth: fallbackStart,
      endMonth: fallbackEnd,
    });

    if (fallbackRows.length > 0) {
      return {
        tradeHistory: fallbackRows,
        tradeHistoryDateLabel: `${formatMonthLabel(fallbackStart)} - ${formatMonthLabel(fallbackEnd)}`,
        tradeHistoryUsedFallback: true,
      };
    }

    if (selectedCompanySummary) {
      const targetMonths = selectedRangeMonths.length > 0 ? selectedRangeMonths : availableMonths;
      if (targetMonths.length > 0) {
        const baseWeight = Math.max(
          1,
          Math.round(
            (selectedCompanySummary.metricTotal || 1) / Math.max(1, targetMonths.length),
          ),
        );
        const baseShipments = Math.max(
          1,
          Math.round(
            (selectedCompanySummary.shipmentsCount || selectedCompanySummary.frequency || 1) /
              Math.max(1, targetMonths.length),
          ),
        );

        const mockRows: TradeHistoryRow[] = targetMonths.map((month, index) => {
          const scale = 0.84 + ((index % 5) * 0.06);
          return {
            month,
            originCountry: selectedCountry?.name ?? "Not available",
            counterparty: selectedCompany?.name ?? selectedCompanySummary.name,
            weightKg: Math.max(1, Math.round(baseWeight * scale)),
            shipmentsCount: Math.max(1, Math.round(baseShipments * scale)),
            valueUsd: undefined,
          };
        });

        return {
          tradeHistory: mockRows.sort((a, b) => (a.month > b.month ? -1 : 1)),
          tradeHistoryDateLabel: dateRangeLabel,
          tradeHistoryUsedFallback: true,
        };
      }
    }

    return {
      tradeHistory: [] as ReturnType<typeof getCompanyTradeHistory>,
      tradeHistoryDateLabel: dateRangeLabel,
      tradeHistoryUsedFallback: false,
    };
  }, [
    selectedCompanyId,
    selectedHsCode.code,
    startMonth,
    endMonth,
    availableMonths,
    selectedRangeMonths,
    selectedCompanySummary,
    selectedCompany,
    selectedCountry,
    dateRangeLabel,
  ]);

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countryRows;
    const term = countrySearch.toLowerCase();
    return countryRows.filter(
      (row) => row.name.toLowerCase().includes(term) || row.code.toLowerCase().includes(term),
    );
  }, [countryRows, countrySearch]);

  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companySummaries;
    const term = companySearch.toLowerCase();
    return companySummaries.filter(
      (row) => row.name.toLowerCase().includes(term) || row.id.toLowerCase().includes(term),
    );
  }, [companySummaries, companySearch]);

  const sortedCountries = useMemo(() => {
    const direction = countrySortDirection === "asc" ? 1 : -1;
    const getValue = (row: typeof countryRows[number]) => {
      switch (countrySortKey) {
        case "country":
          return row.name;
        case "trend":
          return row.changePct;
        case "importers":
          return row.importersCount;
        case "metric":
        default:
          return row.metricTotal;
      }
    };
    return [...filteredCountries].sort((a, b) => {
      const aValue = getValue(a);
      const bValue = getValue(b);
      if (typeof aValue === "string" && typeof bValue === "string") {
        return aValue.localeCompare(bValue) * direction;
      }
      return ((aValue as number) - (bValue as number)) * direction;
    });
  }, [filteredCountries, countrySortDirection, countrySortKey]);

  const sortedCompanies = useMemo(() => {
    const direction = companySortDirection === "asc" ? 1 : -1;
    const getValue = (row: typeof companySummaries[number]) => {
      switch (companySortKey) {
        case "company":
          return row.name;
        case "buyerType":
          return row.buyerType ?? "";
        case "frequency":
          return row.frequency;
        case "trend":
          return row.changePct;
        case "lastActive":
          return row.lastActiveDate ?? "";
        case "metric":
        default:
          return row.metricTotal;
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
  }, [filteredCompanies, companySortDirection, companySortKey]);

  const handleCountrySort = (key: string) => {
    setCountrySortDirection((prev) =>
      countrySortKey === key ? (prev === "asc" ? "desc" : "asc") : "desc",
    );
    setCountrySortKey(key);
  };

  const handleCompanySort = (key: string) => {
    setCompanySortDirection((prev) =>
      companySortKey === key ? (prev === "asc" ? "desc" : "asc") : "desc",
    );
    setCompanySortKey(key);
  };

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

  const renderTrend = (trend: "up" | "down" | "neutral", changePct: number) => {
    const arrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
    const color =
      trend === "up"
        ? "text-success"
        : trend === "down"
          ? "text-destructive"
          : "text-muted-foreground";
    return (
      <div className={cn("flex items-center justify-center gap-1 font-medium", color)}>
        <span>{arrow}</span>
        <span>{Math.abs(changePct).toFixed(1)}%</span>
      </div>
    );
  };

  const globalTotal = countryRows.reduce((sum, row) => sum + row.metricTotal, 0);

  const countryColumns = [
    {
      key: "country",
      header: "Country",
      sortable: true,
      render: (item: typeof countryRows[number]) => (
        <div className="flex items-center gap-3">
          <span className="text-xl">{item.flag}</span>
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">{item.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: "metric",
      header: metricLabel,
      sortable: true,
      align: "right" as const,
      render: (item: typeof countryRows[number]) => (
        <span className="font-medium">{formatMetric(item.metricTotal)}</span>
      ),
    },
    {
      key: "trend",
      header: "Growth",
      sortable: true,
      align: "center" as const,
      render: (item: typeof countryRows[number]) => renderTrend(item.trend, item.changePct),
    },
    {
      key: "importers",
      header: "# Importers",
      sortable: true,
      align: "right" as const,
      render: (item: typeof countryRows[number]) => (
        <span>{formatNumber(item.importersCount)}</span>
      ),
    },
    {
      key: "action",
      header: "",
      width: "120px",
      render: (item: typeof countryRows[number]) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 text-primary hover:text-primary"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleSelectCountry(item.code);
          }}
        >
          Focus
          <ChevronRight className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  const companyColumns = [
    {
      key: "company",
      header: "Company",
      sortable: true,
      render: (item: typeof companySummaries[number]) => (
        <div className="flex items-center gap-3">
          <span className="text-xl">{getFlagEmoji(item.countryCode)}</span>
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">{item.id}</p>
          </div>
        </div>
      ),
    },
    {
      key: "buyerType",
      header: "Buyer Type",
      sortable: true,
      render: (item: typeof companySummaries[number]) => (
        <span>{item.buyerType ?? "—"}</span>
      ),
    },
    {
      key: "metric",
      header: `Estimated ${metricShortLabel}`,
      sortable: true,
      align: "right" as const,
      render: (item: typeof companySummaries[number]) => (
        <span className="font-medium">{formatMetric(item.metricTotal)}</span>
      ),
    },
    {
      key: "frequency",
      header: "Frequency",
      sortable: true,
      align: "right" as const,
      render: (item: typeof companySummaries[number]) => (
        <span>{item.frequency} mo</span>
      ),
    },
    {
      key: "trend",
      header: "Trend",
      sortable: true,
      align: "center" as const,
      render: (item: typeof companySummaries[number]) => renderTrend(item.trend, item.changePct),
    },
    {
      key: "lastActive",
      header: "Last Active",
      sortable: true,
      align: "right" as const,
      render: (item: typeof companySummaries[number]) => (
        <span>{item.lastActiveDate ? formatMonthLabel(item.lastActiveDate.slice(0, 7)) : "—"}</span>
      ),
    },
    {
      key: "action",
      header: "",
      width: "140px",
      render: (item: typeof companySummaries[number]) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1 text-primary hover:text-primary"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setSelectedCompanyId(item.id);
            setIsCompanyProfileOpen(true);
          }}
        >
          View Profile
          <ChevronRight className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Market Intelligence"
        subtitle="Explore global trade data and market opportunities"
        showSearch={false}
      />

      <div className="flex-1 overflow-auto p-4 pb-6 md:p-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="inline-flex w-full rounded-2xl border border-border/70 bg-card/80 p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] backdrop-blur">
            {marketSectionTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "min-w-[148px] rounded-xl px-4 py-2.5 text-sm font-medium transition sm:min-w-[176px]",
                    isActive
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === "market-analysis" ? (
          <div className="mt-6">
            <MarketAnalysisTab selectedProduct={selectedHsCode.product} dateRangeLabel={dateRangeLabel} />
          </div>
        ) : (
          <div className="mt-6 space-y-6">
        {/* Filters */}
        <div className="rounded-2xl border bg-card/90 p-4 shadow-sm md:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_auto] lg:items-end">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Product</label>
              <Select
                value={selectedHsCode.code}
                onValueChange={(value) => {
                  const hs = getHsCodeByCode(value);
                  if (hs) setSelectedHsCode(hs);
                }}
              >
                <SelectTrigger className="w-full rounded-xl bg-background">
                  <SelectValue>
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="truncate font-medium">{selectedHsCode.product}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {hsCodes.map((hs) => (
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

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Range</label>
              <div className="grid grid-cols-3 rounded-xl border bg-background p-1">
                {rangeOptions.map((option) => {
                  const isActive = selectedRange === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setSelectedRange(option.key)}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-foreground text-background shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-secondary/70 px-4 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{selectedHsCode.product}</span>
            <span className="mx-1">•</span>
            <span>{countryRows.length} countries</span>
            <span className="mx-1">•</span>
            <span>{dateRangeLabel || "—"}</span>
            <span className="mx-1">•</span>
            <span className="font-medium text-foreground">{formatMetric(globalTotal)}</span>
          </div>
        </div>

        {/* Product Information Panel removed for simplified layout */}

        {/* World Map */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <div className="p-4 border-b bg-muted/30 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-semibold">Global Import Volume</h2>
              <p className="text-sm text-muted-foreground">Country-level distribution with customer markers</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-muted-foreground">{metricLabel}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Low</span>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-3 rounded bg-data-200" />
                  <div className="w-4 h-3 rounded bg-data-300" />
                  <div className="w-4 h-3 rounded bg-data-500" />
                  <div className="w-4 h-3 rounded bg-data-600" />
                  <div className="w-4 h-3 rounded bg-data-700" />
                </div>
                <span className="text-muted-foreground">High</span>
              </div>
            </div>
          </div>
          <section className="w-full p-3">
            <div className="mx-auto w-full max-w-7xl">
              <div className="relative aspect-[2/1] w-full">
                {isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ErrorBoundary
                    fallback={
                      <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-sm text-muted-foreground">
                        Map is temporarily unavailable. Please refresh the page.
                      </div>
                    }
                  >
                    <WorldMap
                      data={countryRows.map((row) => ({
                        code: row.code,
                        name: row.name,
                        flag: row.flag,
                        metricValue: row.metricTotal,
                        share: row.share,
                        importersCount: row.importersCount,
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
            </div>
          </section>

        </div>

        {/* Table Section */}
        <div ref={tableRef}>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="space-y-1">
              <h2 className="font-semibold">
                {selectedCountry
                  ? `Company List for ${selectedCountry.name}`
                  : "Top Importing Countries"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {selectedCountry
                  ? "Click a company to view its profile and trade history"
                  : "Click on a country to drill into company-level importers"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedCountry && (
                <Badge variant="secondary" className="gap-2">
                  Selected: {selectedCountry.name} ({selectedCountry.code})
                  <button type="button" onClick={handleResetView} className="text-xs hover:underline">
                    × Clear
                  </button>
                </Badge>
              )}
              {selectedCountry && (
                <Button type="button" variant="outline" size="sm" onClick={handleResetView}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset view
                </Button>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={selectedCountry ? "Search companies..." : "Search countries..."}
                  className="pl-9 w-full sm:w-64 bg-card"
                  value={selectedCountry ? companySearch : countrySearch}
                  onChange={(event) =>
                    selectedCountry
                      ? setCompanySearch(event.target.value)
                      : setCountrySearch(event.target.value)
                  }
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <DataTable
              columns={selectedCountry ? companyColumns : countryColumns}
              data={selectedCountry ? sortedCompanies : sortedCountries}
              sortKey={selectedCountry ? companySortKey : countrySortKey}
              sortDirection={selectedCountry ? companySortDirection : countrySortDirection}
              onSort={selectedCountry ? handleCompanySort : handleCountrySort}
              onRowClick={(item) => {
                if (selectedCountry) {
                  setSelectedCompanyId((item as typeof companySummaries[number]).id);
                  setIsCompanyProfileOpen(true);
                } else {
                  handleSelectCountry((item as typeof countryRows[number]).code);
                }
              }}
              emptyMessage={selectedCountry ? "No companies found" : "No countries found"}
            />
          )}
        </div>
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
        isLoading={isLoading}
      />
    </div>
  );
}
