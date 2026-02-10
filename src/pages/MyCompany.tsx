import { 
  DollarSign, 
  FileText, 
  Clock, 
  Ship, 
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  Package
} from "lucide-react";
import { KPICard } from "@/components/ui/kpi-card";
import { AttentionItem } from "@/components/ui/attention-item";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/layout/TopBar";
import { TradePerformanceChart } from "@/components/charts/TradePerformanceChart";
import { tradePerformanceMock } from "@/data/tradePerformanceMock";

// Mock data for attention items
const attentionItems = [
  {
    severity: "urgent" as const,
    title: "3 Overdue Invoices",
    description: "Total outstanding: $45,200 — Oldest: 32 days past due",
    action: "Review",
  },
  {
    severity: "urgent" as const,
    title: "Payment Missing: Invoice #INV-2024-0089",
    description: "Due date was Jan 15, 2024 — Customer: ABC Trading Co.",
    action: "Follow up",
  },
  {
    severity: "warning" as const,
    title: "Shipment Delayed: Order #ORD-2024-0158",
    description: "Expected arrival delayed by 2 days — Port congestion in Rotterdam",
    action: "Track",
  },
  {
    severity: "warning" as const,
    title: "Container Approaching Demurrage",
    description: "Container MSCU-789012 — Free time expires in 2 days",
    action: "Action",
  },
  {
    severity: "watch" as const,
    title: "Market Opportunity: Coffee prices rising",
    description: "HS 0901 import demand increased 15% in Germany",
    action: "Explore",
  },
];

// Mock data for recent orders
const recentOrders = [
  { 
    id: "ORD-2024-0162", 
    customer: "Global Foods GmbH", 
    country: "🇩🇪", 
    value: 78500, 
    status: "pending" as const,
    shipments: "0/2",
    date: "Jan 28, 2024"
  },
  { 
    id: "ORD-2024-0158", 
    customer: "Fresh Imports Ltd", 
    country: "🇬🇧", 
    value: 45200, 
    status: "warning" as const,
    shipments: "1/3",
    date: "Jan 22, 2024"
  },
  { 
    id: "ORD-2024-0155", 
    customer: "Eurofoods SA", 
    country: "🇫🇷", 
    value: 92100, 
    status: "success" as const,
    shipments: "2/2",
    date: "Jan 18, 2024"
  },
  { 
    id: "ORD-2024-0151", 
    customer: "Nordic Trade AB", 
    country: "🇸🇪", 
    value: 33800, 
    status: "success" as const,
    shipments: "1/1",
    date: "Jan 15, 2024"
  },
];

const orderColumns = [
  {
    key: "id",
    header: "Order ID",
    render: (item: typeof recentOrders[0]) => (
      <span className="font-mono font-medium text-primary">{item.id}</span>
    ),
  },
  {
    key: "customer",
    header: "Customer",
    render: (item: typeof recentOrders[0]) => (
      <div className="flex items-center gap-2">
        <span className="text-lg">{item.country}</span>
        <span>{item.customer}</span>
      </div>
    ),
  },
  {
    key: "value",
    header: "Value",
    align: "right" as const,
    render: (item: typeof recentOrders[0]) => (
      <span className="font-medium">${item.value.toLocaleString()}</span>
    ),
  },
  {
    key: "shipments",
    header: "Shipments",
    align: "center" as const,
    render: (item: typeof recentOrders[0]) => (
      <span className="font-mono">{item.shipments}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    align: "center" as const,
    render: (item: typeof recentOrders[0]) => {
      const statusLabels = {
        success: "Delivered",
        warning: "In Transit",
        pending: "Pending",
      };
      return (
        <StatusBadge 
          status={item.status} 
          label={statusLabels[item.status]} 
        />
      );
    },
  },
  {
    key: "date",
    header: "Date",
    render: (item: typeof recentOrders[0]) => (
      <span className="text-muted-foreground">{item.date}</span>
    ),
  },
];

export default function MyCompany() {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    }
    return `$${(value / 1000).toFixed(0)}K`;
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar 
        title="Executive Dashboard" 
        subtitle="Company performance overview — Updated 5 minutes ago" 
      />
      
      <div className="flex-1 overflow-auto p-4 pb-6 md:p-6 space-y-6">
        {/* Trade Performance */}
        <div className="bg-card rounded-lg border p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-lg font-semibold">Inventory vs Sales vs Capacity</h2>
              <p className="text-sm text-muted-foreground">Monthly trade performance overview</p>
            </div>
            <div className="text-xs text-muted-foreground">Last 12 months</div>
          </div>
          <TradePerformanceChart data={tradePerformanceMock} unitLabel="KG" />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Total Sales (YTD)"
            value={formatCurrency(2850000)}
            trend={{ value: 12.5, direction: "up", label: "vs last year" }}
            icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
          />
          <KPICard
            title="Outstanding AR"
            value={formatCurrency(425000)}
            subtitle="12 open invoices"
            trend={{ value: -8.2, direction: "down", label: "vs last month" }}
            icon={<FileText className="h-5 w-5 text-muted-foreground" />}
          />
          <KPICard
            title="Overdue Invoices"
            value="3"
            subtitle="$45,200 total"
            icon={<Clock className="h-5 w-5 text-destructive" />}
            variant="danger"
          />
          <KPICard
            title="In-Transit Shipments"
            value="8"
            subtitle="ETA: 3-14 days"
            icon={<Ship className="h-5 w-5 text-muted-foreground" />}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Attention Required Panel */}
          <div className="lg:col-span-1 bg-card rounded-lg border">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                <h2 className="font-semibold">Attention Required</h2>
              </div>
              <span className="text-sm text-muted-foreground">{attentionItems.length} items</span>
            </div>
            <div className="p-3 space-y-2 max-h-[400px] overflow-auto">
              {attentionItems.map((item, index) => (
                <AttentionItem
                  key={index}
                  severity={item.severity}
                  title={item.title}
                  description={item.description}
                  action={item.action}
                  onClick={() => console.log("Navigate to:", item.title)}
                />
              ))}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="lg:col-span-2 bg-card rounded-lg border">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                <h2 className="font-semibold">Recent Orders</h2>
              </div>
              <Button variant="ghost" size="sm" className="gap-1 text-primary">
                View all
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-0">
              <DataTable
                columns={orderColumns}
                data={recentOrders}
                className="border-0 rounded-none"
              />
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Top Market</span>
            </div>
            <p className="text-lg font-semibold">🇩🇪 Germany</p>
            <p className="text-sm text-muted-foreground">32% of total exports</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Package className="h-4 w-4" />
              <span className="text-sm">Top Product</span>
            </div>
            <p className="text-lg font-semibold">HS 0901</p>
            <p className="text-sm text-muted-foreground">Coffee - 45% volume</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Avg Order Value</span>
            </div>
            <p className="text-lg font-semibold">$62,400</p>
            <p className="text-sm text-success">+8% vs last quarter</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Avg Collection</span>
            </div>
            <p className="text-lg font-semibold">38 days</p>
            <p className="text-sm text-warning">Target: 30 days</p>
          </div>
        </div>
      </div>
    </div>
  );
}
