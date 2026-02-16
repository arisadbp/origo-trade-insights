import {
  Globe,
  Building2,
  Upload,
  Settings,
  LayoutDashboard,
  Package,
  Boxes,
  FileText,
  TrendingUp,
  Users,
  Database,
  Shield,
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
    title: "THAI ROONG RUANG INDUSTRY CO., LTD.",
    icon: Building2,
    href: "/my-company",
    description: "Executive dashboard",
    children: [
      { title: "Trade Performance", href: "/my-company/performance", icon: TrendingUp },
      { title: "Orders & Shipments", href: "/my-company/orders", icon: Package },
      { title: "Inventory", href: "/my-company/inventory", icon: Boxes },
      { title: "Invoices & Payments", href: "/my-company/invoices", icon: FileText },
    ],
  },
  {
    title: "Admin Control",
    icon: Upload,
    href: "/upload",
    description: "Upload data files",
  },
];

export const adminNavItems: NavItem[] = [
  {
    title: "Back Office",
    icon: Settings,
    href: "/admin",
    description: "Customer and system management",
    children: [
      { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      { title: "Admin Backoffice", href: "/admin/backoffice", icon: Shield },
      { title: "Customer Management", href: "/admin/customers", icon: Building2 },
      { title: "User Management", href: "/admin/users", icon: Users },
      { title: "Data Management", href: "/admin/data", icon: Database },
    ],
  },
];
