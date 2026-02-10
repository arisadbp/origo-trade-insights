import { useMemo } from "react";
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
  capacity: number;
};

interface TradePerformanceChartProps {
  data: TradePerformanceDatum[];
  unitLabel?: string;
}

const colors = {
  inventory: "#9aa0a6",
  sales: "#ffbd59",
  capacity: "#5f6368",
  over: "rgba(220, 38, 38, 0.18)",
  under: "rgba(148, 163, 184, 0.18)",
};

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
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
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

export function TradePerformanceChart({ data, unitLabel = "Units" }: TradePerformanceChartProps) {
  const chartData = useMemo(
    () =>
      data.map((item) => {
        const gapInv = item.sales - item.inventory;
        const gapCap = item.sales - item.capacity;
        return {
          ...item,
          monthLabel: formatMonthLabel(item.month),
          rangeOver: item.sales > item.inventory ? [item.inventory, item.sales] : [null, null],
          rangeUnder: item.sales < item.inventory ? [item.sales, item.inventory] : [null, null],
          gapInv,
          gapCap,
        };
      }),
    [data],
  );

  return (
    <div className="space-y-4">
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={56}
              tickFormatter={(value) => formatNumber(value)}
            />

            <Area
              dataKey="rangeUnder"
              isRange
              stroke="none"
              fill={colors.under}
              fillOpacity={1}
              activeDot={false}
              connectNulls={false}
            />
            <Area
              dataKey="rangeOver"
              isRange
              stroke="none"
              fill={colors.over}
              fillOpacity={1}
              activeDot={false}
              connectNulls={false}
            />

            <Line
              type="monotone"
              dataKey="inventory"
              stroke={colors.inventory}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="sales"
              stroke={colors.sales}
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="capacity"
              stroke={colors.capacity}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
            />

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
                      <div className="flex items-center justify-between gap-3">
                        <span>Inventory</span>
                        <span className="text-foreground">{formatNumber(item.inventory)} {unitLabel}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Sales</span>
                        <span className="text-foreground">{formatNumber(item.sales)} {unitLabel}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Capacity</span>
                        <span className="text-foreground">{formatNumber(item.capacity)} {unitLabel}</span>
                      </div>
                      <div className="border-t pt-2 mt-2 flex items-center justify-between gap-3">
                        <span>Gap vs Inventory</span>
                        <span className="text-foreground">{gapLabel(item.gapInv, unitLabel)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span>Gap vs Capacity</span>
                        <span className="text-foreground">{gapLabel(item.gapCap, unitLabel)}</span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <LegendItem label="Inventory" swatchClass="bg-[#9aa0a6]" />
        <LegendItem label="Actual Sales" swatchClass="bg-[#ffbd59]" />
        <LegendItem label="Production Capacity" swatchClass="border-[#5f6368]" dashed />
        <LegendItem label="Gap Red: Sales > Inventory" swatchClass="bg-[rgba(220,38,38,0.3)]" />
        <LegendItem label="Gap Neutral: Sales < Inventory" swatchClass="bg-[rgba(148,163,184,0.3)]" />
      </div>
    </div>
  );
}
