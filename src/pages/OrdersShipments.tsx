import { TopBar } from "@/components/layout/TopBar";
import { ContractTable } from "@/components/contracts/ContractTable";

export default function OrdersShipments() {
  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Orders & Shipments"
        subtitle="Track order fulfillment and shipment status"
      />

      <div className="flex-1 space-y-6 overflow-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
        <div className="rounded-2xl border bg-card/90 backdrop-blur">
          <div className="border-b border-border/70 px-4 py-4 md:px-5">
            <h2 className="text-base font-semibold">Contract Lines</h2>
            <p className="text-sm text-muted-foreground">
              Clean contract status view with quick drill-down by customer.
            </p>
          </div>
          <ContractTable />
        </div>
      </div>
    </div>
  );
}
