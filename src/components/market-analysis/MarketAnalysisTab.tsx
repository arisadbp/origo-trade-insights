import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import {
  type MarketAnalysisSnapshot,
  type PhaseCountry,
  type PhaseKey,
  loadMarketAnalysisSnapshot,
} from "@/data/market-analysis/lifecycle";

interface MarketAnalysisTabProps {
  selectedProduct: string;
  dateRangeLabel: string;
}

const phaseDotTone: Record<PhaseKey, string> = {
  growth: "bg-[#ef4444]",
  maturity: "bg-[#f59e0b]",
  adjustment: "bg-[#059669]",
};

const phaseTextTone: Record<PhaseKey, string> = {
  growth: "text-[#ef4444]",
  maturity: "text-[#b45309]",
  adjustment: "text-[#047857]",
};

const phaseCardTone: Record<PhaseKey, string> = {
  growth: "border-red-100 bg-card/90",
  maturity: "border-amber-100 bg-card/90",
  adjustment: "border-emerald-100 bg-card/90",
};

const formatLargeNumber = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);

type SparkTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload?: {
      period: string;
      value: number;
    };
  }>;
};

const SparkTooltip = ({ active, payload }: SparkTooltipProps) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as { period: string; value: number } | undefined;
  if (!point) return null;
  return (
    <div className="rounded-lg border border-border/70 bg-card px-2.5 py-1.5 shadow-sm">
      <p className="text-[11px] text-muted-foreground">{point.period}</p>
      <p className="text-xs font-medium text-foreground">{formatLargeNumber(point.value)}</p>
    </div>
  );
};

const getPhaseTitle = (phaseKey: PhaseKey) => {
  if (phaseKey === "growth") return "Growth Phase";
  if (phaseKey === "maturity") return "Maturity Phase";
  return "Adjustment Phase";
};

const getPhaseSummary = (phaseKey: PhaseKey) => {
  if (phaseKey === "growth") {
    return "Quarterly CAGR has been high in the last 3 years.";
  }
  if (phaseKey === "maturity") {
    return "Quarterly CAGR has remained stable in the last 3 years.";
  }
  return "Quarterly CAGR has been low in the last 3 years.";
};

const CountryTrendCard = ({ country, phaseKey }: { country: PhaseCountry; phaseKey: PhaseKey }) => {
  const cagr = country.cagrPercent;
  const positive = (cagr ?? 0) >= 0;
  const gradientId = `${phaseKey}-${country.countryName.replace(/\s+/g, "-").toLowerCase()}`;
  const textTone = phaseTextTone[phaseKey];

  return (
    <article className="min-w-0 rounded-2xl border border-border/60 bg-background/90 p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-1.5">
        <h4 className="min-w-0 break-words text-sm font-medium leading-tight text-foreground">
          {country.countryName}
        </h4>
        <div
          className={cn(
            "shrink-0 whitespace-nowrap text-sm font-semibold leading-none",
            textTone,
          )}
        >
          {cagr === null ? (
            <span className="text-xs text-muted-foreground">N/A</span>
          ) : (
            <>
              <span>{Math.abs(cagr).toFixed(1)}%</span>
              {positive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            </>
          )}
        </div>
      </div>

      <div className="h-14 w-full md:h-[60px]">
        {country.trendSeries.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={country.trendSeries} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <Tooltip content={<SparkTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#60a5fa"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg bg-muted/50 text-[11px] text-muted-foreground">
            No trend data
          </div>
        )}
      </div>
    </article>
  );
};

const phaseKeys: PhaseKey[] = ["growth", "maturity", "adjustment"];

const getPhaseGridClassName = (phaseKey: PhaseKey) => {
  if (phaseKey === "maturity") return "grid gap-3 sm:grid-cols-2 xl:grid-cols-2";
  return "grid gap-3 sm:grid-cols-2 xl:grid-cols-3";
};

const renderPhaseCountries = (countries: PhaseCountry[] | undefined, phaseKey: PhaseKey) => {
  if (countries?.length) {
    return (
      <div className={getPhaseGridClassName(phaseKey)}>
        {countries.map((country) => (
          <CountryTrendCard key={`${phaseKey}-${country.countryName}`} country={country} phaseKey={phaseKey} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex min-h-20 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-background/70">
      <div className="flex flex-col items-center text-slate-400">
        <BarChart3 className="mb-1 h-6 w-6 opacity-40" />
        <p className="text-sm">No data</p>
      </div>
    </div>
  );
};

export const MarketAnalysisTab = ({ selectedProduct, dateRangeLabel }: MarketAnalysisTabProps) => {
  const [snapshot, setSnapshot] = useState<MarketAnalysisSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadMarketAnalysisSnapshot()
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : "Unable to load market analysis data";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProduct, dateRangeLabel]);

  const phaseMap = useMemo(() => {
    const map = new Map<PhaseKey, (typeof snapshot)["phases"][number]>();
    snapshot?.phases.forEach((phase) => map.set(phase.phaseKey, phase));
    return map;
  }, [snapshot]);

  return (
    <section className="mx-auto w-full max-w-7xl space-y-4">
      <header className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur md:p-5">
        <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">Market Analysis</h2>
        <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
          A minimal lifecycle view of where demand is growing, stable, and adjusting.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-border/70 bg-background/90 px-3 py-1 text-xs font-medium text-foreground">
            {selectedProduct}
          </span>
          <span className="rounded-full border border-border/70 bg-background/90 px-3 py-1 text-xs text-muted-foreground">
            {dateRangeLabel || "Time range not available"}
          </span>
        </div>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-border/60 bg-card/90 p-5 text-sm text-muted-foreground shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          Preparing market lifecycle charts...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-card/90 p-5 text-sm text-destructive shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          {error}
        </div>
      ) : !snapshot ? (
        <div className="rounded-2xl border border-border/60 bg-card/90 p-5 text-sm text-muted-foreground shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          Market data is not available yet.
        </div>
      ) : (
        <>
          <section className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {phaseKeys.map((phaseKey) => {
              const phase = phaseMap.get(phaseKey);
              return (
                <article
                  key={`summary-${phaseKey}`}
                  className={cn("rounded-2xl border p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]", phaseCardTone[phaseKey])}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", phaseDotTone[phaseKey])} />
                      <h3 className="text-sm font-semibold text-foreground">{getPhaseTitle(phaseKey)}</h3>
                    </div>
                    <span className="text-lg font-semibold tracking-tight text-foreground">
                      {phase?.countriesCount ?? 0}
                    </span>
                  </div>
                  <p className={cn("mt-1.5 text-xs leading-relaxed", phaseTextTone[phaseKey])}>
                    {getPhaseSummary(phaseKey)}
                  </p>
                </article>
              );
            })}
            <article className="rounded-2xl border border-border/60 bg-card/90 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Other countries</h3>
                <span className="text-lg font-semibold tracking-tight text-foreground">
                  {snapshot.otherCountries.count}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Countries outside the 3 main lifecycle groups.</p>
            </article>
          </section>

          <section className="space-y-3">
            {phaseKeys.map((phaseKey) => {
              const phase = phaseMap.get(phaseKey);
              return (
                <article
                  key={`phase-${phaseKey}`}
                  className="rounded-2xl border border-border/60 bg-card/90 p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_24px_rgba(15,23,42,0.04)] md:p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-2.5 w-2.5 rounded-full", phaseDotTone[phaseKey])} />
                      <h3 className="text-base font-semibold text-foreground">{getPhaseTitle(phaseKey)}</h3>
                      <span className="rounded-full border border-border/60 bg-background/90 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {phase?.countriesCount ?? 0} countries
                      </span>
                    </div>
                    <p className={cn("text-xs font-medium", phaseTextTone[phaseKey])}>{getPhaseSummary(phaseKey)}</p>
                  </div>
                  {renderPhaseCountries(phase?.countries, phaseKey)}
                </article>
              );
            })}
          </section>

          <section className="rounded-2xl border border-border/60 bg-card/90 p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_24px_rgba(15,23,42,0.04)] md:p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Other countries</h3>
              <span className="text-xs text-muted-foreground">{snapshot.otherCountries.count} total</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(snapshot.otherCountries.countryNames ?? []).map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-border/70 bg-background/90 px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {name}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card/90 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Decision Signal</h3>
              <span className="rounded-full border border-border/60 bg-background/90 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                Current phase: {getPhaseTitle(snapshot.currentPhase)}
              </span>
              <span className="rounded-full border border-border/60 bg-background/90 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                Demand: {snapshot.demandDirection}
              </span>
              <span className="rounded-full border border-border/60 bg-background/90 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                Stability: {snapshot.stability}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {snapshot.interpretation || "Not available"}
            </p>
          </section>
        </>
      )}
    </section>
  );
};
