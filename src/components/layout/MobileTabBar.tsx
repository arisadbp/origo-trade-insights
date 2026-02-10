import { NavLink } from "react-router-dom";
import { Globe, Building2, Package, FileText, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Focus", href: "/market-intelligence", icon: Globe },
  { label: "Company", href: "/my-company", icon: Building2 },
  { label: "Orders", href: "/my-company/orders", icon: Package },
  { label: "Invoices", href: "/my-company/invoices", icon: FileText },
  { label: "Upload", href: "/upload", icon: Upload },
];

export function MobileTabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden">
      <div className="grid h-16 grid-cols-5">
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
