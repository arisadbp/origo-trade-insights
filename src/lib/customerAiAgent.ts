import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type CustomerRow = {
  id: string;
  company_name: string;
  email: string;
  contact_name: string;
  phone: string;
  country: string;
  status: string;
  updated_at: string;
};

type UploadRow = {
  id: string;
  file_name: string;
  file_type: string;
  review_status: string;
  status: string;
  uploaded_at: string;
  uploaded_by: string;
};

type InvoiceRow = {
  invoice: string | null;
  usd: number | null;
  status_type: string | null;
  invoice_date: string | null;
  customer_name: string | null;
};

type StockRow = {
  factory: string | null;
  qty: number | string | null;
  type: string | null;
  tag?: string | null;
  stockId?: string | null;
};

type StockDbRow = Record<string, unknown>;

type PurchaseTrendRow = {
  date: string | null;
  weight_kg: number | string | null;
  destination_country: string | null;
  product: string | null;
  importer: string | null;
};

type GenericRow = Record<string, unknown>;
type ContractOverdueRow = {
  contract_id: string;
  job: string;
  customer: string;
  status: string;
  date_to: string | null;
  remaining_ton: number;
};

type MarketCustomerRow = {
  companyId: string;
  name: string;
  location: string;
  status: string;
  lastPurchaseDate: string | null;
  trades: number;
};

type UploadStats = {
  total: number;
  pendingReview: number;
  approved: number;
  rejectedOrChanges: number;
  latestUploadAt: string | null;
};

type InvoiceStats = {
  total: number;
  totalUsd: number;
  overdueCount: number;
  pendingCount: number;
  latestInvoiceDate: string | null;
};

type StockStats = {
  totalQty: number;
  itemCount: number;
  topFactories: Array<{ factory: string; qty: number }>;
};

type MarketStats = {
  rowCount: number;
  latestDate: string | null;
  current30dWeight: number;
  previous30dWeight: number;
  trendPct: number;
  topMarkets: Array<{ market: string; weight: number }>;
};

export interface AgentDataSnapshot {
  loadedAt: string;
  customer: CustomerRow | null;
  uploads: UploadRow[];
  invoices: InvoiceRow[];
  stock: StockRow[];
  market: PurchaseTrendRow[];
  uploadStats: UploadStats;
  invoiceStats: InvoiceStats;
  stockStats: StockStats;
  marketStats: MarketStats;
  supplemental: Record<string, GenericRow[]>;
  warnings: string[];
}

export type AgentTopic =
  | "all"
  | "market_intelligence"
  | "orders_shipments"
  | "inventory"
  | "invoices_payments";

const SUPPLEMENTAL_TABLES = [
  "activity_logs",
  "admin_users",
  "companies",
  "contract_lines",
  "deliveries",
  "finance_invoices",
  "supabase_companies",
  "users",
] as const;

const GLOBAL_SUPPLEMENTAL_TABLES = new Set<string>([
  "contract_lines",
  "deliveries",
  "companies",
  "supabase_companies",
  "finance_invoices",
]);

const toNumber = (value: number | string | null | undefined) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatNumber = (value: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

const toDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value: string | null | undefined) => {
  const date = toDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" });
};

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();

const extractErrorMessage = (error: unknown) => {
  if (error && typeof error === "object" && "message" in (error as Record<string, unknown>)) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (error instanceof Error) return error.message;
  return String(error ?? "Unknown error");
};

const buildIdentityTerms = (email: string, username: string, companyName?: string | null) => {
  const terms = new Set<string>();
  const emailLocal = email.includes("@") ? email.split("@")[0] : email;
  const emailDomain = email.includes("@") ? email.split("@")[1] : "";
  const pushTerm = (value: string) => {
    const v = normalize(value);
    if (!v || v.length < 3) return;
    terms.add(v);
  };

  pushTerm(username);
  pushTerm(emailLocal);
  if (emailDomain) {
    pushTerm(emailDomain.split(".")[0] || "");
  }
  if (companyName) {
    pushTerm(companyName);
    companyName.split(/[\s,.()/-]+/).forEach(pushTerm);
  }

  return [...terms];
};

const includeByTerms = (candidate: string | null | undefined, terms: string[]) => {
  if (!candidate || terms.length === 0) return false;
  const haystack = normalize(candidate);
  if (!haystack) return false;
  return terms.some((term) => haystack.includes(term));
};

const includeByCompany = (candidate: string | null | undefined, companyName: string) => {
  if (!candidate) return false;
  const nCandidate = normalize(candidate);
  const nCompany = normalize(companyName);
  if (!nCandidate || !nCompany) return false;
  if (nCandidate.includes(nCompany)) return true;

  const companyTokens = nCompany.split(" ").filter((token) => token.length >= 3);
  if (!companyTokens.length) return false;
  const matched = companyTokens.filter((token) => nCandidate.includes(token)).length;
  return matched >= Math.max(2, Math.floor(companyTokens.length / 2));
};

const toStringOrNull = (value: unknown) => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
};

const mapStockRow = (row: StockDbRow): StockRow => ({
  factory: toStringOrNull(row.factory),
  qty: typeof row.qty === "number" || typeof row.qty === "string" ? row.qty : null,
  type: toStringOrNull(row.type),
  tag: toStringOrNull(row.tag),
  stockId: toStringOrNull(row.stock_id) ?? toStringOrNull(row.id),
});

const objectValues = (row: GenericRow) =>
  Object.values(row).filter((value): value is string | number | boolean => {
    const type = typeof value;
    return type === "string" || type === "number" || type === "boolean";
  });

const rowMatchesCustomerScope = (
  row: GenericRow,
  customer: CustomerRow | null,
  identityTerms: string[],
) => {
  const customerId = toStringOrNull(row.customer_id);
  if (customer && customerId && normalize(customerId) === normalize(customer.id)) return true;

  const candidateFields = [
    toStringOrNull(row.customer_name),
    toStringOrNull(row.company_name),
    toStringOrNull(row.importer),
    toStringOrNull(row.email),
    toStringOrNull(row.uploaded_by),
    toStringOrNull(row.username),
    toStringOrNull(row.actor),
    toStringOrNull(row.message),
    toStringOrNull(row.id),
  ];

  if (customer && candidateFields.some((candidate) => includeByCompany(candidate, customer.company_name))) {
    return true;
  }

  if (identityTerms.length > 0 && candidateFields.some((candidate) => includeByTerms(candidate, identityTerms))) {
    return true;
  }

  if (identityTerms.length === 0) return false;
  const blob = objectValues(row).map((value) => normalize(String(value))).join(" ");
  return identityTerms.some((term) => blob.includes(term));
};

const isPendingInvoice = (statusType: string | null | undefined) => {
  const normalized = String(statusType || "").toLowerCase();
  return normalized === "pending" || normalized.includes("pending");
};

const isOverdueInvoice = (statusType: string | null | undefined, invoiceDate: string | null | undefined) => {
  if (!isPendingInvoice(statusType)) return false;
  const date = toDate(invoiceDate);
  if (!date) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime() - date.getTime() > 3 * 24 * 60 * 60 * 1000;
};

const overdueDays = (invoiceDate: string | null | undefined) => {
  const date = toDate(invoiceDate);
  if (!date) return 0;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
};

const toDayMs = (value: string | null | undefined) => {
  if (!value) return null;
  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const isMissingTableError = (error: unknown) => {
  const code = (error as { code?: string } | undefined)?.code;
  if (code === "PGRST205" || code === "42P01") return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /relation .* does not exist|could not find the table|schema cache/i.test(message);
};

async function resolveCustomer(email: string, username: string, warnings: string[]): Promise<CustomerRow | null> {
  if (!supabase) return null;

  const emailLower = email.trim().toLowerCase();
  const usernameTrim = username.trim();

  if (emailLower) {
    const byEmail = await supabase
      .from("customers")
      .select("id, company_name, email, contact_name, phone, country, status, updated_at")
      .ilike("email", emailLower)
      .limit(1)
      .maybeSingle();

    if (byEmail.data) return byEmail.data as CustomerRow;
    if (byEmail.error && !isMissingTableError(byEmail.error)) {
      warnings.push(`customers lookup by email failed: ${extractErrorMessage(byEmail.error)}`);
    }
  }

  if (usernameTrim) {
    const byId = await supabase
      .from("customers")
      .select("id, company_name, email, contact_name, phone, country, status, updated_at")
      .ilike("id", usernameTrim)
      .limit(1)
      .maybeSingle();

    if (byId.data) return byId.data as CustomerRow;
    if (byId.error && !isMissingTableError(byId.error)) {
      warnings.push(`customers lookup by id failed: ${extractErrorMessage(byId.error)}`);
    }

    const byCompanyLike = await supabase
      .from("customers")
      .select("id, company_name, email, contact_name, phone, country, status, updated_at")
      .ilike("company_name", `%${usernameTrim}%`)
      .limit(1)
      .maybeSingle();

    if (byCompanyLike.data) return byCompanyLike.data as CustomerRow;
    if (byCompanyLike.error && !isMissingTableError(byCompanyLike.error)) {
      warnings.push(`customers lookup by company_name failed: ${extractErrorMessage(byCompanyLike.error)}`);
    }
  }

  warnings.push("Customer account is not mapped in customers table; results may be incomplete.");
  return null;
}

function calcUploadStats(rows: UploadRow[]): UploadStats {
  const pendingReview = rows.filter((row) => {
    const review = String(row.review_status || "").toLowerCase();
    const status = String(row.status || "").toLowerCase();
    return review.includes("pending") || status.includes("processing") || status.includes("uploading");
  }).length;

  const approved = rows.filter((row) => String(row.review_status || "").toLowerCase().includes("approve")).length;
  const rejectedOrChanges = rows.filter((row) => {
    const review = String(row.review_status || "").toLowerCase();
    return review.includes("reject") || review.includes("change");
  }).length;

  const latestUploadAt = rows
    .map((row) => row.uploaded_at)
    .filter(Boolean)
    .sort((a, b) => (a > b ? -1 : 1))[0] ?? null;

  return {
    total: rows.length,
    pendingReview,
    approved,
    rejectedOrChanges,
    latestUploadAt,
  };
}

function calcInvoiceStats(rows: InvoiceRow[]): InvoiceStats {
  const totalUsd = rows.reduce((sum, row) => sum + toNumber(row.usd), 0);
  const overdueCount = rows.filter((row) => isOverdueInvoice(row.status_type, row.invoice_date)).length;
  const pendingCount = rows.filter((row) => isPendingInvoice(row.status_type)).length;
  const latestInvoiceDate = rows
    .map((row) => row.invoice_date)
    .filter(Boolean)
    .sort((a, b) => (a! > b! ? -1 : 1))[0] ?? null;
  return {
    total: rows.length,
    totalUsd,
    overdueCount,
    pendingCount,
    latestInvoiceDate,
  };
}

function calcStockStats(rows: StockRow[]): StockStats {
  const factoryMap = new Map<string, number>();
  let totalQty = 0;

  rows.forEach((row) => {
    const qty = toNumber(row.qty);
    totalQty += qty;
    const factory = String(row.factory || "UNKNOWN").trim().toUpperCase();
    factoryMap.set(factory, (factoryMap.get(factory) ?? 0) + qty);
  });

  const topFactories = [...factoryMap.entries()]
    .map(([factory, qty]) => ({ factory, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 3);

  return {
    totalQty,
    itemCount: rows.length,
    topFactories,
  };
}

function calcMarketStats(rows: PurchaseTrendRow[]): MarketStats {
  const sorted = [...rows].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const latestDate = sorted.length > 0 ? sorted[sorted.length - 1].date : null;

  const latest = toDate(latestDate);
  if (!latest) {
    return {
      rowCount: rows.length,
      latestDate: null,
      current30dWeight: 0,
      previous30dWeight: 0,
      trendPct: 0,
      topMarkets: [],
    };
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const currentStart = latest.getTime() - 30 * dayMs;
  const prevStart = latest.getTime() - 60 * dayMs;

  let current30dWeight = 0;
  let previous30dWeight = 0;
  const marketMap = new Map<string, number>();

  rows.forEach((row) => {
    const rowDate = toDate(row.date)?.getTime();
    const weight = toNumber(row.weight_kg);
    if (!rowDate) return;

    if (rowDate >= currentStart && rowDate <= latest.getTime()) current30dWeight += weight;
    if (rowDate >= prevStart && rowDate < currentStart) previous30dWeight += weight;

    const market = String(row.destination_country || "UNKNOWN").toUpperCase();
    marketMap.set(market, (marketMap.get(market) ?? 0) + weight);
  });

  const trendPct = previous30dWeight > 0 ? ((current30dWeight - previous30dWeight) / previous30dWeight) * 100 : 0;
  const topMarkets = [...marketMap.entries()]
    .map(([market, weight]) => ({ market, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);

  return {
    rowCount: rows.length,
    latestDate,
    current30dWeight,
    previous30dWeight,
    trendPct,
    topMarkets,
  };
}

const parseWindowDays = (question: string) => {
  const q = normalize(question);
  const explicitDays = q.match(/(\d{1,3})\s*(day|days|วัน)/);
  if (explicitDays) {
    const parsed = Number(explicitDays[1]);
    if (Number.isFinite(parsed) && parsed > 0) return Math.min(parsed, 3650);
  }
  if (q.includes("ไตรมาส") || q.includes("quarter")) return 90;
  if (q.includes("ปี") || q.includes("year")) return 365;
  return 30;
};

const parseTopLimit = (question: string) => {
  const q = normalize(question);
  const match =
    q.match(/top\s*(\d{1,2})/) ??
    q.match(/(\d{1,2})\s*อันดับ/) ??
    q.match(/อันดับ\s*(\d{1,2})/);
  if (!match) return 5;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return 5;
  return Math.min(parsed, 20);
};

const findMentionedCandidate = (question: string, candidates: string[]) => {
  const q = normalize(question);
  return [...new Set(candidates.map((item) => item.trim()).filter((item) => item.length >= 3))]
    .sort((a, b) => b.length - a.length)
    .find((item) => q.includes(normalize(item))) ?? null;
};

const aggregateMarketWeights = (rows: PurchaseTrendRow[], by: "destination_country" | "product") => {
  const map = new Map<string, number>();
  rows.forEach((row) => {
    const keyRaw = by === "destination_country" ? row.destination_country : row.product;
    const key = String(keyRaw || "UNKNOWN").trim();
    if (!key) return;
    map.set(key, (map.get(key) ?? 0) + toNumber(row.weight_kg));
  });
  return [...map.entries()]
    .map(([name, weight]) => ({ name, weight }))
    .sort((a, b) => b.weight - a.weight);
};

function buildMarketIntelligenceReply(question: string, snapshot: AgentDataSnapshot) {
  const q = normalize(question);
  const rows = snapshot.market.filter((row) => toDate(row.date));
  if (rows.length === 0) return buildMarketReply(snapshot);

  const latest = rows
    .map((row) => toDate(row.date))
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (!latest) return buildMarketReply(snapshot);

  const days = parseWindowDays(question);
  const dayMs = 24 * 60 * 60 * 1000;
  const currentStartMs = latest.getTime() - days * dayMs;
  const prevStartMs = latest.getTime() - days * 2 * dayMs;

  const mentionedMarket = findMentionedCandidate(
    question,
    rows.map((row) => String(row.destination_country || "")).filter(Boolean),
  );
  const mentionedProduct = findMentionedCandidate(
    question,
    rows.map((row) => String(row.product || "")).filter(Boolean),
  );

  const applyDimensionFilter = (source: PurchaseTrendRow[]) => source.filter((row) => {
    if (mentionedMarket && normalize(String(row.destination_country || "")) !== normalize(mentionedMarket)) return false;
    if (mentionedProduct && normalize(String(row.product || "")) !== normalize(mentionedProduct)) return false;
    return true;
  });

  const currentRows = applyDimensionFilter(rows).filter((row) => {
    const rowMs = toDate(row.date)?.getTime();
    return rowMs ? rowMs >= currentStartMs && rowMs <= latest.getTime() : false;
  });
  const prevRows = applyDimensionFilter(rows).filter((row) => {
    const rowMs = toDate(row.date)?.getTime();
    return rowMs ? rowMs >= prevStartMs && rowMs < currentStartMs : false;
  });

  if (currentRows.length === 0) {
    return [
      "Market Intelligence",
      `- ไม่พบข้อมูลตามเงื่อนไขในช่วง ${days} วันล่าสุด`,
      mentionedMarket ? `- market filter: ${mentionedMarket}` : "",
      mentionedProduct ? `- product filter: ${mentionedProduct}` : "",
    ].filter(Boolean).join("\n");
  }

  const topLimit = parseTopLimit(question);
  const topMarketIntent = /top|อันดับ|ประเทศไหน|ประเทศหลัก|market share|ตลาดหลัก/.test(q);
  const topProductIntent = /product|สินค้า|ชนิด|ประเภท/.test(q);
  const trendIntent = /trend|แนวโน้ม|เพิ่ม|ลด|เทียบ|compare/.test(q);

  const currentWeight = currentRows.reduce((sum, row) => sum + toNumber(row.weight_kg), 0);
  const prevWeight = prevRows.reduce((sum, row) => sum + toNumber(row.weight_kg), 0);
  const trendPct = prevWeight > 0 ? ((currentWeight - prevWeight) / prevWeight) * 100 : 0;

  if (trendIntent) {
    return [
      "วิเคราะห์ Market Intelligence Trend",
      `- ช่วงปัจจุบัน: ${days} วันล่าสุด ถึง ${formatDate(latest.toISOString())}`,
      `- ปริมาณรวม: ${formatNumber(currentWeight)} KG`,
      `- ช่วงก่อนหน้า: ${formatNumber(prevWeight)} KG`,
      `- Trend change: ${prevWeight > 0 ? `${trendPct.toFixed(1)}%` : "เทียบไม่ได้ (ฐานก่อนหน้าเป็น 0)"}`,
      mentionedMarket ? `- market filter: ${mentionedMarket}` : "",
      mentionedProduct ? `- product filter: ${mentionedProduct}` : "",
    ].filter(Boolean).join("\n");
  }

  if (topProductIntent) {
    const topProducts = aggregateMarketWeights(currentRows, "product").slice(0, topLimit);
    return [
      `Top Products (${days} วันล่าสุด)`,
      ...topProducts.map((item, index) => `${index + 1}. ${item.name} | ${formatNumber(item.weight)} KG`),
      mentionedMarket ? `- market filter: ${mentionedMarket}` : "",
    ].filter(Boolean).join("\n");
  }

  if (topMarketIntent || mentionedMarket) {
    const topMarkets = aggregateMarketWeights(currentRows, "destination_country").slice(0, topLimit);
    return [
      `Top Markets (${days} วันล่าสุด)`,
      ...topMarkets.map((item, index) => `${index + 1}. ${item.name} | ${formatNumber(item.weight)} KG`),
      mentionedProduct ? `- product filter: ${mentionedProduct}` : "",
    ].filter(Boolean).join("\n");
  }

  const topMarkets = aggregateMarketWeights(currentRows, "destination_country").slice(0, 3);
  const topProducts = aggregateMarketWeights(currentRows, "product").slice(0, 3);
  return [
    "วิเคราะห์ Market Intelligence",
    `- ช่วงข้อมูล: ${days} วันล่าสุด ถึง ${formatDate(latest.toISOString())}`,
    `- ปริมาณรวม: ${formatNumber(currentWeight)} KG จาก ${formatNumber(currentRows.length)} records`,
    `- Top markets: ${topMarkets.map((item) => `${item.name} (${formatNumber(item.weight)} KG)`).join(" | ") || "-"}`,
    `- Top products: ${topProducts.map((item) => `${item.name} (${formatNumber(item.weight)} KG)`).join(" | ") || "-"}`,
  ].join("\n");
}

const marketStatusLabel = (statusValue: string | null | undefined, valueTag: string | null | undefined) => {
  const valueTagText = String(valueTag || "").trim();
  if (valueTagText) return valueTagText;

  const status = String(statusValue || "").trim().toLowerCase();
  if (!status) return "Unclassified";
  if (status === "yellow") return "High-potential customers";
  if (status === "green") return "General customers";
  if (status === "red") return "Watchlist customers";
  if (status === "new") return "New customers";
  if (status === "existing" || status === "active") return "Existing customers";
  return statusValue?.toString() || "Unclassified";
};

const extractMarketCustomers = (snapshot: AgentDataSnapshot): MarketCustomerRow[] => {
  const sourceRows = snapshot.supplemental.supabase_companies?.length
    ? snapshot.supplemental.supabase_companies
    : (snapshot.supplemental.companies ?? []);

  const map = new Map<string, MarketCustomerRow>();
  sourceRows.forEach((row) => {
    const name =
      toStringOrNull(row.customer_name) ??
      toStringOrNull(row.customer) ??
      toStringOrNull(row.company_name) ??
      toStringOrNull(row.importer) ??
      toStringOrNull(row.name);
    if (!name) return;

    const companyId =
      toStringOrNull(row.company_id) ??
      toStringOrNull(row.id) ??
      `${normalize(name)}-${normalize(toStringOrNull(row.location) ?? "")}`;
    const location =
      toStringOrNull(row.customer_location) ??
      toStringOrNull(row.location) ??
      toStringOrNull(row.country) ??
      "-";
    const status = marketStatusLabel(toStringOrNull(row.status), toStringOrNull(row.value_tag));
    const lastPurchaseDate =
      toStringOrNull(row.latest_purchase_time) ??
      toStringOrNull(row.latest_purchase_date) ??
      toStringOrNull(row.updated_at);
    const trades = toNumber(row.trades as number | string | null | undefined);

    map.set(companyId, {
      companyId,
      name: name.trim(),
      location: location.trim() || "-",
      status,
      lastPurchaseDate,
      trades,
    });
  });

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
};

function buildMarketCustomerListReply(question: string, snapshot: AgentDataSnapshot) {
  const rows = extractMarketCustomers(snapshot);
  if (rows.length === 0) {
    return "Market Intelligence: ไม่พบรายชื่อลูกค้าในตาราง companies";
  }

  const showAll = /ทั้งหมด|all|every/.test(normalize(question));
  const perStatusLimit = showAll ? 100 : 10;
  const byStatus = new Map<string, MarketCustomerRow[]>();
  rows.forEach((row) => {
    const list = byStatus.get(row.status) ?? [];
    list.push(row);
    byStatus.set(row.status, list);
  });

  const orderedStatuses = [...byStatus.entries()]
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  const lines = orderedStatuses.flatMap(([status, items]) => {
    const preview = items
      .slice(0, perStatusLimit)
      .map((item, index) => `${index + 1}. ${item.name} | ${item.location} | last ${formatDate(item.lastPurchaseDate)} | trades ${formatNumber(item.trades)}`);
    const moreLine = items.length > perStatusLimit ? [`...และอีก ${items.length - perStatusLimit} รายชื่อ`] : [];
    return [`[${status}] ${items.length} รายชื่อ`, ...preview, ...moreLine, ""];
  });

  return [
    `Market Intelligence Customer List: ${rows.length} รายชื่อ`,
    ...lines,
  ].join("\n").trim();
}

function buildTRRPerformanceReply(snapshot: AgentDataSnapshot) {
  const contractRows = snapshot.supplemental.contract_lines ?? [];
  const overdueOrders = extractOverdueOrders(contractRows);
  const commitTon = contractRows.reduce((sum, row) => sum + toNumber(row.ton as number | string | null | undefined), 0);
  const deliveredTon = contractRows.reduce((sum, row) => sum + toNumber(row.acc as number | string | null | undefined), 0);
  const remainingTon = commitTon - deliveredTon;
  const pendingOrders = contractRows.filter((row) => normalize(String(row.status ?? "")).includes("pending")).length;
  const completeOrders = contractRows.filter((row) => {
    const status = normalize(String(row.status ?? ""));
    return status.includes("complete");
  }).length;
  const uniqueBuyers = new Set(
    contractRows.map((row) => {
      const relation = row.contracts as { customer?: unknown }[] | { customer?: unknown } | null | undefined;
      return Array.isArray(relation)
        ? toStringOrNull(relation[0]?.customer)
        : toStringOrNull(relation?.customer);
    }).filter(Boolean),
  ).size;

  const deliveryRows = snapshot.supplemental.deliveries ?? [];
  const deliveredShipmentQty = deliveryRows.reduce((sum, row) => sum + toNumber(row.quantity as number | string | null | undefined), 0);

  const invoiceRows = (snapshot.supplemental.finance_invoices ?? []) as InvoiceRow[];
  const invoiceTotalUsd = invoiceRows.reduce((sum, row) => sum + toNumber(row.usd), 0);
  const invoiceOpenCount = invoiceRows.filter((row) => {
    const status = normalize(String(row.status_type ?? ""));
    return status.includes("pending") || status.includes("provisional");
  }).length;

  return [
    "Thai Roong Ruang (TRR) Performance",
    `- Orders & Shipments: ${formatNumber(contractRows.length)} lines | Buyers ${formatNumber(uniqueBuyers)} | Pending ${formatNumber(pendingOrders)} | Overdue ${formatNumber(overdueOrders.length)} | Complete ${formatNumber(completeOrders)}`,
    `- Commit vs Delivered: Commit ${formatNumber(commitTon)} MT | Delivered ${formatNumber(deliveredTon)} MT | Remaining ${formatNumber(remainingTon)} MT`,
    `- Deliveries: ${formatNumber(deliveryRows.length)} records | Quantity ${formatNumber(deliveredShipmentQty)} MT`,
    `- Invoices: ${formatNumber(invoiceRows.length)} records | Open ${formatNumber(invoiceOpenCount)} | Total ${formatCurrency(invoiceTotalUsd)}`,
    `- Inventory: ${formatNumber(snapshot.stockStats.itemCount)} rows | Total ${formatNumber(snapshot.stockStats.totalQty)} MT`,
  ].join("\n");
}

export async function loadAgentDataSnapshot(email: string, username: string): Promise<AgentDataSnapshot> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const warnings: string[] = [];
  const customer = await resolveCustomer(email, username, warnings);
  const identityTerms = buildIdentityTerms(email, username, customer?.company_name);

  const uploadsPromise = (async () => {
    try {
      let query = supabase
        .from("uploads")
        .select("id, file_name, file_type, review_status, status, uploaded_at, uploaded_by")
        .order("uploaded_at", { ascending: false })
        .limit(500);
      if (customer) {
        query = query.eq("customer_id", customer.id);
      } else if (email) {
        query = query.eq("uploaded_by", email);
      } else {
        warnings.push("uploads skipped: no customer mapping and no account email for fallback.");
        return [] as UploadRow[];
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as UploadRow[];
    } catch (error) {
      const message = extractErrorMessage(error);
      if (!isMissingTableError(error)) warnings.push(`uploads query failed: ${message}`);
      return [] as UploadRow[];
    }
  })();

  const invoicePromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("finance_invoices")
        .select("invoice, usd, status_type, invoice_date, customer_name")
        .order("invoice_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const rows = ((data ?? []) as InvoiceRow[]);
      if (customer) {
        return rows.filter((row) => includeByCompany(row.customer_name, customer.company_name));
      }
      if (!identityTerms.length) {
        warnings.push("finance_invoices not scoped: no customer mapping terms.");
        return [] as InvoiceRow[];
      }
      return rows.filter((row) => includeByTerms(row.customer_name, identityTerms));
    } catch (error) {
      const message = extractErrorMessage(error);
      if (!isMissingTableError(error)) warnings.push(`finance_invoices query failed: ${message}`);
      return [] as InvoiceRow[];
    }
  })();

  const stockPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("stock")
        .select("*")
        .limit(2000);
      if (error) throw error;
      const rows = (data ?? []) as StockDbRow[];

      if (customer) {
        const byCustomerId = rows.filter((row) => {
          const customerId = toStringOrNull(row.customer_id);
          return customerId ? normalize(customerId) === normalize(customer.id) : false;
        });
        if (byCustomerId.length > 0) return byCustomerId.map(mapStockRow);

        const byCustomerName = rows.filter((row) => {
          const customerName =
            toStringOrNull(row.customer_name) ??
            toStringOrNull(row.company_name) ??
            toStringOrNull(row.importer);
          return includeByCompany(customerName, customer.company_name);
        });
        if (byCustomerName.length > 0) return byCustomerName.map(mapStockRow);

        warnings.push("stock table has no customer mapping; showing shared stock data.");
        return rows.map(mapStockRow);
      }

      if (!identityTerms.length) {
        warnings.push("stock skipped: no customer mapping terms.");
        return [] as StockRow[];
      }

      const byIdentity = rows.filter((row) => {
        const candidates = [
          toStringOrNull(row.customer_name),
          toStringOrNull(row.company_name),
          toStringOrNull(row.importer),
          toStringOrNull(row.owner_email),
          toStringOrNull(row.email),
        ];
        return candidates.some((candidate) => includeByTerms(candidate, identityTerms));
      });

      if (byIdentity.length > 0) return byIdentity.map(mapStockRow);
      warnings.push("stock not scoped: missing customer key in stock table; fallback to shared stock data.");
      return rows.map(mapStockRow);
    } catch (error) {
      const message = extractErrorMessage(error);
      if (!isMissingTableError(error)) warnings.push(`stock query failed: ${message}`);
      return [] as StockRow[];
    }
  })();

  const marketPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("purchase_trend")
        .select("date, weight_kg, destination_country, product, importer")
        .order("date", { ascending: false })
        .limit(1500);
      if (error) throw error;
      const rows = (data ?? []) as PurchaseTrendRow[];
      if (customer) {
        return rows.filter((row) => includeByCompany(row.importer, customer.company_name));
      }
      if (!identityTerms.length) {
        warnings.push("purchase_trend not scoped: no customer mapping terms.");
        return [] as PurchaseTrendRow[];
      }
      return rows.filter((row) => includeByTerms(row.importer, identityTerms));
    } catch (error) {
      const message = extractErrorMessage(error);
      if (!isMissingTableError(error)) warnings.push(`purchase_trend query failed: ${message}`);
      return [] as PurchaseTrendRow[];
    }
  })();

  const [uploads, invoices, stock, market] = await Promise.all([
    uploadsPromise,
    invoicePromise,
    stockPromise,
    marketPromise,
  ]);

  const supplementalEntries = await Promise.all(
    SUPPLEMENTAL_TABLES.map(async (table) => {
      try {
        let data: GenericRow[] | null = null;
        let error: unknown = null;

        if (table === "contract_lines") {
          const res = await supabase
            .from("contract_lines")
            .select("line_id, contract_id, job, status, ton, acc, date_to, contracts(customer)")
            .order("date_to", { ascending: true })
            .limit(3000);
          data = (res.data ?? []) as GenericRow[];
          error = res.error;
        } else if (table === "deliveries") {
          const res = await supabase
            .from("deliveries")
            .select("*")
            .order("delivery_date", { ascending: false })
            .limit(2000);
          data = (res.data ?? []) as GenericRow[];
          error = res.error;
        } else if (table === "finance_invoices") {
          const res = await supabase
            .from("finance_invoices")
            .select("invoice, usd, status_type, invoice_date, customer_name")
            .order("invoice_date", { ascending: false })
            .limit(2000);
          data = (res.data ?? []) as GenericRow[];
          error = res.error;
        } else {
          const res = await supabase.from(table).select("*").limit(1000);
          data = (res.data ?? []) as GenericRow[];
          error = res.error;
        }

        if (error) throw error;
        const rows = data ?? [];

        if (GLOBAL_SUPPLEMENTAL_TABLES.has(table)) {
          return [table, rows] as const;
        }

        const scopedRows = rows.filter((row) => rowMatchesCustomerScope(row, customer, identityTerms));
        return [table, scopedRows] as const;
      } catch (error) {
        if (!isMissingTableError(error)) {
          warnings.push(`${table} query failed: ${extractErrorMessage(error)}`);
        }
        return [table, [] as GenericRow[]] as const;
      }
    }),
  );
  const supplemental = Object.fromEntries(supplementalEntries) as Record<string, GenericRow[]>;

  const uploadStats = calcUploadStats(uploads);
  const invoiceStats = calcInvoiceStats(invoices);
  const stockStats = calcStockStats(stock);
  const marketStats = calcMarketStats(market);

  return {
    loadedAt: new Date().toISOString(),
    customer,
    uploads,
    invoices,
    stock,
    market,
    uploadStats,
    invoiceStats,
    stockStats,
    marketStats,
    supplemental,
    warnings,
  };
}

function extractOverdueOrders(rows: GenericRow[]): ContractOverdueRow[] {
  const nowMs = new Date().setHours(0, 0, 0, 0);
  return rows
    .map((row) => {
      const status = String(row.status ?? "");
      const normalized = status.toLowerCase();
      const dueDate = toStringOrNull(row.date_to);
      const dueMs = toDayMs(dueDate);
      const ton = toNumber(row.ton as number | string | null | undefined);
      const acc = toNumber(row.acc as number | string | null | undefined);
      const remaining = ton - acc;
      const isMarkedOverdue = normalized.includes("overdue");
      const isPastDuePending = normalized.includes("pending") && dueMs !== null && dueMs < nowMs && remaining > 0;
      if (!isMarkedOverdue && !isPastDuePending) return null;

      const contractRelation = row.contracts as { customer?: unknown }[] | { customer?: unknown } | null | undefined;
      const contractCustomer = Array.isArray(contractRelation)
        ? toStringOrNull(contractRelation[0]?.customer)
        : toStringOrNull(contractRelation?.customer);

      return {
        contract_id: toStringOrNull(row.contract_id) ?? "-",
        job: toStringOrNull(row.job) ?? "-",
        customer: contractCustomer ?? toStringOrNull(row.customer_name) ?? "-",
        status: status || "-",
        date_to: dueDate,
        remaining_ton: remaining,
      } satisfies ContractOverdueRow;
    })
    .filter((row): row is ContractOverdueRow => Boolean(row))
    .sort((a, b) => {
      const da = toDayMs(a.date_to) ?? Number.MAX_SAFE_INTEGER;
      const db = toDayMs(b.date_to) ?? Number.MAX_SAFE_INTEGER;
      return da - db;
    });
}

function buildSummaryReply(snapshot: AgentDataSnapshot) {
  const companyName = snapshot.customer?.company_name || "Customer Account";
  const contractCount = snapshot.supplemental.contract_lines?.length ?? 0;
  const deliveryCount = snapshot.supplemental.deliveries?.length ?? 0;
  const activityCount = snapshot.supplemental.activity_logs?.length ?? 0;
  const companyTableCount = (snapshot.supplemental.companies?.length ?? 0) + (snapshot.supplemental.supabase_companies?.length ?? 0);
  return [
    `สรุปภาพรวมล่าสุดของ ${companyName}`,
    `- Uploads: ${formatNumber(snapshot.uploadStats.total)} ไฟล์ | Pending review ${formatNumber(snapshot.uploadStats.pendingReview)} | Approved ${formatNumber(snapshot.uploadStats.approved)}`,
    `- Invoices: ${formatNumber(snapshot.invoiceStats.total)} ใบ | Pending ${formatNumber(snapshot.invoiceStats.pendingCount)} | Overdue ${formatNumber(snapshot.invoiceStats.overdueCount)} | Total ${formatCurrency(snapshot.invoiceStats.totalUsd)}`,
    `- Inventory: ${formatNumber(snapshot.stockStats.itemCount)} รายการ | ปริมาณรวม ${formatNumber(snapshot.stockStats.totalQty)} MT`,
    `- Market: ${formatNumber(snapshot.marketStats.rowCount)} records | 30 วันล่าสุด ${formatNumber(snapshot.marketStats.current30dWeight)} KG`,
    `- Project tables: Contracts ${formatNumber(contractCount)} | Deliveries ${formatNumber(deliveryCount)} | Activity ${formatNumber(activityCount)} | Companies ${formatNumber(companyTableCount)}`,
    "",
    "ถามต่อได้เลย เช่น `Orders & Shipments overdue มีอะไรบ้าง`, `มีรายการอะไรที่ overdue บ้าง`, `สรุป delivery ล่าสุด`",
  ].join("\n");
}

function buildInvoiceReply(snapshot: AgentDataSnapshot) {
  const rows = getInvoiceRowsForAnalysis(snapshot);
  const stats = calcInvoiceStats(rows);
  return [
    "วิเคราะห์ Invoices & Payments",
    `- จำนวนใบแจ้งหนี้ทั้งหมด: ${formatNumber(stats.total)} ใบ`,
    `- Pending: ${formatNumber(stats.pendingCount)} ใบ`,
    `- Overdue (>3 วัน): ${formatNumber(stats.overdueCount)} ใบ`,
    `- มูลค่ารวม: ${formatCurrency(stats.totalUsd)}`,
    `- ใบล่าสุด: ${formatDate(stats.latestInvoiceDate)}`,
  ].join("\n");
}

const toInvoiceRow = (row: Record<string, unknown>): InvoiceRow => ({
  invoice: toStringOrNull(row.invoice),
  usd: typeof row.usd === "number" ? row.usd : typeof row.usd === "string" ? Number(row.usd) : null,
  status_type: toStringOrNull(row.status_type),
  invoice_date: toStringOrNull(row.invoice_date),
  customer_name: toStringOrNull(row.customer_name),
});

const getInvoiceRowsForAnalysis = (snapshot: AgentDataSnapshot) => {
  const supplementalRows = (snapshot.supplemental.finance_invoices ?? []).map((row) => toInvoiceRow(row));
  if (supplementalRows.length > 0) return supplementalRows;
  return snapshot.invoices;
};

const extractInvoiceCustomerHint = (question: string) => {
  const phraseMatch = question.match(
    /(?:detail|details|info|information|customer|client|company|for|ของ|ลูกค้า|รายละเอียด)\s+([A-Za-z0-9][A-Za-z0-9 .,&'()/-]{1,80})/i,
  );
  if (phraseMatch?.[1]) {
    const cleaned = phraseMatch[1]
      .replace(/\s+(please|pls|หน่อย|ครับ|ค่ะ|คะ)$/i, "")
      .trim();
    if (cleaned.length >= 2) return cleaned;
  }

  const upperMatches = question.match(/\b[A-Z][A-Z0-9&()./-]{2,}\b/g) ?? [];
  const blacklist = new Set(["AI", "ORIGO", "TRR", "USD", "MT"]);
  const upperToken = upperMatches.find((token) => !blacklist.has(token.toUpperCase()));
  if (upperToken) return upperToken;

  return null;
};

const resolveRequestedInvoiceCustomer = (question: string, rows: InvoiceRow[]) => {
  const customerNames = [...new Set(rows.map((row) => String(row.customer_name || "").trim()).filter(Boolean))];
  if (customerNames.length === 0) return extractInvoiceCustomerHint(question);

  const direct = findMentionedCandidate(question, customerNames);
  if (direct) return direct;

  const hinted = extractInvoiceCustomerHint(question);
  if (!hinted) return null;
  const nHinted = normalize(hinted);
  return customerNames.find((name) => normalize(name).includes(nHinted) || nHinted.includes(normalize(name))) ?? hinted;
};

const shouldAttemptInvoiceCustomerDetail = (question: string, snapshot: AgentDataSnapshot) => {
  const rows = getInvoiceRowsForAnalysis(snapshot);
  return Boolean(resolveRequestedInvoiceCustomer(question, rows));
};

function buildInvoiceCustomerDetailReply(question: string, snapshot: AgentDataSnapshot) {
  const rows = getInvoiceRowsForAnalysis(snapshot);
  const requestedCustomer = resolveRequestedInvoiceCustomer(question, rows);
  if (rows.length === 0) {
    if (requestedCustomer) return `ยังไม่มีข้อมูลใบแจ้งหนี้ของ ${requestedCustomer} ในระบบ`;
    return "ไม่พบข้อมูล Invoices & Payments ในระบบ";
  }

  if (!requestedCustomer || requestedCustomer.length < 2) {
    return [
      "ยังไม่พบชื่อลูกค้าในคำถาม",
      "ลองพิมพ์เช่น `ขอรายละเอียด ALVEAN` หรือ `รายละเอียดลูกค้า COFCO`",
    ].join("\n");
  }

  const targetRows = rows.filter((row) => includeByTerms(row.customer_name, [normalize(requestedCustomer)]));
  if (targetRows.length === 0) return `ไม่พบข้อมูลใบแจ้งหนี้ของ ${requestedCustomer} ใน Invoices & Payments`;

  const totalUsd = targetRows.reduce((sum, row) => sum + toNumber(row.usd), 0);
  const pendingCount = targetRows.filter((row) => isPendingInvoice(row.status_type)).length;
  const overdueCount = targetRows.filter((row) => isOverdueInvoice(row.status_type, row.invoice_date)).length;
  const latestDate = targetRows
    .map((row) => row.invoice_date)
    .filter(Boolean)
    .sort((a, b) => (a! > b! ? -1 : 1))[0] ?? null;

  const statusMap = new Map<string, number>();
  targetRows.forEach((row) => {
    const status = String(row.status_type || "Unknown").trim() || "Unknown";
    statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
  });
  const statusSummary = [...statusMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([status, count]) => `${status} ${count}`)
    .join(" | ");

  const latestInvoices = [...targetRows]
    .sort((a, b) => (String(a.invoice_date || "") > String(b.invoice_date || "") ? -1 : 1))
    .slice(0, 8)
    .map((row, index) => {
      const invoiceNo = row.invoice || "(no-invoice-no)";
      const amount = formatCurrency(toNumber(row.usd));
      const status = row.status_type || "Unknown";
      return `${index + 1}. ${invoiceNo} | ${amount} | ${status} | ${formatDate(row.invoice_date)}`;
    });

  return [
    `รายละเอียดลูกค้า ${requestedCustomer} (Invoices & Payments)`,
    `- จำนวนใบแจ้งหนี้: ${formatNumber(targetRows.length)} ใบ`,
    `- Pending: ${formatNumber(pendingCount)} | Overdue: ${formatNumber(overdueCount)}`,
    `- มูลค่ารวม: ${formatCurrency(totalUsd)}`,
    `- ใบล่าสุด: ${formatDate(latestDate)}`,
    statusSummary ? `- สถานะหลัก: ${statusSummary}` : "",
    "",
    "ใบล่าสุด:",
    ...latestInvoices,
  ].filter(Boolean).join("\n");
}

function buildOverdueInvoiceListReply(snapshot: AgentDataSnapshot, hideWhenEmpty = false) {
  const overdueRows = getInvoiceRowsForAnalysis(snapshot)
    .filter((row) => isOverdueInvoice(row.status_type, row.invoice_date))
    .sort((a, b) => {
      const da = toDate(a.invoice_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const db = toDate(b.invoice_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return da - db;
    });

  if (overdueRows.length === 0) {
    if (hideWhenEmpty) return "";
    return [
      "ไม่พบรายการ Overdue ตามเงื่อนไขปัจจุบัน",
      "เกณฑ์ที่ใช้: status เป็น pending และเลย invoice_date มากกว่า 3 วัน",
    ].join("\n");
  }

  const lines = overdueRows.slice(0, 15).map((row, index) => {
    const invoiceNo = row.invoice || "(no-invoice-no)";
    const customerName = row.customer_name || "(no-customer-name)";
    const amount = formatCurrency(toNumber(row.usd));
    const days = overdueDays(row.invoice_date);
    return `${index + 1}. ${invoiceNo} | ${customerName} | ${amount} | due ${formatDate(row.invoice_date)} | overdue ${days} days`;
  });

  return [
    `พบรายการ Overdue ${overdueRows.length} รายการ`,
    ...lines,
    overdueRows.length > 15 ? `...และอีก ${overdueRows.length - 15} รายการ` : "",
  ].filter(Boolean).join("\n");
}

function buildOverdueOrdersReply(snapshot: AgentDataSnapshot) {
  const contractRows = snapshot.supplemental.contract_lines ?? [];
  const overdueRows = extractOverdueOrders(contractRows);

  if (overdueRows.length === 0) {
    return [
      "Orders & Shipments Overdue: ไม่พบรายการ",
      "เกณฑ์ที่ใช้: status = overdue หรือ status = pending ที่เลย date_to และ remaining ton > 0",
    ].join("\n");
  }

  const lines = overdueRows.slice(0, 20).map((row, index) => (
    `${index + 1}. ${row.contract_id} | Job ${row.job} | ${row.customer} | due ${formatDate(row.date_to)} | remaining ${formatNumber(row.remaining_ton)} MT`
  ));

  return [
    `Orders & Shipments Overdue: ${overdueRows.length} รายการ`,
    ...lines,
    overdueRows.length > 20 ? `...และอีก ${overdueRows.length - 20} รายการ` : "",
  ].filter(Boolean).join("\n");
}

function buildUploadReply(snapshot: AgentDataSnapshot) {
  const stats = snapshot.uploadStats;
  return [
    "วิเคราะห์ Upload Center",
    `- ไฟล์ทั้งหมด: ${formatNumber(stats.total)} ไฟล์`,
    `- Pending review/processing: ${formatNumber(stats.pendingReview)} ไฟล์`,
    `- Approved: ${formatNumber(stats.approved)} ไฟล์`,
    `- Rejected/Changes requested: ${formatNumber(stats.rejectedOrChanges)} ไฟล์`,
    `- อัปโหลดล่าสุด: ${formatDate(stats.latestUploadAt)}`,
  ].join("\n");
}

function buildStockReply(snapshot: AgentDataSnapshot) {
  const stats = snapshot.stockStats;
  const top = stats.topFactories.length
    ? stats.topFactories.map((item, index) => `${index + 1}) ${item.factory}: ${formatNumber(item.qty)} MT`).join(" | ")
    : "ไม่มีข้อมูล factory";
  return [
    "วิเคราะห์ Inventory",
    `- รายการ stock: ${formatNumber(stats.itemCount)} รายการ`,
    `- ปริมาณรวม: ${formatNumber(stats.totalQty)} MT`,
    `- Top factories: ${top}`,
  ].join("\n");
}

const findRequestedFactory = (question: string, rows: StockRow[]) => {
  const q = normalize(question);
  const factories = [...new Set(rows.map((row) => String(row.factory || "").trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  return factories.find((factory) => q.includes(normalize(factory))) ?? null;
};

function buildStockDetailReply(question: string, snapshot: AgentDataSnapshot) {
  if (snapshot.stock.length === 0) return buildStockReply(snapshot);

  const requestedFactory = findRequestedFactory(question, snapshot.stock);
  const filtered = requestedFactory
    ? snapshot.stock.filter((row) => normalize(String(row.factory || "")) === normalize(requestedFactory))
    : snapshot.stock;

  if (filtered.length === 0) {
    return requestedFactory
      ? `ไม่พบสินค้าในคลัง ${requestedFactory}`
      : "ไม่พบข้อมูลสินค้าในคลัง";
  }

  const sorted = [...filtered].sort((a, b) => toNumber(b.qty) - toNumber(a.qty));
  const lines = sorted.slice(0, 20).map((row, index) => {
    const factory = row.factory || "-";
    const type = row.type || "-";
    const tag = row.tag || "-";
    return `${index + 1}. ${factory} | ${type} | tag ${tag} | ${formatNumber(toNumber(row.qty))} MT`;
  });

  return [
    requestedFactory
      ? `สินค้าในคลัง ${requestedFactory}: ${filtered.length} รายการ`
      : `สินค้าในคลัง: ${filtered.length} รายการ`,
    ...lines,
    filtered.length > 20 ? `...และอีก ${filtered.length - 20} รายการ` : "",
  ].filter(Boolean).join("\n");
}

function buildMarketReply(snapshot: AgentDataSnapshot) {
  const stats = snapshot.marketStats;
  const top = stats.topMarkets.length
    ? stats.topMarkets.map((item, index) => `${index + 1}) ${item.market}: ${formatNumber(item.weight)} KG`).join(" | ")
    : "ไม่มีข้อมูลตลาด";
  return [
    "วิเคราะห์ Market Trend (จาก purchase_trend)",
    `- ข้อมูลล่าสุดถึง: ${formatDate(stats.latestDate)}`,
    `- ปริมาณ 30 วันล่าสุด: ${formatNumber(stats.current30dWeight)} KG`,
    `- ปริมาณ 30 วันก่อนหน้า: ${formatNumber(stats.previous30dWeight)} KG`,
    `- Trend change: ${stats.previous30dWeight > 0 ? `${stats.trendPct.toFixed(1)}%` : "เทียบไม่ได้ (ฐานก่อนหน้าเป็น 0)"}`,
    `- Top markets: ${top}`,
  ].join("\n");
}

function buildSupplementalReply(snapshot: AgentDataSnapshot, table: string, title: string) {
  const rows = snapshot.supplemental[table] ?? [];
  if (rows.length === 0) {
    return `${title}\n- ไม่พบข้อมูลใน scope ของบัญชีนี้`;
  }

  if (table === "contract_lines") {
    const preview = rows.slice(0, 8).map((row, index) => {
      const contractId = toStringOrNull(row.contract_id) ?? "-";
      const job = toStringOrNull(row.job) ?? "-";
      const status = toStringOrNull(row.status) ?? "-";
      const ton = toNumber((row.ton as number | string | null | undefined) ?? null);
      const acc = toNumber((row.acc as number | string | null | undefined) ?? null);
      const remaining = ton - acc;
      const due = toStringOrNull(row.date_to);
      const contracts = row.contracts;
      const customer =
        Array.isArray(contracts) && contracts[0] && typeof contracts[0] === "object"
          ? toStringOrNull((contracts[0] as Record<string, unknown>).customer) ?? "-"
          : "-";

      const suffix: string[] = [];
      if (status && status !== "-") suffix.push(status);
      if (remaining > 0) suffix.push(`remaining ${formatNumber(remaining)} MT`);
      if (due) suffix.push(`due ${formatDate(due)}`);

      return `${index + 1}. ${contractId} | Job ${job} | ${customer} | ${suffix.join(" | ")}`;
    });

    return [
      title,
      `- จำนวนรายการ: ${formatNumber(rows.length)}`,
      "- ตัวอย่างข้อมูลล่าสุด:",
      ...preview,
    ].join("\n");
  }

  const preview = rows.slice(0, 5).map((row, index) => {
    const values = objectValues(row).slice(0, 4).map((value) => String(value)).join(" | ");
    return `${index + 1}. ${values || "-"}`;
  });

  return [
    title,
    `- จำนวนรายการ: ${formatNumber(rows.length)}`,
    "- ตัวอย่างข้อมูลล่าสุด:",
    ...preview,
  ].join("\n");
}

export function buildAgentReply(question: string, snapshot: AgentDataSnapshot, topic: AgentTopic = "all") {
  const q = normalize(question);
  const has = (pattern: RegExp) => pattern.test(q);
  const warnings = "";
  const helpIntent = has(/help|ทำอะไรได้|ใช้ยังไง|ทำอะไรได้บ้าง/);
  const overdueIntent = has(/over\s*due|overdue|past\s*due|ค้างชำระ|ค้าง|เลยกำหนด/);
  const listIntent = has(/มีอะไรบ้าง|อะไรบ้าง|รายการ|list|detail|details|แสดง|show/);
  const detailIntent = has(/รายละเอียด|detail|info|ข้อมูล|customer|ลูกค้า/);
  const invoiceIntent = has(/invoice|payment|bill|ใบแจ้งหนี้|ชำระ/);
  const ordersIntent = has(/order|orders|shipment|shipments|สัญญา|ส่งมอบ|ขนส่ง/);
  const uploadIntent = has(/upload|file|review|ไฟล์|อัปโหลด/);
  const stockIntent = has(/inventory|stock|warehouse|คลัง|สต๊อก/);
  const marketIntent = has(/market|trend|export|import|ตลาด|แนวโน้ม|ประเทศ/);
  const customerListIntent = has(/รายชื่อลูกค้า|ลูกค้าทั้งหมด|customer list|list customer|prospect|lead|ลูกค้าที่ origo|origo หา/);
  const trrIntent = has(/thai roong ruang|trr|ทีอาร์อาร์|ไทยรุ่งเรือง/);
  const performanceIntent = has(/performance|ผลการดำเนินงาน|ผลงาน|ประสิทธิภาพ|ภาพรวมบริษัท/);
  const summaryIntent = has(/summary|overall|ภาพรวม|สรุป/);
  const hasExplicitIntent =
    customerListIntent ||
    ordersIntent ||
    invoiceIntent ||
    stockIntent ||
    uploadIntent ||
    (marketIntent && !stockIntent && !ordersIntent && !invoiceIntent);

  // If user question clearly points to another module, prefer the explicit intent over selected topic chip.
  if (topic !== "all" && hasExplicitIntent) {
    if (stockIntent) {
      if (listIntent || has(/มีอะไรบ้าง|อะไรบ้าง|sb|คลัง/)) return buildStockDetailReply(question, snapshot) + warnings;
      return buildStockReply(snapshot) + warnings;
    }
    if (ordersIntent) {
      if (overdueIntent || listIntent) return buildOverdueOrdersReply(snapshot) + warnings;
      return buildSupplementalReply(snapshot, "contract_lines", "วิเคราะห์ Orders & Shipments") + warnings;
    }
    if (invoiceIntent) {
      if (detailIntent || shouldAttemptInvoiceCustomerDetail(question, snapshot)) return buildInvoiceCustomerDetailReply(question, snapshot) + warnings;
      if (overdueIntent || listIntent) return buildOverdueInvoiceListReply(snapshot) + warnings;
      return buildInvoiceReply(snapshot) + warnings;
    }
    if (customerListIntent) return buildMarketCustomerListReply(question, snapshot) + warnings;
    if (marketIntent) return buildMarketIntelligenceReply(question, snapshot) + warnings;
  }

  if (topic === "market_intelligence") {
    if (customerListIntent) return buildMarketCustomerListReply(question, snapshot) + warnings;
    return buildMarketIntelligenceReply(question, snapshot) + warnings;
  }

  if (topic === "orders_shipments") {
    if (overdueIntent || listIntent) return buildOverdueOrdersReply(snapshot) + warnings;
    return buildSupplementalReply(snapshot, "contract_lines", "วิเคราะห์ Orders & Shipments") + warnings;
  }

  if (topic === "inventory") {
    if (listIntent || has(/มีอะไรบ้าง|อะไรบ้าง|sb|คลัง/)) return buildStockDetailReply(question, snapshot) + warnings;
    return buildStockReply(snapshot) + warnings;
  }

  if (topic === "invoices_payments") {
    if (detailIntent || shouldAttemptInvoiceCustomerDetail(question, snapshot)) return buildInvoiceCustomerDetailReply(question, snapshot) + warnings;
    if (overdueIntent || listIntent) return buildOverdueInvoiceListReply(snapshot) + warnings;
    return buildInvoiceReply(snapshot) + warnings;
  }

  if (helpIntent) {
    return [
      "ฉันวิเคราะห์ข้อมูลจากฐานข้อมูลของคุณได้ 4 ส่วนหลัก:",
      "- Uploads (pending/approved/review)",
      "- Invoices & Payments (pending/overdue/total USD)",
      "- Orders & Shipments (contract_lines / deliveries)",
      "- Inventory (ปริมาณรวม + top factories)",
      "- Market trend (30d vs previous 30d จาก purchase_trend)",
      "- Market Intelligence customer list (แยกตามสถานะลูกค้า)",
      "- TRR company performance summary",
      "- Project tables เสริม: contracts, deliveries, activity logs, companies",
      "",
      "ลองถาม: `ขอรายชื่อลูกค้าใน Market Intelligence`, `สรุป performance ของ TRR`, `Orders & Shipments overdue มีอะไรบ้าง`",
    ].join("\n") + warnings;
  }

  if ((trrIntent && (performanceIntent || summaryIntent || marketIntent || ordersIntent || invoiceIntent)) || has(/trr performance|performance trr|performance ของ trr/)) {
    return buildTRRPerformanceReply(snapshot) + warnings;
  }

  if (customerListIntent && !invoiceIntent && !ordersIntent && !uploadIntent && !stockIntent) {
    return buildMarketCustomerListReply(question, snapshot) + warnings;
  }

  if (overdueIntent && listIntent && ordersIntent) {
    return buildOverdueOrdersReply(snapshot) + warnings;
  }

  if (overdueIntent && listIntent) {
    const ordersReply = buildOverdueOrdersReply(snapshot);
    const invoiceReply = buildOverdueInvoiceListReply(snapshot, true);
    return [ordersReply, invoiceReply ? `\n${invoiceReply}` : ""].join("") + warnings;
  }

  if (ordersIntent && overdueIntent) {
    return buildOverdueOrdersReply(snapshot) + warnings;
  }

  if (ordersIntent) {
    return buildSupplementalReply(snapshot, "contract_lines", "วิเคราะห์ Orders & Shipments") + warnings;
  }

  if (overdueIntent && invoiceIntent) {
    return buildOverdueInvoiceListReply(snapshot) + warnings;
  }

  if ((detailIntent || shouldAttemptInvoiceCustomerDetail(question, snapshot)) && topic === "all") {
    const detailReply = buildInvoiceCustomerDetailReply(question, snapshot);
    if (!detailReply.startsWith("ยังไม่พบชื่อลูกค้าในคำถาม")) return detailReply + warnings;
  }

  if (invoiceIntent || overdueIntent) {
    return buildInvoiceReply(snapshot) + warnings;
  }

  if (uploadIntent) {
    return buildUploadReply(snapshot) + warnings;
  }

  if (stockIntent) {
    if (listIntent || has(/มีอะไรบ้าง|อะไรบ้าง|sb|คลัง/)) return buildStockDetailReply(question, snapshot) + warnings;
    return buildStockReply(snapshot) + warnings;
  }

  if (marketIntent) {
    return buildMarketIntelligenceReply(question, snapshot) + warnings;
  }

  if (has(/contract|สัญญา/)) {
    return buildSupplementalReply(snapshot, "contract_lines", "วิเคราะห์ Contract Lines") + warnings;
  }

  if (has(/deliver|shipment|ส่งมอบ|ขนส่ง/)) {
    return buildSupplementalReply(snapshot, "deliveries", "วิเคราะห์ Deliveries") + warnings;
  }

  if (has(/activity|log|กิจกรรม/)) {
    return buildSupplementalReply(snapshot, "activity_logs", "วิเคราะห์ Activity Logs") + warnings;
  }

  if (has(/company|บริษัท/)) {
    const companiesRows = [
      ...(snapshot.supplemental.companies ?? []),
      ...(snapshot.supplemental.supabase_companies ?? []),
    ];
    if (companiesRows.length === 0) return "วิเคราะห์ Company Profile\n- ไม่พบข้อมูลบริษัทใน scope ของบัญชีนี้" + warnings;
    const preview = companiesRows.slice(0, 5).map((row, index) => `${index + 1}. ${objectValues(row).slice(0, 4).join(" | ")}`);
    return [
      "วิเคราะห์ Company Profile",
      `- จำนวนรายการ: ${formatNumber(companiesRows.length)}`,
      "- ตัวอย่างข้อมูล:",
      ...preview,
    ].join("\n") + warnings;
  }

  if (summaryIntent) {
    return buildSummaryReply(snapshot) + warnings;
  }

  return [
    `ยังตีความคำถามนี้ไม่ชัดเจน: "${question}"`,
    "กรุณาระบุหมวดข้อมูลที่ต้องการให้ชัด เช่น Upload, Invoice, Inventory หรือ Market",
    "ตัวอย่าง: `มีรายการอะไรที่ overdue บ้าง`, `สรุป upload ที่ pending`, `แนวโน้มตลาด 30 วันล่าสุด`",
  ].join("\n") + warnings;
}
