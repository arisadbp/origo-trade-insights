import { cn } from "@/lib/utils";
import { 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Minus
} from "lucide-react";

type StatusType = 
  | "success" 
  | "warning" 
  | "error" 
  | "neutral" 
  | "pending"
  | "growing"
  | "declining"
  | "stable";

interface StatusBadgeProps {
  status: StatusType;
  label: string;
  showIcon?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const statusConfig = {
  success: {
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  warning: {
    icon: AlertCircle,
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  error: {
    icon: XCircle,
    className: "bg-red-50 text-red-700 border-red-200",
  },
  neutral: {
    icon: Minus,
    className: "bg-slate-50 text-slate-600 border-slate-200",
  },
  pending: {
    icon: Clock,
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  growing: {
    icon: TrendingUp,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  declining: {
    icon: TrendingDown,
    className: "bg-red-50 text-red-700 border-red-200",
  },
  stable: {
    icon: Minus,
    className: "bg-slate-50 text-slate-600 border-slate-200",
  },
};

export function StatusBadge({ 
  status, 
  label, 
  showIcon = true, 
  size = "sm",
  className 
}: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const sizeStyles = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        config.className,
        sizeStyles[size],
        className
      )}
    >
      {showIcon && <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-4 w-4")} />}
      {label}
    </span>
  );
}
