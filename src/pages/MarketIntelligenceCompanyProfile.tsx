import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, ExternalLink, Globe, Mail, MapPin, Phone, Sparkles, User } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type CompanyOverviewRow = {
  company_id: string;
  company_introduction: string | null;
  business_overview: string | null;
  employee_size: number | null;
  procurement_overview: string | null;
  total_purchase_value: number | null;
  purchase_value_last_12m: number | null;
  purchase_frequency_per_year: number | null;
  latest_purchase_date: string | null;
  purchase_interval_days: number | null;
  is_active: boolean | null;
  trade_start_date: string | null;
  trade_end_date: string | null;
  core_products: string[] | null;
  core_supplier_countries: string[] | null;
  core_suppliers: string[] | null;
  growth_rate_last_3m: number | null;
  yoy_growth_rate: number | null;
  recent_trends?: number | null;
  purchasing_trend?: number | null;
  purchase_stability: string | null;
  purchase_activity?: string | null;
  purchase_activity_label: string | null;
  indicator_review: string | null;
  procurement_structure: string | null;
  updated_at: string | null;
};

type CompanyBasicInfoRow = {
  company_id: string;
  company_name: string | null;
  name_standard?: string | null;
  name_en?: string | null;
  location: string | null;
  website: string | null;
  operating_status?: string | null;
  address?: string | null;
  organization_type?: string | null;
  zip_code?: string | null;
  founded?: string | null;
  employees?: string | null;
  company_profile?: string | null;
  twitter: string | null;
  instagram: string | null;
  facebook: string | null;
  created_at?: string | null;
  updated_at: string | null;
};

type CompanyContactRow = {
  id?: string;
  company_id: string;
  name: string | null;
  position: string | null;
  department: string | null;
  employment_date: string | null;
  business_email: string | null;
  supplement_email_1: string | null;
  supplement_email_2: string | null;
  social_media: string | null;
  tel?: string | null;
  fax?: string | null;
  whatsapp?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  region: string | null;
  created_at: string | null;
};

type CompanyEmailRow = {
  id: string;
  company_id: string;
  email: string | null;
  importance: string | null;
  source_description: string | null;
  source: string | null;
  created_at: string | null;
};

type PurchaseTrendRow = {
  id?: string;
  company_id: string;
  date: string | null;
  importer: string | null;
  exporter: string | null;
  hs_code: string | null;
  product: string | null;
  product_description: string | null;
  origin_country: string | null;
  destination_country: string | null;
  total_price_usd: number | null;
  weight_kg: number | null;
  quantity: number | null;
  unit_price_usd_kg: number | null;
  unit_price_usd_qty: number | null;
  quantity_unit: string | null;
  created_at: string | null;
};

type SupplyChainRow = {
  id: string;
  company_id: string;
  exporter: string | null;
  trades_sum: number | null;
  trade_frequency_ratio: number | null;
  kg_weight: number | null;
  weight_ratio: number | null;
  quantity: number | null;
  quantity_ratio: number | null;
  total_price_usd: number | null;
  total_price_ratio: number | null;
  supplier_name: string | null;
  supplier_country: string | null;
  relationship_type: string | null;
  product: string | null;
  hs_code: string | null;
  incoterm: string | null;
  lead_time_days: number | null;
  risk_level: string | null;
  last_shipment_date: string | null;
  volume_mt: number | null;
  total_value_usd: number | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
};

type GenericSupabaseRow = Record<string, unknown>;

type CompanyMasterRow = {
  company_id: string;
  customer?: string | null;
  customer_name?: string | null;
  location?: string | null;
  customer_location?: string | null;
  website?: string | null;
  trades?: number | string | null;
  supplier_number?: number | string | null;
  value_tag?: string | null;
  latest_purchase_time?: string | null;
  product?: string | null;
  product_description?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const formatNumber = (value?: number | null) =>
  typeof value === "number" ? new Intl.NumberFormat("en-US").format(value) : "—";

const formatCurrency = (value?: number | null) =>
  typeof value === "number"
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
    : "—";

const formatPercent = (value?: number | null) =>
  typeof value === "number" ? `${value.toFixed(1)}%` : "—";

const formatRatio = (value?: number | null) =>
  typeof value === "number"
    ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`
    : "—";

const numeric = (value?: number | string | null) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(parsed);
};

const normalizeUrl = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  const normalized = trimmed.toLowerCase();
  if (!trimmed) return undefined;
  if (["-", "--", "n/a", "na", "none", "null", "undefined"].includes(normalized)) {
    return undefined;
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const pickFirstText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
};

const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const getCandidateValue = (row: GenericSupabaseRow, candidates: string[]) => {
  const entries = Object.entries(row);
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeKey(candidate);
    const matched = entries.find(([key]) => normalizeKey(key) === normalizedCandidate);
    if (!matched) continue;
    const value = matched[1];
    if (value === null || value === undefined || value === "") continue;
    return value;
  }
  return undefined;
};

const toTextOrNull = (value: unknown) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
};

const toNumberOrNull = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const sanitized = value.replace(/,/g, "").trim();
    if (!sanitized) return null;
    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isMissingTableError = (error: { code?: string; message?: string } | null) => {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  return /could not find the table|relation .* does not exist|schema cache/i.test(error.message ?? "");
};

const isMissingColumnError = (error: { code?: string; message?: string } | null) => {
  if (!error) return false;
  return /column .* does not exist|could not find .*column|schema cache/i.test(error.message ?? "");
};

const mapPurchaseHistoryRow = (row: GenericSupabaseRow, fallbackCompanyId: string, index: number): PurchaseTrendRow => {
  const company = toTextOrNull(getCandidateValue(row, ["company_id", "companyid"])) ?? fallbackCompanyId;

  return {
    id: toTextOrNull(getCandidateValue(row, ["id", "history_id", "line_id"])) ?? `history-${company}-${index}`,
    company_id: company,
    date: toTextOrNull(getCandidateValue(row, ["date", "trade_date", "purchase_date", "invoice_date", "shipment_date", "month"])),
    importer: toTextOrNull(getCandidateValue(row, ["importer", "company_name", "customer", "buyer"])),
    exporter: toTextOrNull(getCandidateValue(row, ["exporter", "supplier", "vendor", "counterparty"])),
    hs_code: toTextOrNull(getCandidateValue(row, ["hs_code", "hscode", "hs"])),
    product: toTextOrNull(getCandidateValue(row, ["product", "product_name", "item"])),
    product_description: toTextOrNull(getCandidateValue(row, ["product_description", "description"])),
    origin_country: toTextOrNull(getCandidateValue(row, ["origin_country", "supplier_country", "origin"])),
    destination_country: toTextOrNull(getCandidateValue(row, ["destination_country", "country", "destination"])),
    total_price_usd: toNumberOrNull(getCandidateValue(row, ["total_price_usd", "value_usd", "amount_usd", "invoice_usd", "usd"])),
    weight_kg: toNumberOrNull(getCandidateValue(row, ["weight_kg", "weightkg", "weight", "kg"])),
    quantity: toNumberOrNull(getCandidateValue(row, ["quantity", "qty", "volume"])),
    unit_price_usd_kg: toNumberOrNull(getCandidateValue(row, ["unit_price_usd_kg", "usd_per_kg"])),
    unit_price_usd_qty: toNumberOrNull(getCandidateValue(row, ["unit_price_usd_qty", "usd_per_qty"])),
    quantity_unit: toTextOrNull(getCandidateValue(row, ["quantity_unit", "unit"])),
    created_at: toTextOrNull(getCandidateValue(row, ["created_at", "updated_at"])),
  };
};

const mapSupplyChainRow = (row: GenericSupabaseRow, fallbackCompanyId: string, index: number): SupplyChainRow => {
  const company = toTextOrNull(getCandidateValue(row, ["company_id", "companyid"])) ?? fallbackCompanyId;
  const exporter = toTextOrNull(getCandidateValue(row, ["exporter", "supplier_name", "supplier", "vendor", "counterparty"]));
  const tradesSum = toNumberOrNull(getCandidateValue(row, ["trades_sum", "trades", "trade_sum"]));
  const tradeFrequencyRatio = toNumberOrNull(
    getCandidateValue(row, ["trade_frequency_ratio", "frequency_ratio", "trade_freq_ratio"]),
  );
  const kgWeight = toNumberOrNull(getCandidateValue(row, ["kg_weight", "weight_kg", "weightkg", "weight", "kg"]));
  const weightRatio = toNumberOrNull(getCandidateValue(row, ["weight_ratio"]));
  const quantity = toNumberOrNull(getCandidateValue(row, ["quantity", "qty", "volume"]));
  const quantityRatio = toNumberOrNull(getCandidateValue(row, ["quantity_ratio", "qty_ratio"]));
  const totalPriceUsd = toNumberOrNull(
    getCandidateValue(row, ["total_price_usd", "total_value_usd", "value_usd", "amount_usd", "usd"]),
  );
  const totalPriceRatio = toNumberOrNull(getCandidateValue(row, ["total_price_ratio", "value_ratio", "usd_ratio"]));
  const volumeMt = toNumberOrNull(getCandidateValue(row, ["volume_mt", "qty_mt", "quantity_mt", "mt"]));

  return {
    id: toTextOrNull(getCandidateValue(row, ["id", "supplychain_id", "line_id"])) ?? `supply-${company}-${index}`,
    company_id: company,
    exporter,
    trades_sum: tradesSum,
    trade_frequency_ratio: tradeFrequencyRatio,
    kg_weight: kgWeight,
    weight_ratio: weightRatio,
    quantity,
    quantity_ratio: quantityRatio,
    total_price_usd: totalPriceUsd,
    total_price_ratio: totalPriceRatio,
    supplier_name: exporter,
    supplier_country: toTextOrNull(getCandidateValue(row, ["supplier_country", "origin_country", "origin"])),
    relationship_type: toTextOrNull(getCandidateValue(row, ["relationship_type", "relationship", "type"])),
    product: toTextOrNull(getCandidateValue(row, ["product", "product_name", "item"])),
    hs_code: toTextOrNull(getCandidateValue(row, ["hs_code", "hscode", "hs"])),
    incoterm: toTextOrNull(getCandidateValue(row, ["incoterm", "incoterms", "terms"])),
    lead_time_days: toNumberOrNull(getCandidateValue(row, ["lead_time_days", "leadtime_days", "lead_time", "leadtime"])),
    risk_level: toTextOrNull(getCandidateValue(row, ["risk_level", "risk", "risk_tier"])),
    last_shipment_date: toTextOrNull(getCandidateValue(row, ["last_shipment_date", "last_purchase_date", "latest_date", "date"])),
    volume_mt: volumeMt ?? (kgWeight !== null ? kgWeight / 1000 : null),
    total_value_usd: totalPriceUsd,
    status: toTextOrNull(getCandidateValue(row, ["status"])),
    notes: toTextOrNull(getCandidateValue(row, ["notes", "remark", "remarks"])),
    created_at: toTextOrNull(getCandidateValue(row, ["created_at", "updated_at"])),
  };
};

const mapCompanyInfoRow = (row: GenericSupabaseRow, fallbackCompanyId: string): CompanyBasicInfoRow => ({
  company_id: toTextOrNull(getCandidateValue(row, ["company_id", "companyid"])) ?? fallbackCompanyId,
  company_name: toTextOrNull(getCandidateValue(row, ["company_name", "name_en", "name_standard", "customer"])),
  name_standard: toTextOrNull(getCandidateValue(row, ["name_standard"])),
  name_en: toTextOrNull(getCandidateValue(row, ["name_en"])),
  location: toTextOrNull(getCandidateValue(row, ["location", "country", "customer_location"])),
  website: toTextOrNull(getCandidateValue(row, ["website", "url", "site"])),
  operating_status: toTextOrNull(getCandidateValue(row, ["operating_status", "status"])),
  address: toTextOrNull(getCandidateValue(row, ["address"])),
  organization_type: toTextOrNull(getCandidateValue(row, ["organization_type", "org_type"])),
  zip_code: toTextOrNull(getCandidateValue(row, ["zip_code", "zipcode", "postal_code"])),
  founded: toTextOrNull(getCandidateValue(row, ["founded", "founded_year"])),
  employees: toTextOrNull(getCandidateValue(row, ["employees", "employee_size"])),
  company_profile: toTextOrNull(getCandidateValue(row, ["company_profile", "profile"])),
  twitter: toTextOrNull(getCandidateValue(row, ["twitter"])),
  instagram: toTextOrNull(getCandidateValue(row, ["instagram"])),
  facebook: toTextOrNull(getCandidateValue(row, ["facebook"])),
  created_at: toTextOrNull(getCandidateValue(row, ["created_at"])),
  updated_at: toTextOrNull(getCandidateValue(row, ["updated_at", "created_at"])),
});

const mapCompanyContactRow = (row: GenericSupabaseRow, fallbackCompanyId: string, index: number): CompanyContactRow => {
  const company = toTextOrNull(getCandidateValue(row, ["company_id", "companyid"])) ?? fallbackCompanyId;
  return {
    id: toTextOrNull(getCandidateValue(row, ["id"])) ?? `contact-${company}-${index}`,
    company_id: company,
    name: toTextOrNull(getCandidateValue(row, ["name", "contact_name", "contact"])),
    position: toTextOrNull(getCandidateValue(row, ["position", "job_title", "title"])),
    department: toTextOrNull(getCandidateValue(row, ["department", "team"])),
    employment_date: toTextOrNull(getCandidateValue(row, ["employment_date", "employment_year", "joined_at"])),
    business_email: toTextOrNull(getCandidateValue(row, ["business_email", "email"])),
    supplement_email_1: toTextOrNull(getCandidateValue(row, ["supplement_email_1", "email_1", "secondary_email"])),
    supplement_email_2: toTextOrNull(getCandidateValue(row, ["supplement_email_2", "email_2", "alternate_email"])),
    social_media: toTextOrNull(getCandidateValue(row, ["social_media"])),
    tel: toTextOrNull(getCandidateValue(row, ["tel", "phone", "telephone"])),
    fax: toTextOrNull(getCandidateValue(row, ["fax"])),
    whatsapp: toTextOrNull(getCandidateValue(row, ["whatsapp"])),
    linkedin: toTextOrNull(getCandidateValue(row, ["linkedin"])),
    twitter: toTextOrNull(getCandidateValue(row, ["twitter"])),
    instagram: toTextOrNull(getCandidateValue(row, ["instagram"])),
    facebook: toTextOrNull(getCandidateValue(row, ["facebook"])),
    region: toTextOrNull(getCandidateValue(row, ["region", "country"])),
    created_at: toTextOrNull(getCandidateValue(row, ["created_at", "updated_at"])),
  };
};

const mapCompanyEmailRow = (row: GenericSupabaseRow, fallbackCompanyId: string, index: number): CompanyEmailRow => {
  const company = toTextOrNull(getCandidateValue(row, ["company_id", "companyid"])) ?? fallbackCompanyId;
  return {
    id: toTextOrNull(getCandidateValue(row, ["id"])) ?? `company-email-${company}-${index}`,
    company_id: company,
    email: toTextOrNull(getCandidateValue(row, ["email", "business_email"])),
    importance: toTextOrNull(getCandidateValue(row, ["importance", "priority"])),
    source_description: toTextOrNull(getCandidateValue(row, ["source_description", "description"])),
    source: toTextOrNull(getCandidateValue(row, ["source"])),
    created_at: toTextOrNull(getCandidateValue(row, ["created_at", "updated_at"])),
  };
};

const getStatusTone = (value?: string | null) => {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return {
      label: "Profile",
      className: "rounded-full bg-muted px-3 text-muted-foreground",
    };
  }
  if (normalized === "yellow" || normalized === "new" || normalized.includes("high potential")) {
    return {
      label: "High Potential",
      className: "rounded-full bg-amber-100 px-3 text-amber-900",
    };
  }
  if (
    normalized === "green" ||
    normalized === "existing" ||
    normalized.includes("general") ||
    normalized === "active"
  ) {
    return {
      label: "Existing",
      className: "rounded-full bg-emerald-100 px-3 text-emerald-900",
    };
  }
  return {
    label: value ?? "Profile",
    className: "rounded-full bg-muted px-3 text-muted-foreground",
  };
};

const FieldRow = ({ label, value }: { label: string; value?: string | number | null }) => (
  <div className="grid gap-1 border-b border-border/55 py-3 sm:grid-cols-[180px_1fr] sm:items-center sm:gap-3 last:border-b-0">
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
    <p className="text-sm break-words text-foreground">
      {value === null || value === undefined || value === "" ? "—" : String(value)}
    </p>
  </div>
);

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-muted/35 px-4 py-3">
    <p className="text-[11px] font-medium uppercase tracking-[0.11em] text-muted-foreground">{label}</p>
    <p className="mt-1 text-xl font-semibold leading-none tracking-tight text-foreground">{value}</p>
  </div>
);

type SupplyChainFlowNode = {
  name: string;
  value: number;
};

const formatCompactNumber = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
};

const getFlowTransform = (showExporter: boolean, showImporter: boolean) => {
  if (showExporter && showImporter) return "translateX(0%) scale(1)";
  if (showExporter && !showImporter) return "translateX(6%) scale(1.08)";
  if (!showExporter && showImporter) return "translateX(-6%) scale(1.08)";
  return "translateX(0%) scale(1.06)";
};

const getFlowFocusLabel = (showExporter: boolean, showImporter: boolean) => {
  if (showExporter && showImporter) return "Balanced view";
  if (showExporter) return "Focus on exporters";
  if (showImporter) return "Focus on importers";
  return "Focus on company only";
};

const getTextLines = (text: string, maxChars = 26, maxLines = 3) => {
  if (!text) return ["—"];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  let consumed = 0;

  for (let index = 0; index < words.length; index += 1) {
    const rawWord = words[index];
    const word = rawWord.length > maxChars ? `${rawWord.slice(0, maxChars - 1)}…` : rawWord;
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxChars || !line) {
      line = next;
      consumed = index + 1;
      continue;
    }
    lines.push(line);
    line = word;
    consumed = index + 1;
    if (lines.length === maxLines - 1) break;
  }

  if (lines.length < maxLines && line) lines.push(line);
  if (consumed < words.length && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1]}...`;
  }
  return lines.slice(0, maxLines);
};

const flowPalette = {
  bg: "#ffffff",
  laneLeft: "rgba(243, 181, 74, 0.06)",
  laneRight: "rgba(111, 152, 246, 0.06)",
  exporterRail: "#f3b54a",
  importerRail: "#6f98f6",
  exporterStroke: "rgba(243, 181, 74, 0.74)",
  exporterGlow: "rgba(243, 181, 74, 0.2)",
  importerStroke: "rgba(111, 152, 246, 0.74)",
  importerGlow: "rgba(111, 152, 246, 0.18)",
  text: "#0f172a",
  subText: "#475569",
  muted: "#9aa9bc",
};

const SupplyChainFlowChart = ({
  companyName,
  exporters,
  importers,
}: {
  companyName: string;
  exporters: SupplyChainFlowNode[];
  importers: SupplyChainFlowNode[];
}) => {
  const [showExporter, setShowExporter] = useState(true);
  const [showImporter, setShowImporter] = useState(false);

  const visibleExporters = showExporter ? exporters.slice(0, 10) : [];
  const visibleImporters = showImporter ? importers.slice(0, 10) : [];

  const maxExporterValue = Math.max(1, ...visibleExporters.map((item) => item.value));
  const maxImporterValue = Math.max(1, ...visibleImporters.map((item) => item.value));
  const flowTransform = getFlowTransform(showExporter, showImporter);
  const flowFocusLabel = getFlowFocusLabel(showExporter, showImporter);
  const showLeftLane = showExporter;
  const showRightLane = showImporter;
  const centerNameLines = getTextLines(companyName, 24, 3);
  const rowGap = 32;
  const maxRows = Math.max(visibleExporters.length, visibleImporters.length, 3);
  const svgHeight = maxRows * rowGap + 120;
  const centerWidth = 300;
  const centerHeight = Math.max(154, Math.min(220, maxRows * 24));
  const centerX = 500 - centerWidth / 2;
  const centerY = (svgHeight - centerHeight) / 2;

  const getNodeY = (index: number, total: number) => {
    if (total <= 1) return svgHeight / 2;
    const groupHeight = (total - 1) * rowGap;
    return (svgHeight - groupHeight) / 2 + index * rowGap;
  };

  const getAnchorY = (index: number, total: number) => {
    if (total <= 1) return centerY + centerHeight / 2;
    const start = centerY + 24;
    const end = centerY + centerHeight - 24;
    return start + ((end - start) * index) / (total - 1);
  };

  const trimName = (value: string, max = 24) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{flowFocusLabel}</p>
        <div className="inline-flex items-center rounded-full border border-border/70 bg-muted/20 p-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={
              showExporter
                ? "h-8 rounded-full border border-[#ffbd59] bg-[#ffbd59] px-3.5 text-xs font-semibold text-[#3b2a06] hover:bg-[#ffbd59]"
                : "h-8 rounded-full px-3.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            }
            onClick={() => setShowExporter((prev) => !prev)}
          >
            Exporters
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={
              showImporter
                ? "h-8 rounded-full border border-[#ffbd59] bg-[#ffbd59] px-3.5 text-xs font-semibold text-[#3b2a06] hover:bg-[#ffbd59]"
                : "h-8 rounded-full px-3.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            }
            onClick={() => setShowImporter((prev) => !prev)}
          >
            Importers
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 items-center text-center text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <span>{showExporter ? "Exporters" : ""}</span>
        <span className="truncate px-3">Company</span>
        <span>{showImporter ? "Importers" : ""}</span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-white">
        <svg viewBox={`0 0 1000 ${svgHeight}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="flow-left-lane" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={flowPalette.laneLeft} />
              <stop offset="100%" stopColor="rgba(243, 181, 74, 0.01)" />
            </linearGradient>
            <linearGradient id="flow-right-lane" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(111, 152, 246, 0.01)" />
              <stop offset="100%" stopColor={flowPalette.laneRight} />
            </linearGradient>
            <linearGradient id="flow-exporter-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={flowPalette.exporterStroke} />
              <stop offset="100%" stopColor="rgba(243, 181, 74, 0.24)" />
            </linearGradient>
            <linearGradient id="flow-importer-stroke" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(111, 152, 246, 0.24)" />
              <stop offset="100%" stopColor={flowPalette.importerStroke} />
            </linearGradient>
            <clipPath id="flow-left-text-clip">
              <rect x={16} y={16} width={224} height={svgHeight - 32} />
            </clipPath>
            <clipPath id="flow-right-text-clip">
              <rect x={760} y={16} width={224} height={svgHeight - 32} />
            </clipPath>
            <filter id="flow-soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="rgba(15,23,42,0.12)" />
            </filter>
            <style>
              {`
                .flow-exporter-core { animation: flowExporterPulse 2.4s ease-in-out infinite; }
                .flow-importer-core { animation: flowImporterPulse 2.4s ease-in-out infinite; }
                .flow-exporter-glow { animation: flowExporterGlow 2.4s ease-in-out infinite; }
                .flow-importer-glow { animation: flowImporterGlow 2.4s ease-in-out infinite; }
                @keyframes flowExporterPulse {
                  0%, 100% { stroke-width: var(--core-width); opacity: .9; }
                  50% { stroke-width: calc(var(--core-width) + 0.7px); opacity: 1; }
                }
                @keyframes flowImporterPulse {
                  0%, 100% { stroke-width: var(--core-width); opacity: .88; }
                  50% { stroke-width: calc(var(--core-width) + 0.7px); opacity: 1; }
                }
                @keyframes flowExporterGlow {
                  0%, 100% { opacity: .26; }
                  50% { opacity: .5; }
                }
                @keyframes flowImporterGlow {
                  0%, 100% { opacity: .2; }
                  50% { opacity: .42; }
                }
              `}
            </style>
          </defs>

          <rect x={0} y={0} width={1000} height={svgHeight} fill={flowPalette.bg} />
          {showLeftLane && <rect x={18} y={16} width={314} height={svgHeight - 32} rx={24} fill="url(#flow-left-lane)" />}
          {showRightLane && <rect x={668} y={16} width={314} height={svgHeight - 32} rx={24} fill="url(#flow-right-lane)" />}

          <g style={{ transform: flowTransform, transformOrigin: "500px 50%" }} className="origin-center transition-transform duration-500 ease-out">
            {showExporter && (
              <rect x={centerX - 1} y={centerY + 20} width={4} height={centerHeight - 40} fill={flowPalette.exporterRail} rx={4} />
            )}
            {showImporter && (
              <rect x={centerX + centerWidth - 3} y={centerY + 20} width={4} height={centerHeight - 40} fill={flowPalette.importerRail} rx={4} />
            )}

            {centerNameLines.map((line, index) => (
              <text
                key={`${line}-${index}`}
                x={500}
                y={centerY + centerHeight / 2 - ((centerNameLines.length - 1) * 19) / 2 + index * 19 + 2}
                textAnchor="middle"
                fontSize={index === 0 ? 17 : 16}
                fontWeight={600}
                fill={flowPalette.text}
              >
                {line}
              </text>
            ))}

            {showExporter && visibleExporters.length === 0 && (
              <text x={167} y={svgHeight / 2 + 4} textAnchor="middle" fontSize={16} fill={flowPalette.muted}>
                No exporter data
              </text>
            )}

            {showImporter && visibleImporters.length === 0 && (
              <text x={833} y={svgHeight / 2 + 4} textAnchor="middle" fontSize={16} fill={flowPalette.muted}>
                No importer data
              </text>
            )}

            {visibleExporters.map((node, index) => {
              const nodeY = getNodeY(index, visibleExporters.length);
              const anchorY = getAnchorY(index, visibleExporters.length);
              const ratio = node.value / maxExporterValue;
              const strokeWidth = 1.4 + ratio * 4.2;
              const path = `M 246 ${nodeY} C 316 ${nodeY}, 332 ${anchorY}, ${centerX} ${anchorY}`;
              return (
                <g key={`exporter-${node.name}-${index}`}>
                  <path
                    d={path}
                    stroke={flowPalette.exporterGlow}
                    strokeWidth={strokeWidth + 5}
                    fill="none"
                    strokeLinecap="round"
                    className="flow-exporter-glow"
                  />
                  <path
                    d={path}
                    stroke="url(#flow-exporter-stroke)"
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    className="flow-exporter-core"
                    style={{ ["--core-width" as string]: `${strokeWidth}px` }}
                  />
                  <circle cx={246} cy={nodeY} r={2.9} fill={flowPalette.exporterRail} />
                  <text
                    x={234}
                    y={nodeY + 4}
                    textAnchor="end"
                    fontSize={12.5}
                    fill={flowPalette.text}
                    fontWeight={500}
                    clipPath="url(#flow-left-text-clip)"
                  >
                    {trimName(node.name)}
                  </text>
                  <text
                    x={234}
                    y={nodeY + 19}
                    textAnchor="end"
                    fontSize={10.5}
                    fill={flowPalette.subText}
                    clipPath="url(#flow-left-text-clip)"
                  >
                    {formatCompactNumber(node.value)}
                  </text>
                </g>
              );
            })}

            {visibleImporters.map((node, index) => {
              const nodeY = getNodeY(index, visibleImporters.length);
              const anchorY = getAnchorY(index, visibleImporters.length);
              const ratio = node.value / maxImporterValue;
              const strokeWidth = 1.4 + ratio * 4.2;
              const path = `M ${centerX + centerWidth} ${anchorY} C 668 ${anchorY}, 684 ${nodeY}, 754 ${nodeY}`;
              return (
                <g key={`importer-${node.name}-${index}`}>
                  <path
                    d={path}
                    stroke={flowPalette.importerGlow}
                    strokeWidth={strokeWidth + 5}
                    fill="none"
                    strokeLinecap="round"
                    className="flow-importer-glow"
                  />
                  <path
                    d={path}
                    stroke="url(#flow-importer-stroke)"
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    className="flow-importer-core"
                    style={{ ["--core-width" as string]: `${strokeWidth}px` }}
                  />
                  <circle cx={754} cy={nodeY} r={2.6} fill={flowPalette.importerRail} />
                  <text
                    x={763}
                    y={nodeY + 4}
                    textAnchor="start"
                    fontSize={12.5}
                    fill={flowPalette.text}
                    fontWeight={500}
                    clipPath="url(#flow-right-text-clip)"
                  >
                    {trimName(node.name)}
                  </text>
                  <text
                    x={763}
                    y={nodeY + 18}
                    textAnchor="start"
                    fontSize={10.5}
                    fill={flowPalette.subText}
                    clipPath="url(#flow-right-text-clip)"
                  >
                    {formatCompactNumber(node.value)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
};

const shellCardClass =
  "rounded-2xl border border-border/60 bg-card";
const contentCardClass =
  "rounded-2xl border border-border/60 bg-card";
const tabTriggerClass =
  "rounded-lg border border-transparent px-3.5 py-2 text-sm font-medium text-muted-foreground transition data-[state=active]:border-border/70 data-[state=active]:bg-background data-[state=active]:text-foreground";

export default function MarketIntelligenceCompanyProfile() {
  const navigate = useNavigate();
  const { companyId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const hsCode = searchParams.get("hs");

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [companyMaster, setCompanyMaster] = useState<CompanyMasterRow | null>(null);
  const [overview, setOverview] = useState<CompanyOverviewRow | null>(null);
  const [basicInfo, setBasicInfo] = useState<CompanyBasicInfoRow | null>(null);
  const [contacts, setContacts] = useState<CompanyContactRow[]>([]);
  const [companyEmails, setCompanyEmails] = useState<CompanyEmailRow[]>([]);
  const [purchaseTrend, setPurchaseTrend] = useState<PurchaseTrendRow[]>([]);
  const [supplyChainRows, setSupplyChainRows] = useState<SupplyChainRow[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!companyId) {
        setErrorMessage("Missing company reference.");
        setIsLoading(false);
        return;
      }
      if (!isSupabaseConfigured || !supabase) {
        setErrorMessage("Data connection is not configured.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const fetchCompanyMaster = async () => {
          const primary = await supabase
            .from("supabase_companies")
            .select("*")
            .eq("company_id", companyId)
            .maybeSingle();
          if (!primary.error) {
            return (primary.data ?? null) as CompanyMasterRow | null;
          }
          if (!isMissingTableError(primary.error)) {
            throw primary.error;
          }

          const fallback = await supabase
            .from("companies")
            .select("*")
            .eq("company_id", companyId)
            .maybeSingle();
          if (fallback.error && !isMissingTableError(fallback.error)) {
            throw fallback.error;
          }
          return (fallback.data ?? null) as CompanyMasterRow | null;
        };

        const fetchOptionalSingle = async <T,>(table: string) => {
          const response = await supabase.from(table).select("*").eq("company_id", companyId).maybeSingle();
          if (response.error) {
            if (isMissingTableError(response.error)) {
              return null;
            }
            throw response.error;
          }
          return (response.data ?? null) as T | null;
        };

        const fetchOptionalSingleFromCandidates = async <T,>(
          tables: string[],
          mapper?: (row: GenericSupabaseRow) => T,
        ) => {
          for (const table of tables) {
            const row = await fetchOptionalSingle<GenericSupabaseRow>(table);
            if (!row) continue;
            return mapper ? mapper(row) : (row as T);
          }
          return null;
        };

        const fetchOptionalList = async <T,>(
          table: string,
          orderColumn: string,
          ascending: boolean,
          limit?: number,
        ) => {
          const companyIdFilterCandidates = ["company_id", "companyid", "companyId"];

          for (const filterKey of companyIdFilterCandidates) {
            let query = supabase
              .from(table)
              .select("*")
              .eq(filterKey, companyId)
              .order(orderColumn, { ascending });
            if (typeof limit === "number") {
              query = query.limit(limit);
            }

            let response = await query;
            if (response.error && isMissingColumnError(response.error)) {
              let fallbackQuery = supabase.from(table).select("*").eq(filterKey, companyId);
              if (typeof limit === "number") {
                fallbackQuery = fallbackQuery.limit(limit);
              }
              response = await fallbackQuery;
            }

            if (!response.error) {
              return (response.data ?? []) as T[];
            }
            if (isMissingTableError(response.error)) {
              return [] as T[];
            }
            if (isMissingColumnError(response.error)) {
              continue;
            }
            throw response.error;
          }

          return [] as T[];
        };

        const fetchOptionalListFromCandidates = async <T,>(
          tables: string[],
          orderColumn: string,
          ascending: boolean,
          limit?: number,
        ) => {
          for (const table of tables) {
            const rows = await fetchOptionalList<T>(table, orderColumn, ascending, limit);
            if (rows.length > 0) {
              return rows;
            }
          }
          return [] as T[];
        };

        const fetchPurchaseHistory = async () => {
          const rawRows = await fetchOptionalListFromCandidates<GenericSupabaseRow>(
            [
              "supabese-company_history",
              "supabese_company_history",
              "supabase_company_history",
              "company_history",
              "purchase_trend",
              "purchase_trends",
            ],
            "date",
            false,
            1000,
          );
          return rawRows.map((row, index) => mapPurchaseHistoryRow(row, companyId, index));
        };

        const fetchSupplyChain = async () => {
          const rawRows = await fetchOptionalListFromCandidates<GenericSupabaseRow>(
            [
              "supabese-company_supplychain",
              "supabese_company_supplychain",
              "supabase_company_supplychain",
              "company_supplychain",
              "company_supply_chain",
            ],
            "created_at",
            false,
            1000,
          );
          return rawRows.map((row, index) => mapSupplyChainRow(row, companyId, index));
        };

        const fetchContacts = async () => {
          const rawRows = await fetchOptionalListFromCandidates<GenericSupabaseRow>(
            ["company_contacts", "company_contact"],
            "created_at",
            true,
            200,
          );
          return rawRows.map((row, index) => mapCompanyContactRow(row, companyId, index));
        };

        const fetchCompanyEmails = async () => {
          const rawRows = await fetchOptionalListFromCandidates<GenericSupabaseRow>(
            ["company_emails", "company_email"],
            "created_at",
            true,
            300,
          );
          return rawRows
            .map((row, index) => mapCompanyEmailRow(row, companyId, index))
            .filter((row) => Boolean(row.email));
        };

        const fetchBasicInfo = async () =>
          fetchOptionalSingleFromCandidates<CompanyBasicInfoRow>(
            ["company_basic_info", "company_info"],
            (row) => mapCompanyInfoRow(row, companyId),
          );

        const [companyMasterData, overviewData, basicData, contactsData, companyEmailsData, purchaseData, supplyChainData] = await Promise.all([
          fetchCompanyMaster(),
          fetchOptionalSingle<CompanyOverviewRow>("company_overview"),
          fetchBasicInfo(),
          fetchContacts(),
          fetchCompanyEmails(),
          fetchPurchaseHistory(),
          fetchSupplyChain(),
        ]);

        if (!active) return;

        if (
          !companyMasterData &&
          !overviewData &&
          !basicData &&
          contactsData.length === 0 &&
          companyEmailsData.length === 0 &&
          purchaseData.length === 0 &&
          supplyChainData.length === 0
        ) {
          setErrorMessage("No profile data found for this company yet.");
        }

        setCompanyMaster(companyMasterData);
        setOverview(overviewData);
        setBasicInfo(basicData);
        setContacts(contactsData);
        setCompanyEmails(companyEmailsData);
        setPurchaseTrend(purchaseData);
        setSupplyChainRows(supplyChainData);
      } catch (error) {
        console.error("Failed to load company profile page", error);
        if (active) {
          setErrorMessage("Unable to load company profile right now.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [companyId]);

  const companyName = useMemo(
    () =>
      pickFirstText(
        basicInfo?.company_name,
        basicInfo?.name_en,
        basicInfo?.name_standard,
        companyMaster?.customer,
        companyMaster?.customer_name,
        purchaseTrend[0]?.importer,
        overview?.company_id,
        companyId,
      ) ?? companyId,
    [
      basicInfo?.company_name,
      basicInfo?.name_en,
      basicInfo?.name_standard,
      companyMaster?.customer,
      companyMaster?.customer_name,
      purchaseTrend,
      overview?.company_id,
      companyId,
    ],
  );

  const companyLocation = useMemo(
    () => pickFirstText(basicInfo?.location, companyMaster?.location, companyMaster?.customer_location),
    [basicInfo?.location, companyMaster?.location, companyMaster?.customer_location],
  );

  const companyWebsite = useMemo(
    () => pickFirstText(basicInfo?.website, companyMaster?.website),
    [basicInfo?.website, companyMaster?.website],
  );
  const companyWebsiteUrl = useMemo(() => normalizeUrl(companyWebsite), [companyWebsite]);

  const statusTone = useMemo(() => {
    if (overview?.is_active === true) {
      return {
        label: "Active",
        className: "rounded-full bg-amber-100 px-3 text-amber-900",
      };
    }
    if (overview?.is_active === false) {
      return {
        label: "Inactive",
        className: "rounded-full bg-rose-100 px-3 text-rose-800",
      };
    }
    return getStatusTone(companyMaster?.status ?? companyMaster?.value_tag ?? null);
  }, [overview?.is_active, companyMaster?.status, companyMaster?.value_tag]);

  const fallbackPurchaseRows = useMemo(() => {
    if (purchaseTrend.length > 0) {
      return [] as PurchaseTrendRow[];
    }

    const latestDate = pickFirstText(
      overview?.latest_purchase_date,
      companyMaster?.latest_purchase_time,
      overview?.updated_at,
      companyMaster?.created_at,
    );
    const fallbackWeight = numeric(companyMaster?.trades);
    const fallbackAmount = numeric(overview?.purchase_value_last_12m);

    if (!latestDate && fallbackWeight === null && fallbackAmount === null) {
      return [] as PurchaseTrendRow[];
    }

    return [
      {
        id: `fallback-${companyId}`,
        company_id: companyId,
        date: latestDate ?? null,
        importer: companyName,
        exporter: overview?.core_suppliers?.[0] ?? null,
        hs_code: null,
        product: overview?.core_products?.[0] ?? companyMaster?.product ?? null,
        product_description: pickFirstText(companyMaster?.product_description, overview?.business_overview) ?? null,
        origin_country: overview?.core_supplier_countries?.[0] ?? null,
        destination_country: companyLocation ?? null,
        total_price_usd: fallbackAmount,
        weight_kg: fallbackWeight,
        quantity: fallbackWeight,
        unit_price_usd_kg: null,
        unit_price_usd_qty: null,
        quantity_unit: null,
        created_at: null,
      },
    ] as PurchaseTrendRow[];
  }, [
    purchaseTrend,
    overview?.latest_purchase_date,
    overview?.updated_at,
    overview?.purchase_value_last_12m,
    overview?.core_products,
    overview?.core_suppliers,
    overview?.core_supplier_countries,
    overview?.business_overview,
    companyMaster?.latest_purchase_time,
    companyMaster?.created_at,
    companyMaster?.trades,
    companyMaster?.product,
    companyMaster?.product_description,
    companyId,
    companyName,
    companyLocation,
  ]);

  const allPurchaseRows = useMemo(
    () => (purchaseTrend.length > 0 ? purchaseTrend : fallbackPurchaseRows),
    [purchaseTrend, fallbackPurchaseRows],
  );

  const filteredPurchaseRows = useMemo(() => {
    if (!hsCode) return allPurchaseRows;
    const normalized = hsCode.replace(/\D+/g, "").slice(0, 6);
    if (!normalized) return allPurchaseRows;
    return allPurchaseRows.filter((row) => (row.hs_code ?? "").replace(/\D+/g, "").startsWith(normalized));
  }, [allPurchaseRows, hsCode]);

  const purchaseRowsForDisplay = useMemo(() => {
    if (!hsCode) return allPurchaseRows;
    if (filteredPurchaseRows.length > 0) return filteredPurchaseRows;
    return allPurchaseRows;
  }, [allPurchaseRows, filteredPurchaseRows, hsCode]);

  const hsFilterFallbackUsed = useMemo(
    () => Boolean(hsCode && filteredPurchaseRows.length === 0 && allPurchaseRows.length > 0),
    [allPurchaseRows.length, filteredPurchaseRows.length, hsCode],
  );

  const totalPurchaseRows = purchaseRowsForDisplay.length;
  const totalPurchaseAmount = purchaseRowsForDisplay.reduce((sum, row) => sum + (row.total_price_usd ?? 0), 0);
  const totalPurchaseQuantity = purchaseRowsForDisplay.reduce((sum, row) => sum + (row.quantity ?? 0), 0);
  const totalPurchaseWeightKg = purchaseRowsForDisplay.reduce((sum, row) => sum + (row.weight_kg ?? 0), 0);
  const purchaseSuppliers = useMemo(
    () => new Set(purchaseRowsForDisplay.map((row) => row.exporter).filter(Boolean)).size,
    [purchaseRowsForDisplay],
  );
  const purchaseOrigins = useMemo(
    () => new Set(purchaseRowsForDisplay.map((row) => row.origin_country).filter(Boolean)).size,
    [purchaseRowsForDisplay],
  );
  const supplyChainExporterFlowNodes = useMemo(() => {
    const grouped = new Map<string, number>();
    supplyChainRows.forEach((row) => {
      const name = (row.exporter ?? row.supplier_name ?? "").trim();
      if (!name) return;
      const value =
        row.trades_sum ??
        row.quantity ??
        row.kg_weight ??
        row.volume_mt ??
        row.total_price_usd ??
        0;
      grouped.set(name, (grouped.get(name) ?? 0) + value);
    });

    if (grouped.size === 0) {
      purchaseRowsForDisplay.forEach((row) => {
        const name = (row.exporter ?? "").trim();
        if (!name) return;
        const value = row.quantity ?? row.weight_kg ?? row.total_price_usd ?? 0;
        grouped.set(name, (grouped.get(name) ?? 0) + value);
      });
    }

    return Array.from(grouped.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [supplyChainRows, purchaseRowsForDisplay]);
  const supplyChainImporterFlowNodes = useMemo(() => {
    const grouped = new Map<string, number>();
    const companyNameNormalized = companyName.trim().toLowerCase();

    purchaseRowsForDisplay.forEach((row) => {
      const name = (row.importer ?? "").trim();
      if (!name) return;
      if (name.toLowerCase() === companyNameNormalized) return;
      const value = row.quantity ?? row.weight_kg ?? row.total_price_usd ?? 0;
      grouped.set(name, (grouped.get(name) ?? 0) + value);
    });

    return Array.from(grouped.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [companyName, purchaseRowsForDisplay]);
  const employeeSizeNarrative =
    typeof overview?.employee_size === "number"
      ? `The company has approximately ${formatNumber(overview.employee_size)} employees.`
      : "Employee size is not available.";

  const growthRate3m = numeric(overview?.growth_rate_last_3m ?? overview?.recent_trends ?? null);
  const yoyGrowthRate = numeric(overview?.yoy_growth_rate ?? overview?.purchasing_trend ?? null);
  const purchaseActivityLabel = pickFirstText(overview?.purchase_activity_label, overview?.purchase_activity);

  const socialLinks = useMemo(() => {
    const primaryContact = contacts[0];
    const links = [
      { label: "Website", href: companyWebsiteUrl, icon: Globe, pattern: null as RegExp | null },
      {
        label: "LinkedIn",
        href: normalizeUrl(primaryContact?.linkedin),
        icon: Globe,
        pattern: /linkedin\.com/i,
      },
      {
        label: "Twitter",
        href: normalizeUrl(basicInfo?.twitter ?? primaryContact?.twitter),
        icon: Globe,
        pattern: /(twitter\.com|x\.com)/i,
      },
      {
        label: "Instagram",
        href: normalizeUrl(basicInfo?.instagram ?? primaryContact?.instagram),
        icon: Globe,
        pattern: /instagram\.com/i,
      },
      {
        label: "Facebook",
        href: normalizeUrl(basicInfo?.facebook ?? primaryContact?.facebook),
        icon: Globe,
        pattern: /facebook\.com/i,
      },
    ]
      .filter((item) => item.href)
      .filter((item) => (item.pattern ? item.pattern.test(item.href as string) : true));

    const uniqueByHref = new Map<string, (typeof links)[number]>();
    links.forEach((item) => {
      if (!item.href) return;
      if (!uniqueByHref.has(item.href)) {
        uniqueByHref.set(item.href, item);
      }
    });

    return Array.from(uniqueByHref.values());
  }, [basicInfo?.facebook, basicInfo?.instagram, basicInfo?.twitter, companyWebsiteUrl, contacts]);

  const companyEmailRows = useMemo(() => {
    const merged = [
      ...companyEmails.map((row) => ({
        email: row.email?.trim() ?? "",
        source: row.source_description ?? row.source ?? row.importance ?? null,
      })),
      ...contacts.flatMap((row) => [
        { email: row.business_email?.trim() ?? "", source: "Contact person" as string | null },
        { email: row.supplement_email_1?.trim() ?? "", source: "Contact person" as string | null },
        { email: row.supplement_email_2?.trim() ?? "", source: "Contact person" as string | null },
      ]),
    ]
      .filter((row) => row.email)
      .filter((row) => /\S+@\S+\.\S+/.test(row.email));

    const deduped = new Map<string, { email: string; source: string | null }>();
    merged.forEach((item) => {
      const key = item.email.toLowerCase();
      if (!deduped.has(key)) {
        deduped.set(key, item);
      }
    });
    return Array.from(deduped.values());
  }, [companyEmails, contacts]);

  const companyContactChannels = useMemo(() => {
    const rawLinks = [
      { label: "Website", href: companyWebsiteUrl },
      ...contacts.flatMap((row) => [
        { label: "LinkedIn", href: normalizeUrl(row.linkedin) },
        { label: "Twitter", href: normalizeUrl(row.twitter) },
        { label: "Instagram", href: normalizeUrl(row.instagram) },
        { label: "Facebook", href: normalizeUrl(row.facebook) },
      ]),
    ].filter((item) => item.href);

    const deduped = new Map<string, { label: string; href: string }>();
    rawLinks.forEach((item) => {
      if (!item.href) return;
      if (!deduped.has(item.href)) {
        deduped.set(item.href, { label: item.label, href: item.href });
      }
    });
    return Array.from(deduped.values());
  }, [companyWebsiteUrl, contacts]);

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title={companyName || "Company Profile"}
      />

      <div className="flex-1 overflow-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-5 md:pb-6">
        <div className="mx-auto w-full max-w-7xl space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="group h-10 rounded-xl border-border/60 bg-background px-2.5 pr-3.5 shadow-none transition hover:bg-muted/40"
              onClick={() => navigate("/market-intelligence")}
              aria-label="Back to Market Intelligence"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white">
                <ArrowLeft className="h-3.5 w-3.5" />
              </span>
              <span className="ml-2 text-sm font-medium sm:hidden">Back</span>
              <span className="ml-2 hidden text-sm font-medium sm:inline">Back to Market Intelligence</span>
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-44 w-full rounded-[26px]" />
              <Skeleton className="h-12 w-full rounded-2xl" />
              <Skeleton className="h-72 w-full rounded-[26px]" />
            </div>
          ) : errorMessage ? (
            <Card className={`${shellCardClass}`}>
              <CardContent className="p-6 text-sm text-muted-foreground">{errorMessage}</CardContent>
            </Card>
          ) : (
            <>
              <Card className={`${shellCardClass}`}>
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        Company
                      </p>
                      <h2 className="mt-1 break-words text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">
                        {companyName}
                      </h2>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {companyLocation || "Location not available"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className={statusTone.className}>
                        {statusTone.label}
                      </Badge>
                      {overview?.purchase_stability ? (
                        <Badge variant="outline" className="rounded-full bg-background/80 px-3">
                          {overview.purchase_stability}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Total Purchase Value" value={formatCurrency(overview?.total_purchase_value)} />
                    <StatCard label="Last 12 Months" value={formatCurrency(overview?.purchase_value_last_12m)} />
                    <StatCard label="Purchase Frequency / Year" value={formatNumber(overview?.purchase_frequency_per_year)} />
                    <StatCard label="Latest Purchase" value={formatDate(overview?.latest_purchase_date || companyMaster?.latest_purchase_time)} />
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="h-auto w-full justify-start gap-1.5 overflow-x-auto rounded-xl border border-border/60 bg-muted/30 p-1">
                  <TabsTrigger value="overview" className={tabTriggerClass}>Overview</TabsTrigger>
                  <TabsTrigger value="company" className={tabTriggerClass}>Company Info</TabsTrigger>
                  <TabsTrigger value="contacts" className={tabTriggerClass}>Contacts</TabsTrigger>
                  <TabsTrigger value="purchases" className={tabTriggerClass}>Purchase History</TabsTrigger>
                  <TabsTrigger value="supply-chain" className={tabTriggerClass}>Supply Chain</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-4">
                  <Card className={contentCardClass}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-xl tracking-tight sm:text-2xl">Business Overview</CardTitle>
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800">
                          <Sparkles className="h-3.5 w-3.5" />
                          AI-generated
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-0">
                      <FieldRow label="Company introduction" value={overview?.company_introduction} />
                      <FieldRow label="Business summary" value={overview?.business_overview} />
                      <FieldRow label="Operational insight" value={overview?.indicator_review} />
                      <FieldRow label="Employee Size" value={employeeSizeNarrative} />
                    </CardContent>
                  </Card>

                  <Card className={contentCardClass}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl tracking-tight sm:text-2xl">Key Procurement Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-0">
                      <FieldRow label="Procurement summary" value={overview?.procurement_overview} />
                      <FieldRow label="Procurement structure" value={overview?.procurement_structure} />
                      <FieldRow label="Purchase activity" value={purchaseActivityLabel} />
                      <FieldRow label="Average purchase interval (days)" value={formatNumber(overview?.purchase_interval_days)} />
                      <FieldRow label="3-month growth" value={formatPercent(growthRate3m)} />
                      <FieldRow label="Year-over-year growth" value={formatPercent(yoyGrowthRate)} />
                      <FieldRow label="Trade start date" value={formatDate(overview?.trade_start_date)} />
                      <FieldRow label="Trade end date" value={formatDate(overview?.trade_end_date)} />
                      <FieldRow label="Core products" value={overview?.core_products?.join(", ")} />
                      <FieldRow label="Main supplier countries" value={overview?.core_supplier_countries?.join(", ")} />
                      <FieldRow label="Key suppliers" value={overview?.core_suppliers?.join(", ")} />
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="company" className="mt-4 space-y-4">
                  <Card className={contentCardClass}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl tracking-tight sm:text-2xl">Company Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-0">
                      <FieldRow label="Company name" value={companyName} />
                      <FieldRow label="Location" value={companyLocation} />
                      <FieldRow label="Website" value={companyWebsite} />
                      <FieldRow label="Customer status" value={companyMaster?.status || companyMaster?.value_tag} />
                      <FieldRow label="Last profile update" value={formatDate(basicInfo?.updated_at || overview?.updated_at || companyMaster?.created_at)} />
                    </CardContent>
                  </Card>

                  <Card className={contentCardClass}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl tracking-tight sm:text-2xl">Digital Channels</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {socialLinks.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No website or social channels available.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {socialLinks.map((item) => (
                            <a
                              key={`${item.label}-${item.href}`}
                              href={item.href}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5 text-sm shadow-sm transition hover:bg-secondary"
                            >
                              <item.icon className="h-3.5 w-3.5" />
                              {item.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="contacts" className="mt-4 space-y-4">
                  <Card className={contentCardClass}>
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className="text-xl tracking-tight sm:text-2xl">Contact Hub</CardTitle>
                        <Badge variant="outline" className="rounded-full bg-background/80 px-3">
                          Company + People
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Company channels and key contact persons in one place.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Contact Persons" value={formatNumber(contacts.length)} />
                        <StatCard label="Company Emails" value={formatNumber(companyEmailRows.length)} />
                        <StatCard label="Digital Channels" value={formatNumber(companyContactChannels.length)} />
                        <StatCard label="Last Update" value={formatDate(basicInfo?.updated_at || basicInfo?.created_at)} />
                      </div>

                      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 sm:p-5">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-semibold text-foreground">Company Contact Profile</p>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="rounded-xl bg-background/75 p-3">
                            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Company</p>
                            <p className="mt-1 text-sm font-medium text-foreground">{companyName}</p>
                          </div>
                          <div className="rounded-xl bg-background/75 p-3">
                            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Location</p>
                            <p className="mt-1 text-sm font-medium text-foreground">{companyLocation || "—"}</p>
                          </div>
                          <div className="rounded-xl bg-background/75 p-3">
                            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Website</p>
                            {companyWebsiteUrl ? (
                              <a
                                href={companyWebsiteUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
                              >
                                {companyWebsite}
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : (
                              <p className="mt-1 text-sm font-medium text-foreground">—</p>
                            )}
                          </div>
                          <div className="rounded-xl bg-background/75 p-3">
                            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Operating Status</p>
                            <p className="mt-1 text-sm font-medium text-foreground">{basicInfo?.operating_status || "—"}</p>
                          </div>
                          <div className="rounded-xl bg-background/75 p-3">
                            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Organization Type</p>
                            <p className="mt-1 text-sm font-medium text-foreground">{basicInfo?.organization_type || "—"}</p>
                          </div>
                          <div className="rounded-xl bg-background/75 p-3">
                            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Founded</p>
                            <p className="mt-1 text-sm font-medium text-foreground">{basicInfo?.founded || "—"}</p>
                          </div>
                        </div>

                        {companyEmailRows.length > 0 && (
                          <div className="mt-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              Official Email Directory
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {companyEmailRows.map((row) => (
                                <a
                                  key={row.email}
                                  href={`mailto:${row.email}`}
                                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs text-foreground transition hover:bg-secondary"
                                >
                                  <Mail className="h-3.5 w-3.5" />
                                  {row.email}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {companyContactChannels.length > 0 && (
                          <div className="mt-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                              Company Channels
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {companyContactChannels.map((channel) => (
                                <a
                                  key={`${channel.label}-${channel.href}`}
                                  href={channel.href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs text-foreground transition hover:bg-secondary"
                                >
                                  <Globe className="h-3.5 w-3.5" />
                                  {channel.label}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {contacts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No contact person records available.</p>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {contacts.map((contact, index) => {
                            const primaryEmail = contact.business_email || contact.supplement_email_1 || contact.supplement_email_2;
                            const callablePhone = pickFirstText(contact.tel, contact.whatsapp);
                            const phoneDisplay = callablePhone || pickFirstText(contact.social_media, contact.fax);
                            const socialActions = [
                              { label: "LinkedIn", href: normalizeUrl(contact.linkedin) },
                              { label: "Twitter", href: normalizeUrl(contact.twitter) },
                              { label: "Instagram", href: normalizeUrl(contact.instagram) },
                              { label: "Facebook", href: normalizeUrl(contact.facebook) },
                            ].filter((item) => item.href);

                            return (
                              <div
                                key={contact.id ?? `${contact.company_id}-${contact.name ?? "contact"}-${index}`}
                                className="rounded-2xl border border-border/60 bg-card p-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-foreground">{contact.name || "Unknown contact"}</p>
                                    <p className="text-sm text-muted-foreground">{contact.position || "Position not available"}</p>
                                  </div>
                                  {contact.employment_date ? (
                                    <Badge variant="secondary" className="rounded-full bg-muted px-2.5 py-1 text-xs">
                                      Since {contact.employment_date}
                                    </Badge>
                                  ) : null}
                                </div>

                                <div className="mt-3 space-y-2 text-sm">
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <User className="h-4 w-4" />
                                    <span>{contact.department || "Department not available"}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Mail className="h-4 w-4" />
                                    <span className="break-all">{primaryEmail || "No email"}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Phone className="h-4 w-4" />
                                    <span>{phoneDisplay || "No phone/social info"}</span>
                                  </div>
                                </div>

                                {(primaryEmail || callablePhone || socialActions.length > 0) && (
                                  <div className="mt-4 flex flex-wrap gap-2">
                                    {primaryEmail ? (
                                      <a
                                        href={`mailto:${primaryEmail}`}
                                        className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-foreground transition hover:bg-secondary"
                                      >
                                        <Mail className="h-3.5 w-3.5" />
                                        Email
                                      </a>
                                    ) : null}
                                    {callablePhone ? (
                                      <a
                                        href={`tel:${callablePhone}`}
                                        className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-foreground transition hover:bg-secondary"
                                      >
                                        <Phone className="h-3.5 w-3.5" />
                                        Call
                                      </a>
                                    ) : null}
                                    {socialActions.map((item) => (
                                      <a
                                        key={`${item.label}-${item.href}`}
                                        href={item.href}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs text-foreground transition hover:bg-secondary"
                                      >
                                        <Globe className="h-3.5 w-3.5" />
                                        {item.label}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="purchases" className="mt-4 space-y-4">
                  <Card className={contentCardClass}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl tracking-tight sm:text-2xl">Purchase History</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Records" value={formatNumber(totalPurchaseRows)} />
                        <StatCard label="Total Amount" value={formatCurrency(totalPurchaseAmount)} />
                        <StatCard
                          label="Total Quantity"
                          value={formatNumber(totalPurchaseQuantity)}
                        />
                        <StatCard
                          label="Total Weight (KG)"
                          value={formatNumber(totalPurchaseWeightKg)}
                        />
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Suppliers" value={formatNumber(purchaseSuppliers)} />
                        <StatCard label="Origin Countries" value={formatNumber(purchaseOrigins)} />
                        <StatCard
                          label="HS Filter"
                          value={hsCode ? hsCode.replace(/\D+/g, "").slice(0, 6) || "Applied" : "All"}
                        />
                        <StatCard
                          label="Data Source"
                          value={purchaseTrend.length > 0 ? "company_history" : "overview fallback"}
                        />
                      </div>

                      {hsFilterFallbackUsed && (
                        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          No rows matched the selected HS filter. Showing all available company history rows.
                        </p>
                      )}

                      {purchaseRowsForDisplay.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No purchase records available for this selection.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-border/60">
                          <Table className="min-w-[1900px] text-sm">
                            <TableHeader>
                              <TableRow className="bg-muted/35 hover:bg-muted/35">
                                <TableHead className="sticky left-0 z-20 w-[130px] min-w-[130px] bg-muted/35 font-semibold">
                                  Date
                                </TableHead>
                                <TableHead className="w-[260px] min-w-[260px]">Importer</TableHead>
                                <TableHead className="w-[260px] min-w-[260px]">Exporter</TableHead>
                                <TableHead className="w-[120px] min-w-[120px]">HS Code</TableHead>
                                <TableHead className="w-[180px] min-w-[180px]">Product</TableHead>
                                <TableHead className="w-[280px] min-w-[280px]">Product Description</TableHead>
                                <TableHead className="w-[140px] min-w-[140px]">Origin</TableHead>
                                <TableHead className="w-[140px] min-w-[140px]">Destination</TableHead>
                                <TableHead className="w-[130px] min-w-[130px] text-right">Quantity</TableHead>
                                <TableHead className="w-[120px] min-w-[120px]">Unit</TableHead>
                                <TableHead className="w-[140px] min-w-[140px] text-right">Weight (KG)</TableHead>
                                <TableHead className="w-[155px] min-w-[155px] text-right">Unit Price / KG</TableHead>
                                <TableHead className="w-[165px] min-w-[165px] text-right">Unit Price / Qty</TableHead>
                                <TableHead className="w-[170px] min-w-[170px] text-right">Total Price (USD)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {purchaseRowsForDisplay.map((row, index) => (
                                <TableRow key={row.id ?? `${row.company_id}-${row.date ?? "na"}-${index}`} className="hover:bg-muted/25">
                                  <TableCell className="sticky left-0 z-10 bg-card">{formatDate(row.date)}</TableCell>
                                  <TableCell className="max-w-[260px] break-words">{row.importer ?? "—"}</TableCell>
                                  <TableCell className="max-w-[260px] break-words">{row.exporter ?? "—"}</TableCell>
                                  <TableCell>{row.hs_code ?? "—"}</TableCell>
                                  <TableCell className="max-w-[180px] break-words">{row.product ?? "—"}</TableCell>
                                  <TableCell className="max-w-[280px] break-words text-muted-foreground">{row.product_description ?? "—"}</TableCell>
                                  <TableCell>{row.origin_country ?? "—"}</TableCell>
                                  <TableCell>{row.destination_country ?? "—"}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatNumber(row.quantity)}</TableCell>
                                  <TableCell>{row.quantity_unit ?? "—"}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatNumber(row.weight_kg)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatCurrency(row.unit_price_usd_kg)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatCurrency(row.unit_price_usd_qty)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatCurrency(row.total_price_usd)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="supply-chain" className="mt-4 space-y-4">
                  <Card className={contentCardClass}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl tracking-tight sm:text-2xl">Supply Chain</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <SupplyChainFlowChart
                        companyName={companyName}
                        exporters={supplyChainExporterFlowNodes}
                        importers={supplyChainImporterFlowNodes}
                      />

                      {supplyChainRows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No supply chain records available for this company.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-border/60">
                          <Table className="min-w-[1400px] text-sm">
                            <TableHeader>
                              <TableRow className="bg-muted/35 hover:bg-muted/35">
                                <TableHead className="sticky left-0 z-20 w-[270px] min-w-[270px] bg-muted/35 font-semibold">
                                  Exporter / Supplier
                                </TableHead>
                                <TableHead className="w-[140px] min-w-[140px]">Country</TableHead>
                                <TableHead className="w-[150px] min-w-[150px]">Relationship</TableHead>
                                <TableHead className="w-[220px] min-w-[220px]">Product</TableHead>
                                <TableHead className="w-[120px] min-w-[120px]">HS Code</TableHead>
                                <TableHead className="w-[120px] min-w-[120px] text-right">Trades</TableHead>
                                <TableHead className="w-[150px] min-w-[150px] text-right">Trade Freq.</TableHead>
                                <TableHead className="w-[140px] min-w-[140px] text-right">KG Weight</TableHead>
                                <TableHead className="w-[130px] min-w-[130px] text-right">Quantity</TableHead>
                                <TableHead className="w-[130px] min-w-[130px] text-right">Volume (MT)</TableHead>
                                <TableHead className="w-[140px] min-w-[140px] text-right">Weight Ratio</TableHead>
                                <TableHead className="w-[145px] min-w-[145px] text-right">Quantity Ratio</TableHead>
                                <TableHead className="w-[160px] min-w-[160px] text-right">Price Ratio</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {supplyChainRows.map((row) => (
                                <TableRow key={row.id} className="hover:bg-muted/25">
                                  <TableCell className="sticky left-0 z-10 max-w-[270px] bg-card font-medium">
                                    <div className="break-words">{row.exporter ?? row.supplier_name ?? "—"}</div>
                                  </TableCell>
                                  <TableCell>{row.supplier_country ?? "—"}</TableCell>
                                  <TableCell>{row.relationship_type ?? "—"}</TableCell>
                                  <TableCell className="max-w-[220px] break-words">{row.product ?? "—"}</TableCell>
                                  <TableCell>{row.hs_code ?? "—"}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatNumber(row.trades_sum)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatRatio(row.trade_frequency_ratio)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatNumber(row.kg_weight)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatNumber(row.quantity)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatNumber(row.volume_mt)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatRatio(row.weight_ratio)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatRatio(row.quantity_ratio)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatRatio(row.total_price_ratio)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
