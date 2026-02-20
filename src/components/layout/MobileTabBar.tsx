import { NavLink } from "react-router-dom";
import {
  Globe,
  Building2,
  Package,
  FileText,
  Upload,
  LayoutDashboard,
  Users,
  Database,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const customerNavItems = [
  { label: "Focus", href: "/market-intelligence", icon: Globe },
  { label: "TRR", href: "/my-company", icon: Building2 },
  { label: "Orders", href: "/my-company/orders", icon: Package },
  { label: "AI", href: "/ai-agent", icon: Bot },
  { label: "Invoices", href: "/my-company/invoices", icon: FileText },
  { label: "Upload", href: "/upload", icon: Upload },
];

const backOfficeNavItems = [
  { label: "Dash", href: "/admin", icon: LayoutDashboard },
  { label: "Clients", href: "/admin/customers", icon: Building2 },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Data", href: "/admin/data", icon: Database },
];

export function MobileTabBar() {
  const { accountType } = useAuth();
  const navItems = accountType === "admin" ? backOfficeNavItems : customerNavItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden">
      <div
        className="grid h-16"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
