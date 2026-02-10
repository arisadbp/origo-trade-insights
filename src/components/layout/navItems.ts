import {
  Globe,
  Building2,
  Upload,
  Settings,
  LayoutDashboard,
  Package,
  FileText,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavChildItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export interface NavItem {
  title: string;
  icon: LucideIcon;
  href: string;
  description: string;
  children?: NavChildItem[];
}

export const mainNavItems: NavItem[] = [
  {
    title: "Market Intelligence",
    icon: Globe,
    href: "/market-intelligence",
    description: "Explore global market data",
  },
  {
    title: "My Company",
    icon: Building2,
    href: "/my-company",
    description: "Executive dashboard",
    children: [
      { title: "Overview", href: "/my-company", icon: LayoutDashboard },
      { title: "Orders & Shipments", href: "/my-company/orders", icon: Package },
      { title: "Invoices & Payments", href: "/my-company/invoices", icon: FileText },
      { title: "Trade Performance", href: "/my-company/performance", icon: TrendingUp },
    ],
  },
  {
    title: "Admin Center",
    icon: Upload,
    href: "/upload",
    description: "Upload data files",
  },
];

export const adminNavItems: NavItem[] = [
  {
    title: "Admin",
    icon: Settings,
    href: "/admin",
    description: "System administration",
    children: [
      { title: "User Management", href: "/admin/users", icon: Users },
      { title: "Data Management", href: "/admin/data", icon: Settings },
    ],
  },
];
