import { useState } from "react";
import { Search, Filter, ChevronRight, Calendar, DollarSign, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { TopBar } from "@/components/layout/TopBar";
import { KPICard } from "@/components/ui/kpi-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Mock invoice data
const invoicesData = [
  {
    id: "INV-2024-0112",
    orderId: "ORD-2024-0162",
    customer: "Global Foods GmbH",
    country: "🇩🇪",
    amount: 78500,
    issueDate: "Jan 28, 2024",
    dueDate: "Feb 27, 2024",
    status: "pending" as const,
    daysUntilDue: 20,
  },
  {
    id: "INV-2024-0089",
    orderId: "ORD-2024-0145",
    customer: "ABC Trading Co.",
    country: "🇺🇸",
    amount: 25600,
    issueDate: "Dec 15, 2023",
    dueDate: "Jan 15, 2024",
    status: "error" as const,
    daysOverdue: 32,
  },
  {
    id: "INV-2024-0095",
    orderId: "ORD-2024-0148",
    customer: "Nordic Trade AB",
    country: "🇸🇪",
    amount: 12400,
    issueDate: "Dec 28, 2023",
    dueDate: "Jan 28, 2024",
    status: "error" as const,
    daysOverdue: 19,
  },
  {
    id: "INV-2024-0101",
    orderId: "ORD-2024-0152",
    customer: "Mediterranean Foods",
    country: "🇮🇹",
    amount: 7200,
    issueDate: "Jan 05, 2024",
    dueDate: "Feb 05, 2024",
    status: "error" as const,
    daysOverdue: 11,
  },
  {
    id: "INV-2024-0108",
    orderId: "ORD-2024-0158",
    customer: "Fresh Imports Ltd",
    country: "🇬🇧",
    amount: 45200,
    issueDate: "Jan 22, 2024",
    dueDate: "Feb 21, 2024",
    status: "pending" as const,
    daysUntilDue: 14,
  },
  {
    id: "INV-2024-0105",
    orderId: "ORD-2024-0155",
    customer: "Eurofoods SA",
    country: "🇫🇷",
    amount: 92100,
    issueDate: "Jan 18, 2024",
    dueDate: "Feb 17, 2024",
    status: "success" as const,
    paidDate: "Feb 10, 2024",
  },
];

// AR Aging buckets
const agingBuckets = [
  { label: "Current", range: "0-30 days", amount: 123700, count: 2, color: "bg-data-300" },
  { label: "31-60 days", range: "31-60 days", amount: 12400, count: 1, color: "bg-amber-400" },
  { label: "61-90 days", range: "61-90 days", amount: 7200, count: 1, color: "bg-orange-500" },
  { label: "90+ days", range: "90+ days", amount: 25600, count: 1, color: "bg-destructive" },
];

export default function InvoicesPayments() {
  const [statusFilter, setStatusFilter] = useState("all");

  const totalOutstanding = invoicesData
    .filter(i => i.status !== "success")
    .reduce((sum, i) => sum + i.amount, 0);

  const overdueAmount = invoicesData
    .filter(i => i.status === "error")
    .reduce((sum, i) => sum + i.amount, 0);

  const columns = [
    {
      key: "id",
      header: "Invoice",
      render: (item: typeof invoicesData[0]) => (
        <div>
          <span className="font-mono font-medium text-primary">{item.id}</span>
          <p className="text-xs text-muted-foreground">{item.orderId}</p>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (item: typeof invoicesData[0]) => (
        <div className="flex items-center gap-2">
          <span className="text-lg">{item.country}</span>
          <span>{item.customer}</span>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right" as const,
      render: (item: typeof invoicesData[0]) => (
        <span className="font-medium">${item.amount.toLocaleString()}</span>
      ),
    },
    {
      key: "issueDate",
      header: "Issue Date",
      render: (item: typeof invoicesData[0]) => (
        <span className="text-muted-foreground">{item.issueDate}</span>
      ),
    },
    {
      key: "dueDate",
      header: "Due Date",
      render: (item: typeof invoicesData[0]) => (
        <div>
          <span>{item.dueDate}</span>
          {item.status === "error" && (
            <p className="text-xs text-destructive">{item.daysOverdue} days overdue</p>
          )}
          {item.status === "pending" && (
            <p className="text-xs text-muted-foreground">Due in {item.daysUntilDue} days</p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      align: "center" as const,
      render: (item: typeof invoicesData[0]) => {
        const statusConfig = {
          success: { label: "Paid", status: "success" as const },
          pending: { label: "Pending", status: "pending" as const },
          error: { label: "Overdue", status: "error" as const },
        };
        const config = statusConfig[item.status];
        return <StatusBadge status={config.status} label={config.label} />;
      },
    },
    {
      key: "action",
      header: "",
      width: "100px",
      render: (item: typeof invoicesData[0]) => (
        <Button variant="ghost" size="sm" className="gap-1">
          {item.status === "error" ? "Follow up" : "View"}
          <ChevronRight className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Invoices & Payments"
        subtitle="Manage accounts receivable and track payment status"
      />

      <div className="flex-1 overflow-auto p-4 pb-6 md:p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard
            title="Total Outstanding"
            value={`$${totalOutstanding.toLocaleString()}`}
            subtitle="5 open invoices"
            icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
          />
          <KPICard
            title="Overdue Amount"
            value={`$${overdueAmount.toLocaleString()}`}
            subtitle="3 invoices past due"
            variant="danger"
            icon={<AlertCircle className="h-5 w-5 text-destructive" />}
          />
          <KPICard
            title="Average Collection"
            value="38 days"
            subtitle="Target: 30 days"
            trend={{ value: 8, direction: "up", label: "vs target" }}
            variant="warning"
            icon={<Calendar className="h-5 w-5 text-muted-foreground" />}
          />
        </div>

        {/* AR Aging Buckets */}
        <div className="bg-card rounded-lg border p-4">
          <h3 className="font-semibold mb-4">AR Aging Analysis</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {agingBuckets.map((bucket) => (
              <div
                key={bucket.label}
                className={cn(
                  "rounded-lg p-4 border-l-4",
                  bucket.label === "Current" && "bg-blue-50 border-l-data-500",
                  bucket.label === "31-60 days" && "bg-amber-50 border-l-amber-400",
                  bucket.label === "61-90 days" && "bg-orange-50 border-l-orange-500",
                  bucket.label === "90+ days" && "bg-red-50 border-l-destructive"
                )}
              >
                <p className="text-sm font-medium text-muted-foreground">{bucket.label}</p>
                <p className="text-xl font-semibold mt-1">${bucket.amount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">{bucket.count} invoice{bucket.count > 1 ? "s" : ""}</p>
              </div>
            ))}
          </div>
          
          {/* Aging Bar Chart */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex h-4 rounded-full overflow-hidden bg-muted">
              {agingBuckets.map((bucket, idx) => {
                const total = agingBuckets.reduce((s, b) => s + b.amount, 0);
                const width = (bucket.amount / total) * 100;
                return (
                  <div
                    key={bucket.label}
                    className={cn("transition-all", bucket.color)}
                    style={{ width: `${width}%` }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>Current: 73%</span>
              <span>Overdue: 27%</span>
            </div>
          </div>
        </div>

        {/* Invoice Table */}
        <div>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search invoices..." className="pl-9 bg-card" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-card">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              More Filters
            </Button>
          </div>

          <DataTable
            columns={columns}
            data={invoicesData}
          />
        </div>
      </div>
    </div>
  );
}
