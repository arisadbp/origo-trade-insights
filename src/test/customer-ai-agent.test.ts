import { describe, expect, it } from "vitest";
import { buildAgentReply, type AgentDataSnapshot } from "@/lib/customerAiAgent";

const baseSnapshot: AgentDataSnapshot = {
  loadedAt: "2026-02-17T00:00:00.000Z",
  customer: {
    id: "customer-1",
    company_name: "THAI ROONG RUANG INDUSTRY CO., LTD.",
    email: "info@farihealth.com",
    contact_name: "",
    phone: "",
    country: "",
    status: "active",
    updated_at: "2026-02-17T00:00:00.000Z",
  },
  uploads: [],
  invoices: [
    {
      invoice: "INV-1001",
      usd: 1200,
      status_type: "pending",
      invoice_date: "2026-01-01",
      customer_name: "THAI ROONG RUANG INDUSTRY CO., LTD.",
    },
  ],
  stock: [],
  market: [],
  uploadStats: {
    total: 0,
    pendingReview: 0,
    approved: 0,
    rejectedOrChanges: 0,
    latestUploadAt: null,
  },
  invoiceStats: {
    total: 1,
    totalUsd: 1200,
    overdueCount: 1,
    pendingCount: 1,
    latestInvoiceDate: "2026-01-01",
  },
  stockStats: {
    totalQty: 0,
    itemCount: 0,
    topFactories: [],
  },
  marketStats: {
    rowCount: 0,
    latestDate: null,
    current30dWeight: 0,
    previous30dWeight: 0,
    trendPct: 0,
    topMarkets: [],
  },
  supplemental: {
    activity_logs: [],
    admin_users: [],
    companies: [],
    contract_lines: [],
    deliveries: [],
    finance_invoices: [],
    supabase_companies: [],
    users: [],
  },
  warnings: [],
};

describe("customerAiAgent", () => {
  it("returns overdue list when user asks overdue items", () => {
    const reply = buildAgentReply("มีรายการอะไรที่ OverDue บ้าง", baseSnapshot);

    expect(reply).toContain("พบรายการ Overdue");
    expect(reply).toContain("INV-1001");
  });

  it("returns invoice summary for invoice questions", () => {
    const reply = buildAgentReply("สรุป invoice ล่าสุด", baseSnapshot);

    expect(reply).toContain("วิเคราะห์ Invoices & Payments");
  });

  it("returns orders overdue list for orders question", () => {
    const snapshotWithOrders: AgentDataSnapshot = {
      ...baseSnapshot,
      supplemental: {
        ...baseSnapshot.supplemental,
        contract_lines: [
          {
            contract_id: "P04875",
            job: "W25/026",
            status: "Overdue",
            ton: 1000,
            acc: 850,
            date_to: "2025-09-30",
            contracts: [{ customer: "wilmar sugar pte. ltd" }],
          },
        ],
      },
    };

    const reply = buildAgentReply("Orders & Shipments overdue มีอะไรบ้าง", snapshotWithOrders);

    expect(reply).toContain("Orders & Shipments Overdue");
    expect(reply).toContain("P04875");
  });

  it("answers market intelligence top market question", () => {
    const snapshotWithMarket: AgentDataSnapshot = {
      ...baseSnapshot,
      market: [
        { date: "2026-02-15", weight_kg: 3000, destination_country: "JAPAN", product: "SUGAR", importer: "TRR" },
        { date: "2026-02-10", weight_kg: 2000, destination_country: "INDONESIA", product: "SUGAR", importer: "TRR" },
        { date: "2026-02-01", weight_kg: 1500, destination_country: "JAPAN", product: "MOLASSES", importer: "TRR" },
      ],
    };

    const reply = buildAgentReply("Market Intelligence top 2 market 30 วันล่าสุด", snapshotWithMarket);

    expect(reply).toContain("Top Markets");
    expect(reply).toContain("JAPAN");
  });

  it("answers market intelligence trend question", () => {
    const snapshotWithMarket: AgentDataSnapshot = {
      ...baseSnapshot,
      market: [
        { date: "2026-02-15", weight_kg: 3000, destination_country: "JAPAN", product: "SUGAR", importer: "TRR" },
        { date: "2026-02-10", weight_kg: 2000, destination_country: "INDONESIA", product: "SUGAR", importer: "TRR" },
        { date: "2026-01-10", weight_kg: 1000, destination_country: "JAPAN", product: "SUGAR", importer: "TRR" },
      ],
    };

    const reply = buildAgentReply("แนวโน้ม market 30 วันล่าสุด", snapshotWithMarket);

    expect(reply).toContain("Trend change");
    expect(reply).toContain("วิเคราะห์ Market Intelligence Trend");
  });

  it("returns market intelligence customer list grouped by status", () => {
    const snapshotWithCustomers: AgentDataSnapshot = {
      ...baseSnapshot,
      supplemental: {
        ...baseSnapshot.supplemental,
        companies: [
          { company_id: "c-1", customer: "ACME CO", location: "Thailand", status: "yellow", value_tag: "High-potential customers" },
          { company_id: "c-2", customer: "BETA CO", location: "Vietnam", status: "green", value_tag: "General customers" },
        ],
      },
    };

    const reply = buildAgentReply("ขอรายชื่อลูกค้าใน Market Intelligence", snapshotWithCustomers);

    expect(reply).toContain("Market Intelligence Customer List");
    expect(reply).toContain("[High-potential customers]");
    expect(reply).toContain("[General customers]");
    expect(reply).toContain("ACME CO");
  });

  it("returns TRR performance summary when asked", () => {
    const snapshotWithPerformance: AgentDataSnapshot = {
      ...baseSnapshot,
      supplemental: {
        ...baseSnapshot.supplemental,
        contract_lines: [
          { contract_id: "C-1", status: "Pending", ton: 200, acc: 120, contracts: [{ customer: "Buyer A" }] },
        ],
        deliveries: [{ quantity: 120 }],
        finance_invoices: [{ usd: 5000, status_type: "Provisional price" }],
      },
    };

    const reply = buildAgentReply("สรุป performance ของ TRR", snapshotWithPerformance);

    expect(reply).toContain("Thai Roong Ruang (TRR) Performance");
    expect(reply).toContain("Orders & Shipments");
    expect(reply).toContain("Invoices");
  });

  it("returns inventory list for requested SB warehouse", () => {
    const snapshotWithStock: AgentDataSnapshot = {
      ...baseSnapshot,
      stock: [
        { factory: "SB", type: "Refined Sugar", tag: "A", qty: 120 },
        { factory: "SB", type: "Raw Sugar", tag: "B", qty: 80 },
        { factory: "SC", type: "Raw Sugar", tag: "C", qty: 50 },
      ],
      stockStats: {
        totalQty: 250,
        itemCount: 3,
        topFactories: [
          { factory: "SB", qty: 200 },
          { factory: "SC", qty: 50 },
        ],
      },
    };

    const reply = buildAgentReply("สินค้าในคลัง SB มีอะไรบ้าง", snapshotWithStock, "inventory");

    expect(reply).toContain("สินค้าในคลัง SB");
    expect(reply).toContain("Refined Sugar");
    expect(reply).not.toContain("SC |");
  });

  it("returns customer invoice detail in invoices topic when question only mentions customer name", () => {
    const snapshotWithFinanceInvoices: AgentDataSnapshot = {
      ...baseSnapshot,
      supplemental: {
        ...baseSnapshot.supplemental,
        finance_invoices: [
          {
            invoice: "INV-A1",
            usd: 3000,
            status_type: "pending",
            invoice_date: "2026-02-01",
            customer_name: "ALVEAN",
          },
          {
            invoice: "INV-B1",
            usd: 500,
            status_type: "paid",
            invoice_date: "2026-01-15",
            customer_name: "COFCO",
          },
        ],
      },
    };

    const reply = buildAgentReply("ALVEAN", snapshotWithFinanceInvoices, "invoices_payments");

    expect(reply).toContain("ALVEAN");
    expect(reply).toContain("INV-A1");
    expect(reply).not.toContain("INV-B1");
  });

  it("shows explicit no-data message when requested invoice customer is not found", () => {
    const reply = buildAgentReply("ขอรายละเอียด ALVEAN", baseSnapshot, "invoices_payments");
    expect(reply).toContain("ALVEAN");
    expect(reply).toContain("ไม่พบข้อมูลใบแจ้งหนี้ของ ALVEAN");
  });
});
