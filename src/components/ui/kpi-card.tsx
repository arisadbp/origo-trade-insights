import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  icon?: ReactNode;
  variant?: "default" | "warning" | "success" | "danger";
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  trend,
  icon,
  variant = "default",
  className,
}: KPICardProps) {
  const trendColors = {
    up: "text-success",
    down: "text-destructive",
    neutral: "text-muted-foreground",
  };

  const TrendIcon = trend?.direction === "up" ? TrendingUp : trend?.direction === "down" ? TrendingDown : Minus;

  const variantStyles = {
    default: "border-border",
    warning: "border-l-4 border-l-warning border-t border-r border-b border-border",
    success: "border-l-4 border-l-success border-t border-r border-b border-border",
    danger: "border-l-4 border-l-destructive border-t border-r border-b border-border",
  };

  return (
    <div
      className={cn(
        "kpi-card animate-fade-in",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="p-2 rounded-lg bg-secondary">
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
          <TrendIcon className={cn("h-4 w-4", trendColors[trend.direction])} />
          <span className={cn("text-sm font-medium", trendColors[trend.direction])}>
            {trend.value > 0 ? "+" : ""}{trend.value}%
          </span>
          {trend.label && (
            <span className="text-xs text-muted-foreground">{trend.label}</span>
          )}
        </div>
      )}
    </div>
  );
}
