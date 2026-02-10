import { cn } from "@/lib/utils";
import { AlertTriangle, Clock, Eye, ChevronRight } from "lucide-react";

type Severity = "urgent" | "warning" | "watch";

interface AttentionItemProps {
  severity: Severity;
  title: string;
  description: string;
  action?: string;
  onClick?: () => void;
  className?: string;
}

const severityConfig = {
  urgent: {
    icon: AlertTriangle,
    bg: "bg-red-50",
    border: "border-l-red-500",
    iconColor: "text-red-500",
    title: "text-red-900",
  },
  warning: {
    icon: Clock,
    bg: "bg-amber-50",
    border: "border-l-amber-500",
    iconColor: "text-amber-500",
    title: "text-amber-900",
  },
  watch: {
    icon: Eye,
    bg: "bg-slate-50",
    border: "border-l-slate-400",
    iconColor: "text-slate-500",
    title: "text-slate-900",
  },
};

export function AttentionItem({
  severity,
  title,
  description,
  action,
  onClick,
  className,
}: AttentionItemProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-r-lg border-l-4 transition-all",
        config.bg,
        config.border,
        onClick && "cursor-pointer hover:shadow-sm",
        className
      )}
      onClick={onClick}
    >
      <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", config.iconColor)} />
      <div className="flex-1 min-w-0">
        <p className={cn("font-medium text-sm", config.title)}>{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      {(action || onClick) && (
        <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
          {action && <span>{action}</span>}
          <ChevronRight className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
