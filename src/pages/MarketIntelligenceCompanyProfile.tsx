import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Building2,
  ExternalLink,
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Sparkles,
  Twitter,
  Youtube,
} from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
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
  importer: string | null;
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

const pickPreferredCompanyName = (...values: Array<string | null | undefined>) => {
  const candidates = values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (candidates.length === 0) return undefined;

  const score = (value: string) => {
    const words = value.split(/\s+/).filter(Boolean).length;
    const upper = value.toUpperCase();
    const hasCorporateHint = /(CÔNG TY|COMPANY|LIMITED|LTD|CORP|CORPORATION|CO\.)/.test(upper);
    const looksLikeShortAlias = value.length <= 12 && /^[A-Z0-9]+(?:[-/][A-Z0-9]+)+$/.test(value);

    let points = 0;
    if (value.length >= 18) points += 4;
    if (words >= 3) points += 4;
    if (hasCorporateHint) points += 3;
    if (looksLikeShortAlias) points -= 6;
    return points;
  };

  return [...new Set(candidates)].sort((a, b) => score(b) - score(a) || b.length - a.length)[0];
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
    importer: toTextOrNull(getCandidateValue(row, ["importer", "buyer", "customer", "company_name"])),
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
  const company = toTextOrNull(getCandidateValue(row, ["company_id", "companyid", "companyId", "customer_id", "customerid", "id"])) ?? fallbackCompanyId;
  return {
    id: toTextOrNull(getCandidateValue(row, ["id"])) ?? `contact-${company}-${index}`,
    company_id: company,
    name: toTextOrNull(
      getCandidateValue(row, [
        "name",
        "contact_name",
        "contact",
        "full_name",
        "fullname",
        "contact_person",
        "contactperson",
        "person_name",
        "representative",
        "representative_name",
        "owner_name",
        "pic_name",
      ]),
    ),
    position: toTextOrNull(getCandidateValue(row, ["position", "job_title", "title", "role", "designation"])),
    department: toTextOrNull(getCandidateValue(row, ["department", "team", "division", "function"])),
    employment_date: toTextOrNull(getCandidateValue(row, ["employment_date", "employment_year", "joined_at"])),
    business_email: toTextOrNull(getCandidateValue(row, ["contact_email", "business_email", "email", "company_email", "work_email"])),
    supplement_email_1: toTextOrNull(getCandidateValue(row, ["contact_email_1", "supplement_email_1", "email_1", "secondary_email"])),
    supplement_email_2: toTextOrNull(getCandidateValue(row, ["contact_email_2", "supplement_email_2", "email_2", "alternate_email"])),
    social_media: toTextOrNull(getCandidateValue(row, ["social_media"])),
    tel: toTextOrNull(getCandidateValue(row, ["tel", "phone", "telephone", "mobile", "phone_number", "contact_number"])),
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

const normalizeEmail = (value?: string | null) => value?.trim().toLowerCase() ?? "";

type SocialLinkItem = {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
};

const splitSocialTokens = (value?: string | null) =>
  (value ?? "")
    .split(/[\s,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const getSocialIconByUrl = (href: string): Pick<SocialLinkItem, "label" | "Icon"> => {
  const lower = href.toLowerCase();
  if (lower.includes("linkedin.com")) return { label: "LinkedIn", Icon: Linkedin };
  if (lower.includes("instagram.com")) return { label: "Instagram", Icon: Instagram };
  if (lower.includes("facebook.com")) return { label: "Facebook", Icon: Facebook };
  if (lower.includes("twitter.com") || lower.includes("x.com")) return { label: "X", Icon: Twitter };
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return { label: "YouTube", Icon: Youtube };
  if (lower.includes("whatsapp.com") || lower.includes("wa.me") || lower.includes("line.me")) {
    return { label: "Chat", Icon: MessageCircle };
  }
  return { label: "Link", Icon: Globe };
};

const hasContactIdentity = (row: CompanyContactRow) =>
  Boolean(
    pickFirstText(
      row.name,
      row.business_email,
      row.supplement_email_1,
      row.supplement_email_2,
      row.tel,
      row.whatsapp,
      row.fax,
      row.linkedin,
      row.twitter,
      row.instagram,
      row.facebook,
      row.social_media,
    ),
  );

const mapCompanyEmailRow = (row: GenericSupabaseRow, fallbackCompanyId: string, index: number): CompanyEmailRow => {
  const company = toTextOrNull(getCandidateValue(row, ["company_id", "companyid"])) ?? fallbackCompanyId;
  return {
    id: toTextOrNull(getCandidateValue(row, ["id"])) ?? `company-email-${company}-${index}`,
    company_id: company,
    email: toTextOrNull(getCandidateValue(row, ["email", "business_email", "contact_email", "work_email", "company_email"])),
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
  const isMobile = useIsMobile();
  const [showExporter, setShowExporter] = useState(true);
  const [showImporter, setShowImporter] = useState(false);
  const hasImporterData = importers.length > 0;

  const visibleExporters = showExporter ? exporters.slice(0, 10) : [];
  const visibleImporters = showImporter ? importers.slice(0, 10) : [];

  const maxExporterValue = Math.max(1, ...visibleExporters.map((item) => item.value));
  const maxImporterValue = Math.max(1, ...visibleImporters.map((item) => item.value));
  const flowTransform = getFlowTransform(showExporter, showImporter);
  const flowFocusLabel = getFlowFocusLabel(showExporter, showImporter);
  const showLeftLane = showExporter;
  const showRightLane = showImporter && hasImporterData;
  const rowGap = isMobile ? 36 : 32;
  const maxRows = Math.max(visibleExporters.length, visibleImporters.length, 3);
  const svgHeight = maxRows * rowGap + (isMobile ? 104 : 120);
  const viewWidth = isMobile ? 420 : 1000;
  const centerWidth = isMobile ? 168 : 300;
  const centerHeight = Math.max(isMobile ? 122 : 154, Math.min(isMobile ? 176 : 220, maxRows * (isMobile ? 20 : 24)));
  const centerX = viewWidth / 2 - centerWidth / 2;
  const centerY = (svgHeight - centerHeight) / 2;
  const centerNameLines = getTextLines(companyName, isMobile ? 14 : 24, isMobile ? 4 : 3);
  const laneInset = isMobile ? 10 : 18;
  const laneWidth = Math.max(0, centerX - laneInset * 2);
  const leftNodeOffset = isMobile ? 24 : 104;
  const leftNodeX = centerX - leftNodeOffset;
  const rightNodeX = centerX + centerWidth + leftNodeOffset;
  const leftTextX = leftNodeX - (isMobile ? 8 : 12);
  const rightTextX = rightNodeX + (isMobile ? 8 : 9);
  const leftControl1X = leftNodeX + (isMobile ? 8 : 70);
  const leftControl2X = centerX - (isMobile ? 6 : 18);
  const rightControl1X = centerX + centerWidth + (isMobile ? 6 : 18);
  const rightControl2X = rightNodeX - (isMobile ? 8 : 70);
  const textClipPadding = isMobile ? 10 : 90;
  const clipWidth = Math.max(isMobile ? 82 : 160, centerX - laneInset * 2 - textClipPadding);
  const leftClipX = laneInset - 2;
  const rightClipX = viewWidth - clipWidth - (laneInset - 2);
  const centerNameLineGap = isMobile ? 14 : 19;
  const centerPrimaryFontSize = isMobile ? 12.5 : 17;
  const centerSecondaryFontSize = isMobile ? 11.5 : 16;
  const nodeLabelFontSize = isMobile ? 9.4 : 12.5;
  const nodeValueFontSize = isMobile ? 8.4 : 10.5;
  const noDataFontSize = isMobile ? 12.5 : 16;
  const leftLaneCenterX = laneInset + laneWidth / 2;
  const rightLaneCenterX = centerX + centerWidth + laneInset + laneWidth / 2;

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

  const trimName = (value: string, max = isMobile ? 15 : 24) => (value.length > max ? `${value.slice(0, max - 1)}…` : value);

  return (
    <div className="space-y-3">
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

      <div
        className={cn(
          "grid grid-cols-3 items-center text-center font-medium uppercase text-muted-foreground",
          isMobile ? "text-[9px] tracking-[0.08em]" : "text-[10px] tracking-[0.14em]",
        )}
      >
        <span>{showExporter ? "Exporters" : ""}</span>
        <span className="truncate px-3">Company</span>
        <span>{showImporter ? "Importers" : ""}</span>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border/40 bg-white">
        <svg viewBox={`0 0 ${viewWidth} ${svgHeight}`} className="h-auto w-full" preserveAspectRatio="xMidYMid meet">
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
              <rect x={leftClipX} y={16} width={clipWidth} height={svgHeight - 32} />
            </clipPath>
            <clipPath id="flow-right-text-clip">
              <rect x={rightClipX} y={16} width={clipWidth} height={svgHeight - 32} />
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

          <rect x={0} y={0} width={viewWidth} height={svgHeight} fill={flowPalette.bg} />
          {showLeftLane && <rect x={laneInset} y={16} width={laneWidth} height={svgHeight - 32} rx={24} fill="url(#flow-left-lane)" />}
          {showRightLane && (
            <rect
              x={centerX + centerWidth + laneInset}
              y={16}
              width={laneWidth}
              height={svgHeight - 32}
              rx={24}
              fill="url(#flow-right-lane)"
            />
          )}

          <g
            style={{ transform: flowTransform, transformOrigin: `${viewWidth / 2}px 50%` }}
            className="origin-center transition-transform duration-500 ease-out"
          >
            {showExporter && (
              <rect x={centerX - 1} y={centerY + 20} width={4} height={centerHeight - 40} fill={flowPalette.exporterRail} rx={4} />
            )}
            {showImporter && (
              <rect x={centerX + centerWidth - 3} y={centerY + 20} width={4} height={centerHeight - 40} fill={flowPalette.importerRail} rx={4} />
            )}

            {centerNameLines.map((line, index) => (
              <text
                key={`${line}-${index}`}
                x={viewWidth / 2}
                y={
                  centerY +
                  centerHeight / 2 -
                  ((centerNameLines.length - 1) * centerNameLineGap) / 2 +
                  index * centerNameLineGap +
                  2
                }
                textAnchor="middle"
                fontSize={index === 0 ? centerPrimaryFontSize : centerSecondaryFontSize}
                fontWeight={600}
                fill={flowPalette.text}
              >
                {line}
              </text>
            ))}

            {showExporter && visibleExporters.length === 0 && (
              <text x={leftLaneCenterX} y={svgHeight / 2 + 4} textAnchor="middle" fontSize={noDataFontSize} fill={flowPalette.muted}>
                No exporter data
              </text>
            )}

            {showImporter && !hasImporterData && (
              <text x={rightLaneCenterX} y={svgHeight / 2 + 4} textAnchor="middle" fontSize={noDataFontSize} fill={flowPalette.muted}>
                No Data
              </text>
            )}

            {showImporter && hasImporterData && visibleImporters.length === 0 && (
              <text x={rightLaneCenterX} y={svgHeight / 2 + 4} textAnchor="middle" fontSize={noDataFontSize} fill={flowPalette.muted}>
                No importer data
              </text>
            )}

            {visibleExporters.map((node, index) => {
              const nodeY = getNodeY(index, visibleExporters.length);
              const anchorY = getAnchorY(index, visibleExporters.length);
              const ratio = node.value / maxExporterValue;
              const strokeWidth = 1.4 + ratio * 4.2;
              const path = `M ${leftNodeX} ${nodeY} C ${leftControl1X} ${nodeY}, ${leftControl2X} ${anchorY}, ${centerX} ${anchorY}`;
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
                  <circle cx={leftNodeX} cy={nodeY} r={isMobile ? 2.4 : 2.9} fill={flowPalette.exporterRail} />
                  <text
                    x={leftTextX}
                    y={nodeY + 4}
                    textAnchor="end"
                    fontSize={nodeLabelFontSize}
                    fill={flowPalette.text}
                    fontWeight={500}
                    clipPath="url(#flow-left-text-clip)"
                  >
                    {trimName(node.name)}
                  </text>
                  <text
                    x={leftTextX}
                    y={nodeY + (isMobile ? 14 : 19)}
                    textAnchor="end"
                    fontSize={nodeValueFontSize}
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
              const path = `M ${centerX + centerWidth} ${anchorY} C ${rightControl1X} ${anchorY}, ${rightControl2X} ${nodeY}, ${rightNodeX} ${nodeY}`;
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
                  <circle cx={rightNodeX} cy={nodeY} r={isMobile ? 2.2 : 2.6} fill={flowPalette.importerRail} />
                  <text
                    x={rightTextX}
                    y={nodeY + 4}
                    textAnchor="start"
                    fontSize={nodeLabelFontSize}
                    fill={flowPalette.text}
                    fontWeight={500}
                    clipPath="url(#flow-right-text-clip)"
                  >
                    {trimName(node.name)}
                  </text>
                  <text
                    x={rightTextX}
                    y={nodeY + (isMobile ? 14 : 18)}
                    textAnchor="start"
                    fontSize={nodeValueFontSize}
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
  "rounded-lg border border-transparent px-3.5 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground data-[state=active]:border-[#ffbd59] data-[state=active]:bg-[#ffbd59] data-[state=active]:text-[#3b2a06]";

export default function MarketIntelligenceCompanyProfile() {
  const { companyId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const hsCode = searchParams.get("hs");

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [companyMaster, setCompanyMaster] = useState<CompanyMasterRow | null>(null);
  const [overview, setOverview] = useState<CompanyOverviewRow | null>(null);
  const [basicInfo, setBasicInfo] = useState<CompanyBasicInfoRow | null>(null);
  const [contacts, setContacts] = useState<CompanyContactRow[]>([]);
  const [companyContactRows, setCompanyContactRows] = useState<CompanyContactRow[]>([]);
  const [companyEmails, setCompanyEmails] = useState<CompanyEmailRow[]>([]);
  const [purchaseTrend, setPurchaseTrend] = useState<PurchaseTrendRow[]>([]);
  const [supplyChainRows, setSupplyChainRows] = useState<SupplyChainRow[]>([]);
  const [purchasePageSize, setPurchasePageSize] = useState(10);
  const [purchaseCurrentPage, setPurchaseCurrentPage] = useState(1);

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
          const companyIdFilterCandidates = ["company_id", "companyid", "companyId", "customer_id", "customerid", "id"];

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
          const rawRows = await fetchOptionalList<GenericSupabaseRow>(
            "company_contract",
            "created_at",
            true,
            300,
          );
          const mapped = rawRows
            .map((row, index) => mapCompanyContactRow(row, companyId, index))
            .filter(hasContactIdentity);

          // Contact Hub now keys each person by contact_email from Supabase.
          const emailKeyed = mapped.filter((row) => Boolean(normalizeEmail(row.business_email)));
          const deduped = new Map<string, CompanyContactRow>();
          emailKeyed.forEach((row) => {
            const emailKey = normalizeEmail(row.business_email);
            if (!emailKey) return;
            if (!deduped.has(emailKey)) {
              deduped.set(emailKey, row);
            }
          });

          return Array.from(deduped.values()).sort((a, b) =>
            normalizeEmail(a.business_email).localeCompare(normalizeEmail(b.business_email)),
          );
        };

        const fetchCompanyEmails = async () => {
          const candidateTables = ["company_email", "company_emails", "company_contact", "company_contacts", "company_contract"];
          for (const table of candidateTables) {
            const rawRows = await fetchOptionalList<GenericSupabaseRow>(table, "created_at", true, 300);
            if (rawRows.length === 0) continue;

            return rawRows
              .map((row, index) => {
                const mapped = mapCompanyEmailRow(row, companyId, index);
                return {
                  ...mapped,
                  source: mapped.source ?? table,
                  source_description: mapped.source_description ?? table,
                };
              })
              .filter((row) => Boolean(row.email));
          }
          return [] as CompanyEmailRow[];
        };

        const fetchCompanyContactRows = async () => {
          const rawRows = await fetchOptionalList<GenericSupabaseRow>("company_contract", "created_at", true, 500);
          const mapped = rawRows
            .map((row, index) => mapCompanyContactRow(row, companyId, index))
            .filter(hasContactIdentity);

          const deduped = new Map<string, CompanyContactRow>();
          mapped.forEach((row, index) => {
            const key = [
              normalizeEmail(row.business_email),
              row.name?.trim().toLowerCase() ?? "",
              row.position?.trim().toLowerCase() ?? "",
              String(index),
            ].join("|");
            if (!deduped.has(key)) {
              deduped.set(key, row);
            }
          });
          return Array.from(deduped.values());
        };

        const fetchBasicInfo = async () =>
          fetchOptionalSingleFromCandidates<CompanyBasicInfoRow>(
            ["company_basic_info", "company_info"],
            (row) => mapCompanyInfoRow(row, companyId),
          );

        const [companyMasterData, overviewData, basicData, contactsData, companyContactRowsData, companyEmailsData, purchaseData, supplyChainData] = await Promise.all([
          fetchCompanyMaster(),
          fetchOptionalSingle<CompanyOverviewRow>("company_overview"),
          fetchBasicInfo(),
          fetchContacts(),
          fetchCompanyContactRows(),
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
        setCompanyContactRows(companyContactRowsData);
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
      pickPreferredCompanyName(
        basicInfo?.company_name,
        basicInfo?.name_standard,
        basicInfo?.name_en,
        companyMaster?.customer_name,
        purchaseTrend[0]?.importer,
        companyMaster?.customer,
      ) ??
      pickFirstText(overview?.company_id, companyId) ??
      companyId,
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
  const purchaseSuppliers = useMemo(
    () => new Set(purchaseRowsForDisplay.map((row) => row.exporter).filter(Boolean)).size,
    [purchaseRowsForDisplay],
  );
  const purchaseOrigins = useMemo(
    () => new Set(purchaseRowsForDisplay.map((row) => row.origin_country).filter(Boolean)).size,
    [purchaseRowsForDisplay],
  );
  const purchaseDestinations = useMemo(
    () => new Set(purchaseRowsForDisplay.map((row) => row.destination_country).filter(Boolean)).size,
    [purchaseRowsForDisplay],
  );
  const purchaseProducts = useMemo(
    () => new Set(purchaseRowsForDisplay.map((row) => row.product).filter(Boolean)).size,
    [purchaseRowsForDisplay],
  );
  const latestPurchaseRecordDate = useMemo(() => {
    return purchaseRowsForDisplay
      .map((row) => row.date)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => (a > b ? -1 : 1))[0] ?? null;
  }, [purchaseRowsForDisplay]);
  const purchaseTotalPages = useMemo(
    () => Math.max(1, Math.ceil(totalPurchaseRows / purchasePageSize)),
    [totalPurchaseRows, purchasePageSize],
  );
  const paginatedPurchaseRows = useMemo(() => {
    const start = (purchaseCurrentPage - 1) * purchasePageSize;
    return purchaseRowsForDisplay.slice(start, start + purchasePageSize);
  }, [purchaseRowsForDisplay, purchaseCurrentPage, purchasePageSize]);
  const purchasePageStart = totalPurchaseRows === 0 ? 0 : (purchaseCurrentPage - 1) * purchasePageSize + 1;
  const purchasePageEnd = Math.min(purchaseCurrentPage * purchasePageSize, totalPurchaseRows);
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

    supplyChainRows.forEach((row) => {
      const name = (row.importer ?? "").trim();
      if (!name) return;
      if (name.toLowerCase() === companyNameNormalized) return;
      const value =
        row.trades_sum ??
        row.quantity ??
        row.kg_weight ??
        row.volume_mt ??
        row.total_price_usd ??
        0;
      grouped.set(name, (grouped.get(name) ?? 0) + value);
    });

    return Array.from(grouped.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [companyName, supplyChainRows]);

  useEffect(() => {
    setPurchaseCurrentPage(1);
  }, [hsCode, companyId, purchasePageSize, totalPurchaseRows]);

  useEffect(() => {
    if (purchaseCurrentPage > purchaseTotalPages) {
      setPurchaseCurrentPage(purchaseTotalPages);
    }
  }, [purchaseCurrentPage, purchaseTotalPages]);

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
    const merged = companyEmails
      .map((row) => ({
        email: row.email?.trim() ?? "",
        source: row.source_description ?? row.source ?? row.importance ?? "company_email",
      }))
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
  }, [companyEmails]);

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

  const contactInformationRows = useMemo(
    () =>
      companyContactRows.filter((row) =>
        Boolean(
          pickFirstText(
            row.name,
            row.position,
            row.department,
            row.employment_date,
            row.business_email,
            row.social_media,
            row.region,
          ),
        ),
      ),
    [companyContactRows],
  );

  return (
    <div className="flex h-full flex-col">
      <TopBar
        title={companyName || "Company Profile"}
      />

      <div className="flex-1 overflow-auto p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-5 md:pb-6">
        <div className="mx-auto w-full max-w-7xl space-y-4">
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

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-base font-semibold text-foreground">Contact</p>
                      <div className="mt-2 space-y-0">
                        <FieldRow label="Company name" value={companyName} />
                        <FieldRow label="Location" value={companyLocation} />
                        <FieldRow label="Website" value={companyWebsite} />
                        <FieldRow label="Last profile update" value={formatDate(basicInfo?.updated_at || overview?.updated_at || companyMaster?.created_at)} />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <p className="text-base font-semibold text-foreground">Digital Channels</p>
                      <div className="mt-2">
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
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="h-auto w-full justify-start gap-1.5 overflow-x-auto rounded-xl border border-border/60 bg-muted/30 p-1">
                  <TabsTrigger value="overview" className={tabTriggerClass}>Overview</TabsTrigger>
                  <TabsTrigger value="company" className={tabTriggerClass}>Contact</TabsTrigger>
                  <TabsTrigger value="purchases" className={tabTriggerClass}>Purchase History</TabsTrigger>
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
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl tracking-tight sm:text-2xl">Contact Hub</CardTitle>
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

                      <div className="space-y-2">
                        <p className="text-base font-semibold text-foreground">Contact Information</p>
                        {contactInformationRows.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No contact records available.</p>
                        ) : (
                          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/20">
                                  <TableHead>Contact Name</TableHead>
                                  <TableHead>Position</TableHead>
                                  <TableHead>Department</TableHead>
                                  <TableHead>Employment Date</TableHead>
                                  <TableHead>Business Email</TableHead>
                                  <TableHead>Social Media</TableHead>
                                  <TableHead>Region</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {contactInformationRows.map((row, index) => {
                                  const businessEmail = row.business_email?.trim() || "";
                                  const socialMediaLinks = [...new Set(splitSocialTokens(row.social_media))]
                                    .map((token) => normalizeUrl(token))
                                    .filter((value): value is string => Boolean(value));

                                  return (
                                    <TableRow key={`${row.id ?? row.business_email ?? row.name ?? "contact"}-${index}`}>
                                      <TableCell className="font-medium">{row.name || "—"}</TableCell>
                                      <TableCell>{row.position || "—"}</TableCell>
                                      <TableCell>{row.department || "—"}</TableCell>
                                      <TableCell>{row.employment_date || "—"}</TableCell>
                                      <TableCell className="max-w-[240px] truncate" title={businessEmail || undefined}>
                                        {businessEmail ? (
                                          <a href={`mailto:${businessEmail}`} className="text-sm text-foreground hover:underline">
                                            {businessEmail}
                                          </a>
                                        ) : (
                                          "—"
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {socialMediaLinks.length > 0 ? (
                                          <div className="flex items-center gap-1.5">
                                            {socialMediaLinks.map((href) => {
                                              const { label, Icon } = getSocialIconByUrl(href);
                                              return (
                                                <a
                                                  key={`${row.id ?? index}-${href}`}
                                                  href={href}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                                                  aria-label={label}
                                                  title={label}
                                                >
                                                  <Icon className="h-3.5 w-3.5" />
                                                </a>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          "—"
                                        )}
                                      </TableCell>
                                      <TableCell>{row.region || "—"}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="purchases" className="mt-4 space-y-4">
                  <Card className={contentCardClass}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xl tracking-tight sm:text-2xl">Purchase History</CardTitle>
                      <p className="text-sm text-muted-foreground">Purchase history for the past 12 months.</p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                        <StatCard label="Records" value={formatNumber(totalPurchaseRows)} />
                        <StatCard label="Suppliers" value={formatNumber(purchaseSuppliers)} />
                        <StatCard label="Origin Countries" value={formatNumber(purchaseOrigins)} />
                        <StatCard label="Destination Markets" value={formatNumber(purchaseDestinations)} />
                      </div>
                      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                        <StatCard label="Product Types" value={formatNumber(purchaseProducts)} />
                        <StatCard label="Latest Trade" value={formatDate(latestPurchaseRecordDate)} />
                        <StatCard
                          label="HS Filter"
                          value={hsCode ? hsCode.replace(/\D+/g, "").slice(0, 6) || "Applied" : "All"}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="mb-2">
                          <p className="text-base font-semibold text-foreground">Supply Chain Flow</p>
                        </div>
                        <SupplyChainFlowChart
                          companyName={companyName}
                          exporters={supplyChainExporterFlowNodes}
                          importers={supplyChainImporterFlowNodes}
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
                        <div className="space-y-3">
                          <div className="flex flex-col gap-2 border-t border-border/50 pt-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs font-medium text-slate-600">{formatNumber(totalPurchaseRows)} visible records</p>
                            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-2 py-1">
                              <span className="text-[11px] font-medium text-muted-foreground">Per page</span>
                              <Select
                                value={String(purchasePageSize)}
                                onValueChange={(value) => setPurchasePageSize(Number(value))}
                              >
                                <SelectTrigger className="h-7 w-[74px] rounded-full border-none bg-transparent px-2 text-xs shadow-none focus:ring-0">
                                  <SelectValue placeholder="10" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="10">10</SelectItem>
                                  <SelectItem value="20">20</SelectItem>
                                  <SelectItem value="30">30</SelectItem>
                                  <SelectItem value="50">50</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                            <div className="overflow-x-auto">
                              <Table className="min-w-[1280px] text-sm">
                                <TableHeader>
                                  <TableRow className="bg-slate-50/90 hover:bg-slate-50/90">
                                    <TableHead className="sticky left-0 z-20 w-[130px] min-w-[130px] bg-slate-50/90 font-semibold">
                                      Date
                                    </TableHead>
                                    <TableHead className="w-[260px] min-w-[260px]">Importer</TableHead>
                                    <TableHead className="w-[260px] min-w-[260px]">Exporter</TableHead>
                                    <TableHead className="w-[120px] min-w-[120px]">HS Code</TableHead>
                                    <TableHead className="w-[180px] min-w-[180px]">Product</TableHead>
                                    <TableHead className="w-[280px] min-w-[280px]">Product Description</TableHead>
                                    <TableHead className="w-[140px] min-w-[140px]">Origin</TableHead>
                                    <TableHead className="w-[140px] min-w-[140px]">Destination</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {paginatedPurchaseRows.map((row, index) => (
                                    <TableRow
                                      key={row.id ?? `${row.company_id}-${row.date ?? "na"}-${index}`}
                                      className={cn(
                                        "border-b border-slate-200/70 hover:bg-slate-100/70",
                                        index % 2 === 0 ? "bg-white" : "bg-slate-50/45",
                                      )}
                                    >
                                      <TableCell className="sticky left-0 z-10 bg-inherit">{formatDate(row.date)}</TableCell>
                                      <TableCell className="max-w-[260px] break-words">{row.importer ?? "—"}</TableCell>
                                      <TableCell className="max-w-[260px] break-words">{row.exporter ?? "—"}</TableCell>
                                      <TableCell>{row.hs_code ?? "—"}</TableCell>
                                      <TableCell className="max-w-[180px] break-words">{row.product ?? "—"}</TableCell>
                                      <TableCell className="max-w-[280px] text-muted-foreground">
                                        <div
                                          className="line-clamp-2 break-words leading-5"
                                          title={row.product_description ?? "—"}
                                        >
                                          {row.product_description ?? "—"}
                                        </div>
                                      </TableCell>
                                      <TableCell>{row.origin_country ?? "—"}</TableCell>
                                      <TableCell>{row.destination_country ?? "—"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-muted-foreground">
                              Showing {formatNumber(purchasePageStart)}-{formatNumber(purchasePageEnd)} of {formatNumber(totalPurchaseRows)}
                            </p>
                            <div className="flex items-center justify-between gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 min-w-[84px] rounded-full px-3 text-xs"
                                onClick={() => setPurchaseCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={purchaseCurrentPage === 1}
                              >
                                Previous
                              </Button>
                              <span className="text-xs font-medium text-slate-600">
                                Page {formatNumber(purchaseCurrentPage)} / {formatNumber(purchaseTotalPages)}
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 min-w-[84px] rounded-full px-3 text-xs"
                                onClick={() => setPurchaseCurrentPage((prev) => Math.min(purchaseTotalPages, prev + 1))}
                                disabled={purchaseCurrentPage >= purchaseTotalPages}
                              >
                                Next
                              </Button>
                            </div>
                          </div>
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
