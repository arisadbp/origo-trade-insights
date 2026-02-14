import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

export type TradePerformanceDatum = {
  month: string;
  inventory: number;
  sales: number;
  capacity?: number | null;
};

interface TradePerformanceChartProps {
  data: TradePerformanceDatum[];
  unitLabel?: string;
  hideCapacity?: boolean;
}

const colors = {
  inventory: "#9aa0a6",
  sales: "#ffbd59",
  capacity: "#5f6368",
  over: "rgba(220, 38, 38, 0.18)",
  under: "rgba(148, 163, 184, 0.18)",
};

const AXIS_TICK = { fontSize: 11 };

const formatMonthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, 1);
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
};

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

const gapLabel = (value: number, unit: string) => {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatNumber(Math.abs(value))} ${unit}`;
};

const LegendItem = ({ label, swatchClass, dashed }: { label: string; swatchClass: string; dashed?: boolean }) => (
  <div className="flex items-center gap-2 text-sm">
    <span
      className={cn(
        "inline-flex h-2.5 w-6 rounded-full",
        dashed ? "border border-dashed" : "",
        swatchClass,
      )}
    />
    <span>{label}</span>
  </div>
);

export function TradePerformanceChart({ data, unitLabel = "Units", hideCapacity = false }: TradePerformanceChartProps) {
  const [visibleSeries, setVisibleSeries] = useState({
    inventory: true,
    sales: true,
    capacity: !hideCapacity,
  });

  useEffect(() => {
    if (hideCapacity) {
      setVisibleSeries((prev) => ({ ...prev, capacity: false }));
    }
  }, [hideCapacity]);

  const showGapRanges = visibleSeries.inventory && visibleSeries.sales;

  const toggleSeries = (key: "inventory" | "sales" | "capacity") => {
    setVisibleSeries((prev) => {
      const currentActiveCount = Object.values(prev).filter(Boolean).length;
      if (prev[key] && currentActiveCount === 1) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  };

  const chartData = useMemo(
    () =>
      data.map((item) => {
        const gapInv = item.sales - item.inventory;
        const capacity = item.capacity ?? 0;
        const gapCap = item.sales - capacity;
        return {
          ...item,
          capacity,
          monthLabel: formatMonthLabel(item.month),
          rangeOver: item.sales > item.inventory ? [item.inventory, item.sales] : [null, null],
          rangeUnder: item.sales < item.inventory ? [item.sales, item.inventory] : [null, null],
          gapInv,
          gapCap,
        };
      }),
    [data],
  );

  const yAxisDomain = useMemo<[number, number]>(() => {
    if (!chartData.length) return [0, 100];

    const values = chartData.flatMap((item) => {
      const points: number[] = [];
      if (visibleSeries.inventory) points.push(item.inventory);
      if (visibleSeries.sales) points.push(item.sales);
      if (visibleSeries.capacity) points.push(item.capacity);
      return points;
    });
    if (!values.length) return [0, 100];
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const span = Math.max(1, maxValue - minValue);

    const basePadding = Math.max(24, span * 0.16);
    const roughMin = Math.max(0, minValue - basePadding);
    const roughMax = maxValue + basePadding;

    const step =
      span > 2000 ? 200 : span > 1000 ? 100 : span > 500 ? 50 : span > 200 ? 25 : 10;

    const minDomain = Math.floor(roughMin / step) * step;
    const maxDomain = Math.ceil(roughMax / step) * step;

    if (maxDomain <= minDomain) {
      return [minDomain, minDomain + step * 4];
    }
    return [minDomain, maxDomain];
  }, [chartData, visibleSeries]);

  return (
    <div className="space-y-4">
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 14, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="monthLabel" tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis
              domain={yAxisDomain}
              tickCount={5}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={96}
              tickFormatter={(value) => formatNumber(value)}
            />

            {showGapRanges && (
              <Area
                dataKey="rangeUnder"
                isRange
                stroke="none"
                fill={colors.under}
                fillOpacity={1}
                activeDot={false}
                connectNulls={false}
              />
            )}
            {showGapRanges && (
              <Area
                dataKey="rangeOver"
                isRange
                stroke="none"
                fill={colors.over}
                fillOpacity={1}
                activeDot={false}
                connectNulls={false}
              />
            )}

            {visibleSeries.inventory && (
              <Line
                type="monotone"
                dataKey="inventory"
                stroke={colors.inventory}
                strokeWidth={2}
                dot={false}
              />
            )}
            {visibleSeries.sales && (
              <Line
                type="monotone"
                dataKey="sales"
                stroke={colors.sales}
                strokeWidth={2.5}
                dot={false}
              />
            )}
            {visibleSeries.capacity && (
              <Line
                type="monotone"
                dataKey="capacity"
                stroke={colors.capacity}
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
              />
            )}

            <Tooltip
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0]?.payload as typeof chartData[number];
                if (!item) return null;
                return (
                  <div className="rounded-lg border bg-card p-3 shadow-sm text-sm">
                    <div className="font-medium text-foreground mb-2">{item.monthLabel}</div>
                      <div className="space-y-1 text-muted-foreground">
                        {visibleSeries.inventory && (
                          <div className="flex items-center justify-between gap-3">
                            <span>Inventory</span>
                            <span className="text-foreground">{formatNumber(item.inventory)} {unitLabel}</span>
                          </div>
                        )}
                        {visibleSeries.sales && (
                          <div className="flex items-center justify-between gap-3">
                            <span>Sales</span>
                            <span className="text-foreground">{formatNumber(item.sales)} {unitLabel}</span>
                          </div>
                        )}
                        {visibleSeries.capacity && (
                          <div className="flex items-center justify-between gap-3">
                            <span>Capacity</span>
                            <span className="text-foreground">{formatNumber(item.capacity)} {unitLabel}</span>
                          </div>
                        )}
                        {showGapRanges && (
                          <div className="border-t pt-2 mt-2 flex items-center justify-between gap-3">
                            <span>Gap vs Inventory</span>
                            <span className="text-foreground">{gapLabel(item.gapInv, unitLabel)}</span>
                          </div>
                        )}
                        {visibleSeries.sales && visibleSeries.capacity && (
                          <div className="flex items-center justify-between gap-3">
                            <span>Gap vs Capacity</span>
                            <span className="text-foreground">{gapLabel(item.gapCap, unitLabel)}</span>
                          </div>
                        )}
                    </div>
                  </div>
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => toggleSeries("inventory")}
          className={cn(
            "flex items-center gap-2 text-sm transition",
            visibleSeries.inventory ? "text-foreground" : "text-muted-foreground/60",
          )}
          aria-pressed={visibleSeries.inventory}
        >
          <LegendItem label="Inventory" swatchClass="bg-[#9aa0a6]" />
        </button>
        <button
          type="button"
          onClick={() => toggleSeries("sales")}
          className={cn(
            "flex items-center gap-2 text-sm transition",
            visibleSeries.sales ? "text-foreground" : "text-muted-foreground/60",
          )}
          aria-pressed={visibleSeries.sales}
        >
          <LegendItem label="Actual Sales" swatchClass="bg-[#ffbd59]" />
        </button>
        {!hideCapacity && (
          <button
            type="button"
            onClick={() => toggleSeries("capacity")}
            className={cn(
              "flex items-center gap-2 text-sm transition",
              visibleSeries.capacity ? "text-foreground" : "text-muted-foreground/60",
            )}
            aria-pressed={visibleSeries.capacity}
          >
            <LegendItem label="Production Capacity" swatchClass="border-[#5f6368]" dashed />
          </button>
        )}
        {showGapRanges && <LegendItem label="Gap Red: Sales > Inventory" swatchClass="bg-[rgba(220,38,38,0.3)]" />}
        {showGapRanges && <LegendItem label="Gap Neutral: Sales < Inventory" swatchClass="bg-[rgba(148,163,184,0.3)]" />}
      </div>
    </div>
  );
}
