import { useState } from "react";
import { Search, Filter, ChevronRight, Package, Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { TopBar } from "@/components/layout/TopBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Mock orders data
const ordersData = [
  {
    id: "ORD-2024-0162",
    customer: "Global Foods GmbH",
    country: "🇩🇪",
    product: "Coffee Arabica",
    hsCode: "0901",
    value: 78500,
    quantity: "2,400 KG",
    orderDate: "Jan 28, 2024",
    status: "pending" as const,
    shipments: [
      { id: "SHP-001", status: "scheduled", eta: "Feb 15, 2024", quantity: "1,200 KG" },
      { id: "SHP-002", status: "scheduled", eta: "Feb 22, 2024", quantity: "1,200 KG" },
    ],
  },
  {
    id: "ORD-2024-0158",
    customer: "Fresh Imports Ltd",
    country: "🇬🇧",
    product: "Green Tea",
    hsCode: "0902",
    value: 45200,
    quantity: "1,800 KG",
    orderDate: "Jan 22, 2024",
    status: "warning" as const,
    shipments: [
      { id: "SHP-003", status: "delivered", eta: "Feb 01, 2024", quantity: "600 KG" },
      { id: "SHP-004", status: "in_transit", eta: "Feb 10, 2024", quantity: "600 KG" },
      { id: "SHP-005", status: "scheduled", eta: "Feb 18, 2024", quantity: "600 KG" },
    ],
  },
  {
    id: "ORD-2024-0155",
    customer: "Eurofoods SA",
    country: "🇫🇷",
    product: "Organic Bananas",
    hsCode: "0803",
    value: 92100,
    quantity: "5,500 KG",
    orderDate: "Jan 18, 2024",
    status: "success" as const,
    shipments: [
      { id: "SHP-006", status: "delivered", eta: "Jan 28, 2024", quantity: "2,750 KG" },
      { id: "SHP-007", status: "delivered", eta: "Feb 02, 2024", quantity: "2,750 KG" },
    ],
  },
];

export default function OrdersShipments() {
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const columns = [
    {
      key: "id",
      header: "Order ID",
      render: (item: typeof ordersData[0]) => (
        <span className="font-mono font-medium text-primary">{item.id}</span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (item: typeof ordersData[0]) => (
        <div className="flex items-center gap-2">
          <span className="text-lg">{item.country}</span>
          <div>
            <p className="font-medium">{item.customer}</p>
            <p className="text-xs text-muted-foreground">{item.product}</p>
          </div>
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Quantity",
      render: (item: typeof ordersData[0]) => (
        <span>{item.quantity}</span>
      ),
    },
    {
      key: "value",
      header: "Value",
      align: "right" as const,
      render: (item: typeof ordersData[0]) => (
        <span className="font-medium">${item.value.toLocaleString()}</span>
      ),
    },
    {
      key: "shipments",
      header: "Shipments",
      align: "center" as const,
      render: (item: typeof ordersData[0]) => {
        const delivered = item.shipments.filter(s => s.status === "delivered").length;
        return (
          <span className="font-mono">{delivered}/{item.shipments.length}</span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      align: "center" as const,
      render: (item: typeof ordersData[0]) => {
        const statusLabels = {
          success: "Completed",
          warning: "In Progress",
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
      key: "action",
      header: "",
      width: "50px",
      render: (item: typeof ordersData[0]) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedOrder(selectedOrder === item.id ? null : item.id);
          }}
        >
          <ChevronRight className={cn(
            "h-4 w-4 transition-transform",
            selectedOrder === item.id && "rotate-90"
          )} />
        </Button>
      ),
    },
  ];

  const getShipmentStatusColor = (status: string) => {
    switch (status) {
      case "delivered": return "bg-success";
      case "in_transit": return "bg-primary";
      case "scheduled": return "bg-muted-foreground";
      default: return "bg-muted-foreground";
    }
  };

  const getShipmentProgress = (shipments: typeof ordersData[0]["shipments"]) => {
    const total = shipments.length;
    const delivered = shipments.filter(s => s.status === "delivered").length;
    const inTransit = shipments.filter(s => s.status === "in_transit").length;
    return { delivered, inTransit, scheduled: total - delivered - inTransit };
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Orders & Shipments"
        subtitle="Track order fulfillment and shipment status"
      />

      <div className="flex-1 overflow-auto p-4 pb-6 md:p-6 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search orders, customers..." className="pl-9 bg-card" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 bg-card">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            More Filters
          </Button>
        </div>

        {/* Orders Table with Expandable Rows */}
        <div className="bg-card rounded-lg border overflow-hidden">
          <DataTable
            columns={columns}
            data={ordersData}
            onRowClick={(item) => setSelectedOrder(selectedOrder === item.id ? null : item.id)}
            className="border-0 rounded-none"
          />
          
          {/* Expanded Order Detail */}
          {selectedOrder && (
            <div className="border-t bg-muted/30 animate-fade-in">
              {ordersData
                .filter(o => o.id === selectedOrder)
                .map(order => {
                  const progress = getShipmentProgress(order.shipments);
                  const progressPercent = (progress.delivered / order.shipments.length) * 100;
                  
                  return (
                    <div key={order.id} className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Shipment Timeline</h3>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-success" />
                            Delivered ({progress.delivered})
                          </span>
                          <span className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-primary" />
                            In Transit ({progress.inTransit})
                          </span>
                          <span className="flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                            Scheduled ({progress.scheduled})
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2 bg-muted rounded-full overflow-hidden mb-6">
                        <div
                          className="h-full bg-success transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>

                      {/* Shipment Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {order.shipments.map((shipment, idx) => (
                          <div
                            key={shipment.id}
                            className={cn(
                              "rounded-lg border p-4",
                              shipment.status === "delivered" && "bg-emerald-50 border-emerald-200",
                              shipment.status === "in_transit" && "bg-amber-50 border-amber-200",
                              shipment.status === "scheduled" && "bg-card"
                            )}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono text-sm font-medium">{shipment.id}</span>
                              </div>
                              <StatusBadge
                                status={shipment.status === "delivered" ? "success" : shipment.status === "in_transit" ? "warning" : "neutral"}
                                label={shipment.status.replace("_", " ").toUpperCase()}
                                size="sm"
                              />
                            </div>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Calendar className="h-4 w-4" />
                                <span>{shipment.status === "delivered" ? "Delivered" : "ETA"}: {shipment.eta}</span>
                              </div>
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                <span>Quantity: {shipment.quantity}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
