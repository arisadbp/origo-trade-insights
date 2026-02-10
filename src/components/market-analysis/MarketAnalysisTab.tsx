import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, Info } from "lucide-react";
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

const phaseRailTone: Record<PhaseKey, string> = {
  growth: "border-l-[#ff6b6b] bg-[#fbf4f7]",
  maturity: "border-l-[#ffb020] bg-[#f9f4ec]",
  adjustment: "border-l-[#4cd137] bg-[#f4f8ef]",
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

const getPhaseNote = (snapshot: MarketAnalysisSnapshot, phaseKey: PhaseKey) => {
  if (phaseKey === "growth") return snapshot.dataset.notes.growthDefinition;
  if (phaseKey === "maturity") return snapshot.dataset.notes.maturityDefinition;
  return snapshot.dataset.notes.adjustmentDefinition;
};

const getPhaseTitle = (phaseKey: PhaseKey) => {
  if (phaseKey === "growth") return "GrowthPhase";
  if (phaseKey === "maturity") return "MaturityPhase";
  return "AdjustmentPhase";
};

const renderPhaseNote = (_note: string, phaseKey: PhaseKey) => {
  if (phaseKey === "growth") {
    return (
      <p className="text-sm leading-relaxed text-[#4b5563] md:text-base">
        The target product&apos;s trade value/volume quarterly{" "}
        <span className="font-medium text-[#ff6b6b]">CAGR is high</span> over the past three years
      </p>
    );
  }
  if (phaseKey === "maturity") {
    return (
      <p className="text-sm leading-relaxed text-[#4b5563] md:text-base">
        The target product&apos;s trade value/volume quarterly{" "}
        <span className="font-medium text-[#f59e0b]">CAGR has been stable</span> over the past three years
      </p>
    );
  }
  return (
    <p className="text-sm leading-relaxed text-[#4b5563] md:text-base">
      The target product&apos;s trade value/volume quarterly{" "}
      <span className="font-medium text-[#059669]">CAGR is low</span> over the past three years
    </p>
  );
};

const CountryTrendCard = ({ country, phaseKey }: { country: PhaseCountry; phaseKey: PhaseKey }) => {
  const cagr = country.cagrPercent;
  const positive = (cagr ?? 0) >= 0;
  const gradientId = `${phaseKey}-${country.countryName.replace(/\s+/g, "-").toLowerCase()}`;
  const textTone =
    phaseKey === "growth" ? "text-[#ef4444]" : phaseKey === "adjustment" ? "text-[#059669]" : "text-[#4b5563]";

  return (
    <article className="min-w-0 rounded-xl border border-border/50 bg-white/70 p-3">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <h4 className="min-w-0 break-words text-base font-medium leading-tight text-[#2f3640] md:text-lg">
          {country.countryName}
        </h4>
        <div
          className={cn(
            "shrink-0 whitespace-nowrap text-base font-semibold leading-none md:text-lg",
            textTone,
          )}
        >
          {cagr === null ? (
            <span className="text-sm text-muted-foreground">N/A</span>
          ) : (
            <>
              <span>{Math.abs(cagr).toFixed(1)}%</span>
              {positive ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
            </>
          )}
        </div>
      </div>

      <div className="h-20 w-full">
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
          <div className="flex h-full items-center justify-center rounded-xl bg-muted/50 text-xs text-muted-foreground">
            No trend data
          </div>
        )}
      </div>
    </article>
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

  const growthPhase = phaseMap.get("growth");
  const maturityPhase = phaseMap.get("maturity");
  const adjustmentPhase = phaseMap.get("adjustment");

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5">
      <header className="rounded-3xl border border-border/70 bg-card p-5 md:p-6">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">Market Analysis</h2>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          See how this market has evolved over time and where it stands today.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{selectedProduct}</span>
          <span>|</span>
          <span>{dateRangeLabel || "Time range not available"}</span>
        </div>
      </header>

      {loading ? (
        <div className="rounded-3xl border border-border/70 bg-card p-6 text-sm text-muted-foreground">
          Preparing market lifecycle charts...
        </div>
      ) : error ? (
        <div className="rounded-3xl border border-destructive/30 bg-card p-6 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <>
          <section className="overflow-hidden rounded-3xl border border-border/70 bg-[#f5f6f7] p-0">
            <div className="grid gap-0 lg:grid-cols-[300px_1fr] xl:grid-cols-[320px_1fr]">
              <aside className="border-r border-border/60">
                {(["growth", "maturity", "adjustment"] as PhaseKey[]).map((phaseKey) => {
                  const phase = phaseMap.get(phaseKey);
                  const note = getPhaseNote(snapshot, phaseKey);
                  return (
                    <div
                      key={phaseKey}
                      className={cn(
                        "border-l-[4px] border-b border-b-border/50 px-4 py-5",
                        phaseRailTone[phaseKey],
                      )}
                    >
                      <div className="flex items-center gap-1">
                        <h3 className="text-xl font-semibold tracking-tight text-[#1f2937] md:text-2xl lg:text-[30px]">
                          {getPhaseTitle(phaseKey)}
                        </h3>
                        <span className="text-xl font-semibold text-[#3b82f6] md:text-2xl lg:text-[30px]">
                          {phase?.countriesCount ?? 0}
                        </span>
                        <Info className="h-4 w-4 text-slate-400" />
                      </div>
                      <div className="mt-3">{renderPhaseNote(note, phaseKey)}</div>
                    </div>
                  );
                })}
                <div className="border-l-[4px] border-l-[#d1d5db] bg-[#eceef1] px-4 py-4">
                  <div className="flex items-center gap-1">
                    <h3 className="text-xl font-semibold tracking-tight text-[#374151] md:text-2xl lg:text-[30px]">
                      Other countries
                    </h3>
                    <span className="text-xl font-semibold text-[#3b82f6] md:text-2xl lg:text-[30px]">
                      {snapshot?.otherCountries.count ?? 0}
                    </span>
                    <Info className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </aside>

              <div className="p-5 md:p-6">
                <div className="grid gap-6">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {(growthPhase?.countries ?? []).map((country) => (
                      <CountryTrendCard key={`growth-${country.countryName}`} country={country} phaseKey="growth" />
                    ))}
                  </div>

                  <div className="flex min-h-36 items-center justify-center">
                    {maturityPhase?.countries.length ? (
                      <div className="grid w-full gap-6 md:grid-cols-2">
                        {maturityPhase.countries.map((country) => (
                          <CountryTrendCard
                            key={`maturity-${country.countryName}`}
                            country={country}
                            phaseKey="maturity"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center text-slate-400">
                        <BarChart3 className="mb-2 h-10 w-10 opacity-40" />
                        <p className="text-xl md:text-[28px]">No Data</p>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {(adjustmentPhase?.countries ?? []).map((country) => (
                      <CountryTrendCard
                        key={`adjustment-${country.countryName}`}
                        country={country}
                        phaseKey="adjustment"
                      />
                    ))}
                  </div>

                  <div className="rounded-xl border border-border/60 bg-white/65 p-3">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Other countries ({snapshot?.otherCountries.count ?? 0})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(snapshot?.otherCountries.countryNames ?? []).map((name) => (
                        <span
                          key={name}
                          className="rounded-full border border-border bg-white px-2.5 py-1 text-xs text-[#374151]"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-border/70 bg-card p-5 md:p-6">
            <h3 className="text-base font-semibold text-foreground">What this means for decisions</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {snapshot?.interpretation || "Not available"}
            </p>
          </section>
        </>
      )}
    </section>
  );
};
